from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from app.services.gemini_service import generate_flashcards_with_ai, rotator

router = APIRouter(prefix="/api/ai", tags=["ai"])

class GenerateCardsRequest(BaseModel):
    text: str
    deck_id: Optional[int] = None
    card_mode: Optional[str] = "mixed"  # "mixed" | "dictation_only"

class GeneratedCard(BaseModel):
    note_type_name: str
    fields: Dict[str, str]
    tags: List[str] = []

class GenerateCardsResponse(BaseModel):
    cards: List[GeneratedCard]
    api_key_index: int

@router.post("/generate-cards", response_model=GenerateCardsResponse)
async def generate_cards(request: GenerateCardsRequest):
    if not request.text or not request.text.strip():
        raise HTTPException(status_code=400, detail="El texto para generar flashcards no puede estar vacío.")

    try:
        cards_raw = generate_flashcards_with_ai(request.text.strip(), card_mode=request.card_mode)
        cards = [
            GeneratedCard(
                note_type_name=c.get("note_type_name", "Basic"),
                fields={str(k): str(v) for k, v in c.get("fields", {}).items()},
                tags=c.get("tags", []),
            )
            for c in cards_raw
        ]
        return GenerateCardsResponse(
            cards=cards,
            api_key_index=rotator.current_index,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en generación con IA: {str(e)}")
