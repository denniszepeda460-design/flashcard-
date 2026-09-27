from pydantic import BaseModel
from typing import Dict, List, Optional

class NoteCreate(BaseModel):
    note_type_name: str
    deck_id: int
    fields: Dict[str, str]
    tags: List[str] = []

class NoteUpdate(BaseModel):
    fields: Optional[Dict[str, str]] = None
    tags: Optional[List[str]] = None

class NoteInfo(BaseModel):
    id: int
    note_type_name: str
    fields: Dict[str, str]
    tags: List[str]
    deck_id: int

class NoteSearchResult(BaseModel):
    notes: List[NoteInfo]
    total: int
