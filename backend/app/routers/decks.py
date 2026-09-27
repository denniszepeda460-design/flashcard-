from fastapi import APIRouter, Request, HTTPException
from app.schemas.decks import DeckInfo, DeckCreate, DeckRename, DeckListResponse

router = APIRouter(prefix="/api/decks", tags=["decks"])


@router.get("", response_model=DeckListResponse)
@router.get("/", response_model=DeckListResponse)
async def list_decks(request: Request):
    """Lista todos los mazos con estadísticas de repaso."""
    cm = request.app.state.collection_manager
    with cm.get_collection() as col:
        decks: list[DeckInfo] = []
        deck_tree = col.sched.deck_due_tree()

        def traverse(node, parent_name: str = ""):
            full_name = f"{parent_name}::{node.name}" if parent_name else node.name
            if node.deck_id != 0 and node.name:
                decks.append(
                    DeckInfo(
                        id=node.deck_id,
                        name=full_name,
                        card_count=node.review_count + node.learn_count + node.new_count,
                        new_count=node.new_count,
                        learn_count=node.learn_count,
                        review_count=node.review_count,
                    )
                )
            for child in node.children:
                traverse(child, full_name if node.name else "")

        traverse(deck_tree)
        return DeckListResponse(decks=decks)


@router.post("", response_model=dict)
@router.post("/", response_model=dict)
async def create_deck(deck: DeckCreate, request: Request):
    """Crea un nuevo mazo. Si ya existe, devuelve su ID."""
    name = deck.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="El nombre del mazo no puede estar vacío.")

    cm = request.app.state.collection_manager
    with cm.get_collection() as col:
        deck_id = col.decks.id(name)
        return {"id": deck_id, "name": name}


@router.patch("/{deck_id}")
async def rename_deck(deck_id: int, data: DeckRename, request: Request):
    """Renombra un mazo existente."""
    name = data.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="El nombre del mazo no puede estar vacío.")

    cm = request.app.state.collection_manager
    with cm.get_collection() as col:
        deck_obj = col.decks.get(deck_id)
        if not deck_obj:
            raise HTTPException(status_code=404, detail="Mazo no encontrado")
        deck_obj["name"] = name
        col.decks.save(deck_obj)
        return {"status": "success"}


@router.delete("/{deck_id}")
async def remove_deck(deck_id: int, request: Request):
    """Elimina un mazo y todas sus tarjetas."""
    cm = request.app.state.collection_manager
    with cm.get_collection() as col:
        # Usar remove en anki moderno
        try:
            col.decks.remove([deck_id])
        except Exception:
            col.decks.rem(deck_id, cards_too=True)
        return {"status": "success"}
