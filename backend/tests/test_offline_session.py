import os
import tempfile
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.collection_manager import CollectionManager
from app.config import get_settings


@pytest.fixture
def test_client():
    temp_dir = tempfile.mkdtemp()
    db_path = os.path.join(temp_dir, "test_session.anki2")
    cm = CollectionManager(db_path)
    cm.open()

    # Prepopulate with a test note and media
    with cm.get_collection() as col:
        # Create media directory and a dummy media file
        media_dir = col.media.dir()
        os.makedirs(media_dir, exist_ok=True)
        test_media_file = os.path.join(media_dir, "test_audio.mp3")
        with open(test_media_file, "wb") as f:
            f.write(b"fake mp3 audio content")

        model = col.models.by_name("Basic")
        deck_id = col.decks.id("Test Deck Offline")
        note = col.new_note(model)
        note["Front"] = "Pregunta con audio [sound:test_audio.mp3] e imagen <img src=\"test_image.png\">"
        note["Back"] = "Respuesta correcta"
        col.add_note(note, deck_id=deck_id)

    app.state.collection_manager = cm
    settings = get_settings()

    with TestClient(app) as c:
        c.headers.update({"X-API-Key": settings.api_key})
        yield c

    cm.close()


def test_get_full_review_session(test_client):
    """Verifica que /api/review/session/full devuelve la sesión del día con HTML y lista de media."""
    res = test_client.get("/api/review/session/full")
    assert res.status_code == 200
    data = res.json()

    assert "cards" in data
    assert "remaining" in data
    assert "media" in data
    assert "date" in data

    assert len(data["cards"]) >= 1
    card = data["cards"][0]
    assert card["question_html"] is not None
    assert card["answer_html"] is not None
    assert len(card["question_html"]) > 0

    # Media filenames extracted
    assert "test_audio.mp3" in data["media"]
    assert "test_image.png" in data["media"]


def test_media_serving_and_security(test_client):
    """Verifica el endpoint /api/media/{filename} incluyendo seguridad contra path traversal."""
    # 1. Archivo existente
    res = test_client.get("/api/media/test_audio.mp3")
    assert res.status_code == 200
    assert res.content == b"fake mp3 audio content"

    # 2. Archivo inexistente
    res_404 = test_client.get("/api/media/nonexistent_file.png")
    assert res_404.status_code == 404

    # 3. Path traversal attack bloqueado
    res_traversal = test_client.get("/api/media/../../etc/passwd")
    assert res_traversal.status_code in (400, 404)
