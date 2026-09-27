from fastapi import APIRouter, Request
from app.schemas.sync import SyncStatus, SyncTriggerResponse
from app.services.sync_service import SyncService

router = APIRouter(prefix="/api/sync", tags=["sync"])

@router.post("/trigger", response_model=SyncTriggerResponse)
async def trigger_sync(request: Request):
    sync_service: SyncService = request.app.state.sync_service
    success, message = sync_service.trigger_sync(request.app.state.collection_manager)
    return SyncTriggerResponse(success=success, message=message)

@router.get("/status", response_model=SyncStatus)
async def get_sync_status(request: Request):
    sync_service: SyncService = request.app.state.sync_service
    status, last_sync = sync_service.get_status()
    return SyncStatus(status=status, last_sync=last_sync)
