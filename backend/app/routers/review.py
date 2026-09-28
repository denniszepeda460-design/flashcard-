from fastapi import APIRouter, Request, HTTPException, Query
from app.schemas.review import (
    ReviewQueueResponse,
    CardForReview,
    AnswerRequest,
    AnswerResponse,
    FullReviewSessionResponse,
)
import re
from datetime import date
from typing import Optional, Set

router = APIRouter(prefix="/api/review", tags=["review"])


def _extract_media_filenames(text: str) -> Set[str]:
    filenames = set()
    if not text:
        return filenames
    # [sound:filename.ext]
    for m in re.findall(r'\[sound:([^\]]+)\]', text):
        clean = m.strip()
        if clean and not clean.startswith(("http://", "https://", "data:")):
            fname = clean.split("/")[-1].split("?")[0]
            if fname:
                filenames.add(fname)
    # src="..." o src='...'
    for m in re.findall(r'src=[\'"]([^\'"]+)[\'"]', text):
        clean = m.strip()
        if clean and not clean.startswith(("http://", "https://", "data:")):
            fname = clean.split("/")[-1].split("?")[0]
            if fname:
                filenames.add(fname)
    return filenames


def _build_card_for_review(col, queued_card, include_html: bool = False) -> tuple[CardForReview, Set[str]]:
    cid = queued_card.card.id
    card = col.get_card(cid)
    note = card.note()
    model = col.models.get(note.mid)

    field_names = [f["name"] for f in model["flds"]]
    fields_dict: dict[str, str] = {}
    for i, fname in enumerate(field_names):
        if i < len(note.fields):
            fields_dict[fname] = note.fields[i]

    scheduling_states: dict[str, str] = {
        "again": "<1m",
        "hard": "<6m",
        "good": "<10m",
        "easy": "4d",
    }
    try:
        if queued_card.states:
            labels = [
                l.replace("\u2068", "").replace("\u2069", "")
                for l in col.sched.describe_next_states(queued_card.states)
            ]
            if len(labels) >= 4:
                scheduling_states = {
                    "again": labels[0],
                    "hard": labels[1],
                    "good": labels[2],
                    "easy": labels[3],
                }
    except Exception:
        pass

    question_html = None
    answer_html = None
    media_files: Set[str] = set()

    if include_html:
        try:
            question_html = card.question()
            answer_html = card.answer()
        except Exception as e:
            print(f"[ReviewRouter] Error renderizando HTML para tarjeta {card.id}: {e}")

        # Extraer media de HTML y de campos de la nota
        media_files.update(_extract_media_filenames(question_html or ""))
        media_files.update(_extract_media_filenames(answer_html or ""))
        for fval in fields_dict.values():
            media_files.update(_extract_media_filenames(fval))

        # AV tags nativos de Anki
        try:
            for tag in card.question_av_tags():
                if hasattr(tag, "filename") and tag.filename:
                    media_files.add(tag.filename)
            for tag in card.answer_av_tags():
                if hasattr(tag, "filename") and tag.filename:
                    media_files.add(tag.filename)
        except Exception:
            pass

    card_obj = CardForReview(
        card_id=card.id,
        note_id=note.id,
        deck_id=card.did,
        note_type_name=model["name"],
        fields=fields_dict,
        template_idx=card.ord,
        scheduling_states=scheduling_states,
        question_html=question_html,
        answer_html=answer_html,
    )
    return card_obj, media_files


@router.get("/queue", response_model=ReviewQueueResponse)
@router.get("/queue/", response_model=ReviewQueueResponse)
async def get_queue(
    request: Request,
    deck_id: int = Query(..., description="ID del mazo"),
    limit: int = Query(20, ge=1, le=100, description="Máximo de cartas a obtener"),
):
    """Obtiene la cola de cartas a repasar para un mazo dado."""
    cm = request.app.state.collection_manager
    with cm.get_collection() as col:
        deck = col.decks.get(deck_id)
        if not deck:
            raise HTTPException(status_code=404, detail="Mazo no encontrado")

        col.decks.select(deck_id)
        queued = col.sched.get_queued_cards(fetch_limit=limit)
        total_remaining = queued.new_count + queued.learning_count + queued.review_count

        cards: list[CardForReview] = []
        for queued_card in queued.cards:
            card_obj, _ = _build_card_for_review(col, queued_card, include_html=False)
            cards.append(card_obj)

        return ReviewQueueResponse(cards=cards, remaining=total_remaining)


@router.get("/session/full", response_model=FullReviewSessionResponse)
@router.get("/session/full/", response_model=FullReviewSessionResponse)
async def get_full_session(
    request: Request,
    deck_id: Optional[int] = Query(None, description="ID del mazo (opcional, si se omite incluye todos los mazos)"),
):
    """Obtiene la cola completa del día con HTML pre-renderizado y lista de multimedia para estudio 100% offline."""
    cm = request.app.state.collection_manager
    with cm.get_collection() as col:
        cards: list[CardForReview] = []
        all_media: set[str] = set()
        seen_card_ids: set[int] = set()
        total_remaining = 0

        if deck_id is not None:
            deck = col.decks.get(deck_id)
            if not deck:
                raise HTTPException(status_code=404, detail="Mazo no encontrado")
            target_decks = [deck]
        else:
            target_decks = col.decks.all()

        for d in target_decks:
            col.decks.select(d["id"])
            queued = col.sched.get_queued_cards(fetch_limit=5000)
            remaining_for_deck = queued.new_count + queued.learning_count + queued.review_count
            total_remaining += remaining_for_deck

            for queued_card in queued.cards:
                cid = queued_card.card.id
                if cid in seen_card_ids:
                    continue
                seen_card_ids.add(cid)
                card_obj, media_files = _build_card_for_review(col, queued_card, include_html=True)
                cards.append(card_obj)
                all_media.update(media_files)

        today_str = date.today().isoformat()
        return FullReviewSessionResponse(
            cards=cards,
            remaining=total_remaining,
            media=sorted(list(all_media)),
            date=today_str,
        )


@router.post("/answer", response_model=AnswerResponse)
@router.post("/answer/", response_model=AnswerResponse)
async def answer_card(request: Request, answer: AnswerRequest):
    """Registra la respuesta de repaso y calcula el siguiente intervalo con FSRS.

    rating del frontend: 1=De nuevo (Again), 2=Difícil (Hard), 3=Bien (Good), 4=Fácil (Easy)
    """
    cm = request.app.state.collection_manager
    with cm.get_collection() as col:
        if answer.rating not in (1, 2, 3, 4):
            raise HTTPException(
                status_code=400,
                detail="Rating inválido. Debe ser 1 (Again), 2 (Hard), 3 (Good), o 4 (Easy)",
            )

        try:
            card = col.get_card(answer.card_id)
            states = col._backend.get_scheduling_states(card.id)
            card.start_timer()

            # Map frontend rating (1-4) to Anki's protobuf CardAnswer enum:
            # AGAIN = 0, HARD = 1, GOOD = 2, EASY = 3
            CA = col.sched.build_answer.__globals__["CardAnswer"]
            rating_map = {
                1: CA.AGAIN, # 0
                2: CA.HARD,  # 1
                3: CA.GOOD,  # 2
                4: CA.EASY,  # 3
            }
            anki_rating = rating_map.get(answer.rating, CA.GOOD)

            card_answer = col.sched.build_answer(
                card=card,
                states=states,
                rating=anki_rating,
            )
            col.sched.answer_card(card_answer)
            return AnswerResponse(success=True)
        except Exception as e:
            print(f"[ReviewRouter] Error registrando respuesta {answer.rating} para tarjeta {answer.card_id}: {e}")
            raise HTTPException(
                status_code=400,
                detail=f"Error al registrar respuesta de tarjeta: {str(e)}",
            )


@router.post("/undo")
@router.post("/undo/")
async def undo_review(request: Request):
    """Deshace la última acción de repaso."""
    cm = request.app.state.collection_manager
    with cm.get_collection() as col:
        if bool(col.undo_status().undo):
            col.undo()
            return {"success": True, "message": "Acción deshecha correctamente"}
        return {"success": False, "message": "No hay acciones para deshacer"}
