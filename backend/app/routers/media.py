import os
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import FileResponse

router = APIRouter(prefix="/api/media", tags=["media"])


@router.get("/{filename}")
async def get_media_file(filename: str, request: Request):
    """Sirve archivos multimedia (imágenes, audios, etc.) desde la carpeta de medios de la colección de Anki."""
    cm = request.app.state.collection_manager
    with cm.get_collection() as col:
        media_dir = col.media.dir()

    if not media_dir or not os.path.exists(media_dir):
        raise HTTPException(status_code=404, detail="Directorio de medios no encontrado")

    # Seguridad: evitar path traversal (ej. ../../archivo)
    safe_media_dir = os.path.abspath(media_dir)
    file_path = os.path.abspath(os.path.join(safe_media_dir, filename))

    if not file_path.startswith(safe_media_dir):
        raise HTTPException(status_code=400, detail="Acceso denegado a ruta no permitida")

    if not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail="Archivo multimedia no encontrado")

    return FileResponse(file_path)
