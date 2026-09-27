from pydantic import BaseModel
from typing import Dict, List, Optional

class CardForReview(BaseModel):
    card_id: int
    note_id: int
    deck_id: int
    note_type_name: str
    fields: Dict[str, str]
    template_idx: int
    scheduling_states: Dict[str, str] = {}

class ReviewQueueResponse(BaseModel):
    cards: List[CardForReview]
    remaining: int

class AnswerRequest(BaseModel):
    card_id: int
    rating: int

class AnswerResponse(BaseModel):
    success: bool
    next_card: Optional[CardForReview] = None
