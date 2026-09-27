from fastapi import APIRouter, Request, HTTPException, Query
from app.schemas.review import ReviewQueueResponse, CardForReview, AnswerRequest, AnswerResponse

router = APIRouter(prefix="/api/review", tags=["review"])


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

        # Obtener cola de cartas usando el scheduler v3 de Anki (respeta new.perDay)
        queued = col.sched.get_queued_cards(fetch_limit=limit)
        total_remaining = queued.new_count + queued.learning_count + queued.review_count

        cards: list[CardForReview] = []
        for queued_card in queued.cards:
            cid = queued_card.card.id
            card = col.get_card(cid)
            note = card.note()
            model = col.models.get(note.mid)

            field_names = [f["name"] for f in model["flds"]]
            fields_dict: dict[str, str] = {}
            for i, fname in enumerate(field_names):
                if i < len(note.fields):
                    fields_dict[fname] = note.fields[i]

            # Intervalos para los 4 botones usando directamente queued_card.states
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

            cards.append(
                CardForReview(
                    card_id=card.id,
                    note_id=note.id,
                    deck_id=card.did,
                    note_type_name=model["name"],
                    fields=fields_dict,
                    template_idx=card.ord,
                    scheduling_states=scheduling_states,
                )
            )

        return ReviewQueueResponse(cards=cards, remaining=total_remaining)


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
