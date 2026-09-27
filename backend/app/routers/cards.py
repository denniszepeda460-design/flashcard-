from fastapi import APIRouter, Request, HTTPException, Query

router = APIRouter(prefix="/api/cards", tags=["cards"])


@router.get("/search")
async def search_cards(
    request: Request,
    q: str = "",
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """Busca tarjetas usando la sintaxis de búsqueda de Anki."""
    cm = request.app.state.collection_manager
    with cm.get_collection() as col:
        try:
            card_ids = col.find_cards(q)
            total = len(card_ids)
            paginated = card_ids[offset : offset + limit]
            return {"card_ids": paginated, "total": total}
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))


@router.get("/{card_id}")
async def get_card(card_id: int, request: Request):
    """Obtiene los detalles de una tarjeta incluyendo campos de la nota y estado de repaso."""
    cm = request.app.state.collection_manager
    with cm.get_collection() as col:
        try:
            card = col.get_card(card_id)
            note = card.note()
            model = col.models.get(note.mid)

            field_names = [f["name"] for f in model["flds"]]
            fields_dict = {}
            for i, fname in enumerate(field_names):
                if i < len(note.fields):
                    fields_dict[fname] = note.fields[i]

            return {
                "id": card.id,
                "note_id": note.id,
                "deck_id": card.did,
                "note_type_name": model["name"],
                "template_idx": card.ord,
                "type": card.type,
                "queue": card.queue,
                "due": card.due,
                "interval": card.ivl,
                "reps": card.reps,
                "lapses": card.lapses,
                "fields": fields_dict,
                "tags": note.tags,
            }
        except Exception as e:
            raise HTTPException(status_code=404, detail=f"Tarjeta no encontrada: {e}")
