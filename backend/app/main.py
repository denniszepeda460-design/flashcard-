from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import get_settings
from app.collection_manager import CollectionManager
from app.middleware.auth import APIKeyAuthMiddleware
from app.services.sync_service import SyncService

from app.routers import decks, notetypes, notes, cards, review, sync, stats, ai, tts

@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    
    opened_here = False
    if not hasattr(app.state, "collection_manager") or app.state.collection_manager is None:
        collection_manager = CollectionManager(settings.collection_path)
        collection_manager.open()
        app.state.collection_manager = collection_manager
        opened_here = True
    
    sync_service = SyncService()
    try:
        sync_service.start_sync_server(
            host=settings.sync_host,
            port=settings.sync_port,
            base=settings.sync_base,
            user=settings.sync_user
        )
    except Exception as e:
        print(f"[SyncServer] Servidor de sync no iniciado: {e}")
    app.state.sync_service = sync_service
    
    yield
    
    if opened_here and hasattr(app.state, "collection_manager") and app.state.collection_manager:
        app.state.collection_manager.close()
    try:
        sync_service.stop_sync_server()
    except Exception:
        pass

app = FastAPI(title="Flashcard API", lifespan=lifespan)

settings = get_settings()

if settings.environment.lower() == "production" and settings.cors_origins:
    allowed_list = [origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    # Permite localhost, IPs privadas LAN (192.168.x.x, 10.x.x.x, etc.),
    # dominios de Vercel (*.vercel.app) y nodos Tailscale (*.ts.net)
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+|.*\.vercel\.app|.*\.ts\.net)(:\d+)?$",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.add_middleware(APIKeyAuthMiddleware)

app.include_router(decks.router)
app.include_router(notetypes.router)
app.include_router(notes.router)
app.include_router(cards.router)
app.include_router(review.router)
app.include_router(sync.router)
app.include_router(stats.router)
app.include_router(ai.router)
app.include_router(tts.router)

@app.get("/api/health")
async def health_check():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    app_settings = get_settings()
    uvicorn.run(
        "app.main:app",
        host=app_settings.api_host,
        port=app_settings.api_port,
        reload=True,
    )
