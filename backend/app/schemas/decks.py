from pydantic import BaseModel
from typing import List

class DeckInfo(BaseModel):
    id: int
    name: str
    card_count: int
    new_count: int
    learn_count: int
    review_count: int

class DeckCreate(BaseModel):
    name: str

class DeckRename(BaseModel):
    name: str

class DeckListResponse(BaseModel):
    decks: List[DeckInfo]
