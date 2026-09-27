from pydantic import BaseModel
from typing import Optional

class SyncStatus(BaseModel):
    last_sync: Optional[str] = None
    status: str
    message: Optional[str] = None

class SyncTriggerResponse(BaseModel):
    success: bool
    message: str
