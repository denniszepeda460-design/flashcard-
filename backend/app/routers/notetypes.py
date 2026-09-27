from fastapi import APIRouter, Request, HTTPException

router = APIRouter(prefix="/api/notetypes", tags=["notetypes"])


@router.get("/")
async def list_notetypes(request: Request):
    """Lista todos los tipos de nota disponibles con sus campos."""
    cm = request.app.state.collection_manager
    with cm.get_collection() as col:
        models = col.models.all()
        result = []
        for m in models:
            result.append({
                "id": m["id"],
                "name": m["name"],
                "fields": [f["name"] for f in m["flds"]],
                "type": "cloze" if m.get("type", 0) == 1 else "standard",
            })
        return result


@router.get("/{notetype_id}")
async def get_notetype(notetype_id: int, request: Request):
    """Obtiene el detalle de un tipo de nota, incluyendo campos y plantillas."""
    cm = request.app.state.collection_manager
    with cm.get_collection() as col:
        model = col.models.get(notetype_id)
        if not model:
            raise HTTPException(status_code=404, detail="Tipo de nota no encontrado")
        return {
            "id": model["id"],
            "name": model["name"],
            "fields": [{"name": f["name"], "ord": f["ord"]} for f in model["flds"]],
            "templates": [
                {"name": t["name"], "qfmt": t["qfmt"], "afmt": t["afmt"]}
                for t in model["tmpls"]
            ],
            "css": model.get("css", ""),
            "type": "cloze" if model.get("type", 0) == 1 else "standard",
        }
