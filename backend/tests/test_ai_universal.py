import os
import tempfile
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.collection_manager import CollectionManager
from app.config import get_settings
from app.services.gemini_service import _normalize_cards
from app.services.edge_tts_service import synthesize_edge_tts, detect_language

@pytest.fixture
def test_client():
    temp_dir = tempfile.mkdtemp()
    db_path = os.path.join(temp_dir, "test_universal.anki2")
    cm = CollectionManager(db_path)
    cm.open()

    app.state.collection_manager = cm
    settings = get_settings()

    with TestClient(app) as c:
        c.headers.update({"X-API-Key": settings.api_key})
        yield c

    cm.close()

def test_universal_ai_card_normalization_and_detection():
    """
    Prueba universal del pipeline de normalización de tarjetas generadas con IA:
    - Reconocimiento y mapeo de FC_Dictation
    - Detección precisa de los 3 idiomas clave: Español, Inglés y Alemán
    - Asignación de la voz de Edge-TTS correspondiente
    """
    ai_raw_output = {
        "cards": [
            # 1. Dictado en Inglés
            {
                "type": "dictation",
                "fields": {
                    "audio_text": "Practice makes perfect when learning a new language.",
                    "translation": "La práctica hace al maestro."
                },
                "tags": ["ingles", "proverbios"]
            },
            # 2. Dictado en Alemán
            {
                "type": "FC_Dictation",
                "fields": {
                    "sentence": "Ich möchte einen Kaffee bitte.",
                    "pista": "Quisiera un café por favor."
                },
                "tags": ["aleman", "restaurante"]
            },
            # 3. Dictado en Español
            {
                "type": "dictado",
                "fields": {
                    "AudioText": "¿A qué hora sale el tren hacia Madrid?",
                    "Translation": "Pregunta de viaje en español"
                },
                "tags": ["espanol", "viaje"]
            },
            # 4. Teclear respuesta (TypeAnswer) en Inglés
            {
                "type": "typeanswer",
                "fields": {
                    "front": "Perro",
                    "back": "dog"
                }
            },
            # 5. Teclear respuesta en Alemán
            {
                "type": "FC_TypeAnswer",
                "fields": {
                    "front": "¿Cómo se dice manzana en alemán?",
                    "back": "der Apfel"
                }
            },
            # 6. Ordenar frase (ScrambledSentence) en Alemán
            {
                "type": "FC_ScrambledSentence",
                "fields": {
                    "sentence": "Heute ist das Wetter sehr schön.",
                    "translation": "Hoy el tiempo está muy bonito."
                }
            }
        ]
    }

    normalized = _normalize_cards(ai_raw_output)
    assert len(normalized) == 6

    # 1. Dictado en Inglés
    card1 = normalized[0]
    assert card1["note_type_name"] == "FC_Dictation"
    assert card1["fields"]["AudioText"] == "Practice makes perfect when learning a new language."
    assert card1["fields"]["Translation"] == "La práctica hace al maestro."
    assert card1["fields"]["Language"] == "en-US"
    assert card1["fields"]["Voice"] == "en-US-JennyNeural"

    # 2. Dictado en Alemán
    card2 = normalized[1]
    assert card2["note_type_name"] == "FC_Dictation"
    assert card2["fields"]["AudioText"] == "Ich möchte einen Kaffee bitte."
    assert card2["fields"]["Language"] == "de-DE"
    assert card2["fields"]["Voice"] == "de-DE-KatjaNeural"

    # 3. Dictado en Español
    card3 = normalized[2]
    assert card3["note_type_name"] == "FC_Dictation"
    assert card3["fields"]["Language"] == "es-ES"
    assert card3["fields"]["Voice"] == "es-ES-AlvaroNeural"

    # 4. Teclear en Inglés
    card4 = normalized[3]
    assert card4["note_type_name"] == "FC_TypeAnswer"
    assert card4["fields"]["Language"] == "en-US"
    assert card4["fields"]["Voice"] == "en-US-JennyNeural"

    # 5. Teclear en Alemán
    card5 = normalized[4]
    assert card5["note_type_name"] == "FC_TypeAnswer"
    assert card5["fields"]["Language"] == "de-DE"
    assert card5["fields"]["Voice"] == "de-DE-KatjaNeural"

    # 6. Ordenar en Alemán
    card6 = normalized[5]
    assert card6["note_type_name"] == "FC_ScrambledSentence"
    assert card6["fields"]["Language"] == "de-DE"
    assert card6["fields"]["Voice"] == "de-DE-KatjaNeural"

def test_universal_batch_creation_and_database_persistence(test_client):
    """
    Prueba que las tarjetas generadas (incluyendo FC_Dictation) se guardan
    correctamente en la base de datos de Anki mediante /api/notes/batch.
    """
    # 1. Obtener o crear mazo
    res_deck = test_client.post("/api/decks/", json={"name": "Mazo Universal Políglota"})
    assert res_deck.status_code == 200
    deck_id = res_deck.json()["id"]

    # 2. Preparar tarjetas generadas
    notes_payload = [
        {
            "deck_id": deck_id,
            "note_type_name": "FC_Dictation",
            "fields": {
                "AudioText": "Good evening, ladies and gentlemen.",
                "Translation": "Buenas noches, damas y caballeros.",
                "Language": "en-US",
                "Voice": "en-US-JennyNeural"
            },
            "tags": ["ia-test", "dictado-en"]
        },
        {
            "deck_id": deck_id,
            "note_type_name": "FC_Dictation",
            "fields": {
                "AudioText": "Entschuldigung, wo ist der Bahnhof?",
                "Translation": "Disculpe, ¿dónde está la estación?",
                "Language": "de-DE",
                "Voice": "de-DE-KatjaNeural"
            },
            "tags": ["ia-test", "dictado-de"]
        },
        {
            "deck_id": deck_id,
            "note_type_name": "FC_TypeAnswer",
            "fields": {
                "Front": "Gato",
                "Back": "cat",
                "Language": "en-US",
                "Voice": "en-US-JennyNeural"
            },
            "tags": ["ia-test", "teclear"]
        }
    ]

    # 3. Guardar lote
    res_batch = test_client.post("/api/notes/batch", json={"deck_id": deck_id, "notes": notes_payload})
    assert res_batch.status_code == 200
    batch_data = res_batch.json()
    assert batch_data["created"] == 3

    # 4. Verificar que existen en el mazo para estudiar
    res_due = test_client.get(f"/api/review/queue?deck_id={deck_id}")
    assert res_due.status_code == 200
    queue_data = res_due.json()
    cards_due = queue_data["cards"]
    assert len(cards_due) >= 3

    dictation_card = next((c for c in cards_due if "dictat" in c["note_type_name"].lower()), None)
    assert dictation_card is not None
    assert dictation_card["fields"]["AudioText"] in (
        "Good evening, ladies and gentlemen.",
        "Entschuldigung, wo ist der Bahnhof?"
    )

@pytest.mark.asyncio
async def test_universal_edge_tts_synthesis_flow():
    """
    Prueba que Edge-TTS sintetiza audios válidos y nítidos para las tarjetas
    en los 3 idiomas con detección automática o voz fija.
    """
    # Español
    audio_es = await synthesize_edge_tts("Hola, bienvenidos al estudio diario de tarjetas.", voice_id="auto")
    assert len(audio_es) > 1000

    # Inglés
    audio_en = await synthesize_edge_tts("Welcome to your flashcard practice session.", voice_id="auto")
    assert len(audio_en) > 1000

    # Alemán
    audio_de = await synthesize_edge_tts("Herzlich willkommen zu Ihrer Deutsch-Übung.", voice_id="auto")
    assert len(audio_de) > 1000
