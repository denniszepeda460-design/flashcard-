import io
import csv
from fastapi import APIRouter, Request, HTTPException, Query, Response
from pydantic import BaseModel
from typing import List, Dict, Optional
from app.schemas.notes import NoteCreate, NoteUpdate, NoteInfo, NoteSearchResult

router = APIRouter(prefix="/api/notes", tags=["notes"])


class BatchNotesRequest(BaseModel):
    deck_id: int
    notes: List[NoteCreate]
    allow_html: bool = True
    existing_action: str = "add"  # "add", "update", "skip"


@router.post("/")
async def create_note(note: NoteCreate, request: Request):
    """Crea una nueva nota en el mazo especificado."""
    cm = request.app.state.collection_manager
    with cm.get_collection() as col:
        model = col.models.by_name(note.note_type_name)
        if not model:
            raise HTTPException(
                status_code=400, detail=f"Tipo de nota no encontrado: {note.note_type_name}"
            )

        col.models.set_current(model)
        new_note = col.new_note(model)

        # Map provided fields to note fields
        field_names = [f["name"] for f in model["flds"]]
        fields_copy = dict(note.fields)
        if "AudioText" in fields_copy and "AudioText" not in field_names and "Sentence" in field_names:
            fields_copy["Sentence"] = fields_copy["AudioText"]
        if "Sentence" in fields_copy and "Sentence" not in field_names and "AudioText" in field_names:
            fields_copy["AudioText"] = fields_copy["Sentence"]

        for k, v in fields_copy.items():
            if k in field_names:
                idx = field_names.index(k)
                new_note.fields[idx] = v

        new_note.tags = note.tags
        col.add_note(new_note, note.deck_id)
        return {"id": new_note.id, "message": "Nota creada exitosamente"}


@router.post("/batch")
async def batch_create_notes(batch: BatchNotesRequest, request: Request):
    """Crea múltiples notas en bloque (para importación CSV, pegado masivo o modo IA)."""
    cm = request.app.state.collection_manager
    created_count = 0
    errors = []

    with cm.get_collection() as col:
        for idx, item in enumerate(batch.notes):
            try:
                model = col.models.by_name(item.note_type_name)
                if not model:
                    errors.append(f"Nota #{idx+1}: Tipo '{item.note_type_name}' no encontrado")
                    continue

                target_deck = item.deck_id or batch.deck_id
                new_note = col.new_note(model)
                field_names = [f["name"] for f in model["flds"]]

                for k, v in item.fields.items():
                    if k in field_names:
                        f_idx = field_names.index(k)
                        val_str = str(v)
                        new_note.fields[f_idx] = val_str

                if item.tags:
                    new_note.tags = item.tags

                col.add_note(new_note, target_deck)
                created_count += 1
            except Exception as e:
                errors.append(f"Nota #{idx+1}: {str(e)}")

        return {
            "success": True,
            "created": created_count,
            "total_requested": len(batch.notes),
            "errors": errors,
        }


@router.get("/export")
async def export_notes_csv(
    request: Request,
    deck_id: Optional[int] = None,
    delimiter: str = ";",
):
    """Exporta las notas a formato CSV con UTF-8 BOM, compatible con Anki y Excel."""
    cm = request.app.state.collection_manager
    with cm.get_collection() as col:
        query = ""
        deck_name = "todas_las_tarjetas"
        if deck_id:
            deck = col.decks.get(deck_id)
            if deck:
                query = f'deck:"{deck["name"]}"'
                deck_name = deck["name"].replace("::", "_").replace(" ", "_")

        note_ids = col.find_notes(query)

        output = io.StringIO()
        # UTF-8 BOM for Excel compatibility
        output.write("\ufeff")

        writer = csv.writer(output, delimiter=delimiter, quoting=csv.QUOTE_MINIMAL)
        # Header row
        writer.writerow(["ID", "Tipo", "Mazo", "Campo1", "Campo2", "Campo3", "Campo4", "Campo5", "Etiquetas"])

        for nid in note_ids:
            note = col.get_note(nid)
            model = col.models.get(note.mid)
            cards = note.cards()
            did = cards[0].did if cards else 0
            d_name = col.decks.get(did)["name"] if did else ""

            fields_list = list(note.fields)
            row = [
                note.id,
                model["name"],
                d_name,
                fields_list[0] if len(fields_list) > 0 else "",
                fields_list[1] if len(fields_list) > 1 else "",
                fields_list[2] if len(fields_list) > 2 else "",
                fields_list[3] if len(fields_list) > 3 else "",
                fields_list[4] if len(fields_list) > 4 else "",
                " ".join(note.tags),
            ]
            writer.writerow(row)

        csv_content = output.getvalue()
        filename = f"flashcards_{deck_name}.csv"

        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )


@router.get("/search", response_model=NoteSearchResult)
async def search_notes(
    request: Request,
    q: str = "",
    deck_id: int | None = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """Busca notas por texto, mazo, o cualquier búsqueda Anki."""
    cm = request.app.state.collection_manager
    with cm.get_collection() as col:
        query = q
        if deck_id:
            deck = col.decks.get(deck_id)
            if deck:
                query = f'deck:"{deck["name"]}" {query}'

        try:
            note_ids = col.find_notes(query)
            total = len(note_ids)
            paginated_ids = note_ids[offset : offset + limit]

            notes: list[NoteInfo] = []
            for nid in paginated_ids:
                note = col.get_note(nid)
                model = col.models.get(note.mid)
                cards = note.cards()
                did = cards[0].did if cards else 0

                field_names = [f["name"] for f in model["flds"]]
                fields_dict = {}
                for i, fname in enumerate(field_names):
                    if i < len(note.fields):
                        fields_dict[fname] = note.fields[i]

                notes.append(
                    NoteInfo(
                        id=note.id,
                        note_type_name=model["name"],
                        fields=fields_dict,
                        tags=note.tags,
                        deck_id=did,
                    )
                )

            return NoteSearchResult(notes=notes, total=total)
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))


@router.get("/{note_id}", response_model=NoteInfo)
async def get_note(note_id: int, request: Request):
    """Obtiene los detalles de una nota por su ID."""
    cm = request.app.state.collection_manager
    with cm.get_collection() as col:
        try:
            note = col.get_note(note_id)
            model = col.models.get(note.mid)
            cards = note.cards()
            deck_id = cards[0].did if cards else 0

            field_names = [f["name"] for f in model["flds"]]
            fields_dict = {}
            for i, fname in enumerate(field_names):
                if i < len(note.fields):
                    fields_dict[fname] = note.fields[i]

            return NoteInfo(
                id=note.id,
                note_type_name=model["name"],
                fields=fields_dict,
                tags=note.tags,
                deck_id=deck_id,
            )
        except Exception as e:
            raise HTTPException(status_code=404, detail=f"Nota no encontrada: {e}")


@router.patch("/{note_id}")
async def update_note(note_id: int, note_update: NoteUpdate, request: Request):
    """Actualiza los campos y/o tags de una nota existente."""
    cm = request.app.state.collection_manager
    with cm.get_collection() as col:
        try:
            note = col.get_note(note_id)
            model = col.models.get(note.mid)

            if note_update.fields:
                field_names = [f["name"] for f in model["flds"]]
                fields_copy = dict(note_update.fields)
                if "AudioText" in fields_copy and "AudioText" not in field_names and "Sentence" in field_names:
                    fields_copy["Sentence"] = fields_copy["AudioText"]
                if "Sentence" in fields_copy and "Sentence" not in field_names and "AudioText" in field_names:
                    fields_copy["AudioText"] = fields_copy["Sentence"]

                for k, v in fields_copy.items():
                    if k in field_names:
                        idx = field_names.index(k)
                        note.fields[idx] = v

            if note_update.tags is not None:
                note.tags = note_update.tags

            col.update_note(note)
            return {"status": "success", "message": "Nota actualizada"}
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{note_id}")
async def remove_note(note_id: int, request: Request):
    """Elimina una nota y todas sus tarjetas asociadas."""
    cm = request.app.state.collection_manager
    with cm.get_collection() as col:
        try:
            col.remove_notes([note_id])
            return {"status": "success", "message": "Nota eliminada"}
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))
