import os
import tempfile
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.collection_manager import CollectionManager
from app.config import get_settings

@pytest.fixture
def client():
    temp_dir = tempfile.mkdtemp()
    db_path = os.path.join(temp_dir, "test_api.anki2")
    cm = CollectionManager(db_path)
    cm.open()

    app.state.collection_manager = cm
    settings = get_settings()

    with TestClient(app) as c:
        c.headers.update({"X-API-Key": settings.api_key})
        yield c

    cm.close()

def test_health_check_no_auth():
    with TestClient(app) as c:
        res = c.get("/api/health")
        assert res.status_code == 200
        assert res.json() == {"status": "ok"}

def test_decks_crud(client):
    # 1. Create deck
    res = client.post("/api/decks/", json={"name": "Francés B1"})
    assert res.status_code == 200
    deck_data = res.json()
    assert deck_data["name"] == "Francés B1"
    deck_id = deck_data["id"]

    # 2. List decks
    res = client.get("/api/decks/")
    assert res.status_code == 200
    decks = res.json()["decks"]
    assert any(d["id"] == deck_id for d in decks)

    # 3. Rename deck
    res = client.patch(f"/api/decks/{deck_id}", json={"name": "Francés B2"})
    assert res.status_code == 200

    # 4. Delete deck
    res = client.delete(f"/api/decks/{deck_id}")
    assert res.status_code == 200

def test_notetypes_endpoint(client):
    res = client.get("/api/notetypes/")
    assert res.status_code == 200
    types = res.json()
    names = [t["name"] for t in types]
    assert "Basic" in names
    assert "FC_TypeAnswer" in names
    assert "FC_MultipleChoice" in names
    assert "FC_ScrambledSentence" in names

def test_create_and_review_flow(client):
    # 1. Create deck
    d_res = client.post("/api/decks/", json={"name": "Vocabulario"})
    deck_id = d_res.json()["id"]

    # 2. Create note
    n_res = client.post(
        "/api/notes/",
        json={
            "deck_id": deck_id,
            "note_type_name": "Basic",
            "fields": {"Front": "¿Hola?", "Back": "Hello"},
            "tags": ["saludos"],
        },
    )
    assert n_res.status_code == 200

    # 3. Check review queue
    q_res = client.get(f"/api/review/queue?deck_id={deck_id}&limit=10")
    assert q_res.status_code == 200
    cards = q_res.json()["cards"]
    assert len(cards) >= 1
    card_id = cards[0]["card_id"]
    assert cards[0]["fields"]["Front"] == "¿Hola?"

    # 4. Answer card with Good (3)
    a_res = client.post(
        "/api/review/answer",
        json={"card_id": card_id, "rating": 3},
    )
    assert a_res.status_code == 200
    assert a_res.json()["success"] is True

    # 5. Undo review
    u_res = client.post("/api/review/undo")
    assert u_res.status_code == 200
    assert u_res.json()["success"] is True

def test_batch_create_and_export_csv(client):
    # 1. Create deck
    d_res = client.post("/api/decks/", json={"name": "Lote Test"})
    deck_id = d_res.json()["id"]

    # 2. Batch create notes
    batch_res = client.post(
        "/api/notes/batch",
        json={
            "deck_id": deck_id,
            "notes": [
                {
                    "deck_id": deck_id,
                    "note_type_name": "Basic",
                    "fields": {"Front": "Uno", "Back": "One"},
                    "tags": ["números"],
                },
                {
                    "deck_id": deck_id,
                    "note_type_name": "FC_TypeAnswer",
                    "fields": {"Front": "Dos", "Back": "Two", "Language": "es-ES"},
                    "tags": ["números"],
                },
                {
                    "deck_id": deck_id,
                    "note_type_name": "FC_MultipleChoice",
                    "fields": {
                        "Question": "¿Qué número es 3?",
                        "CorrectAnswer": "Tres",
                        "WrongAnswer1": "Cuatro",
                        "WrongAnswer2": "Cinco",
                        "Language": "es-ES",
                    },
                    "tags": ["números"],
                },
            ],
            "allow_html": True,
            "existing_action": "add",
        },
    )
    assert batch_res.status_code == 200
    data = batch_res.json()
    assert data["success"] is True
    assert data["created"] == 3

    # 3. Export CSV
    export_res = client.get(f"/api/notes/export?deck_id={deck_id}")
    assert export_res.status_code == 200
    assert "text/csv" in export_res.headers["content-type"]
    csv_text = export_res.text
    assert "Uno" in csv_text
    assert "Dos" in csv_text
    assert "Tres" in csv_text


def test_review_queue_respects_daily_new_limit(client):
    # 1. Create deck "BMO" with default new.perDay = 20
    d_res = client.post("/api/decks/", json={"name": "BMO"})
    assert d_res.status_code == 200
    deck_id = d_res.json()["id"]

    # 2. Add 42 new cards
    notes_payload = [
        {
            "deck_id": deck_id,
            "note_type_name": "Basic",
            "fields": {"Front": f"Pregunta {i}", "Back": f"Respuesta {i}"},
            "tags": ["test_limit"],
        }
        for i in range(42)
    ]
    batch_res = client.post(
        "/api/notes/batch",
        json={"deck_id": deck_id, "notes": notes_payload, "allow_html": True, "existing_action": "add"},
    )
    assert batch_res.status_code == 200
    assert batch_res.json()["created"] == 42

    # 3. Query queue with limit=100 (must be capped by new.perDay = 20)
    q_res = client.get(f"/api/review/queue?deck_id={deck_id}&limit=100")
    assert q_res.status_code == 200
    data = q_res.json()

    # Cards returned and remaining must be capped at 20, not 42
    assert len(data["cards"]) <= 20
    assert len(data["cards"]) == 20
    assert data["remaining"] <= 20
    assert data["remaining"] == 20

    # 4. Answer 1 card with Easy (4) so it graduates and is no longer due today
    first_card_id = data["cards"][0]["card_id"]
    ans_res = client.post(
        "/api/review/answer",
        json={"card_id": first_card_id, "rating": 4},
    )
    assert ans_res.status_code == 200
    assert ans_res.json()["success"] is True

    # 5. Subsequent queue call within the same day must reflect 19 cards left (no extra new cards pulled from the 42 total)
    q_res2 = client.get(f"/api/review/queue?deck_id={deck_id}&limit=100")
    assert q_res2.status_code == 200
    data2 = q_res2.json()
    assert len(data2["cards"]) == 19
    assert data2["remaining"] == 19


