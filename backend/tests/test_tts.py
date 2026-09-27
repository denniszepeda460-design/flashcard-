import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.edge_tts_service import (
    detect_language,
    resolve_voice_and_language,
    get_recommended_voice,
    EDGE_VOICE_CATALOG,
)

AUTH_HEADERS = {"X-API-Key": "mi-clave-secreta-123"}

def test_language_detection_vocabulary():
    """Prueba que el detector clasifica con precisión palabras de flashcards."""
    # 1. Alemán
    assert detect_language("Entschuldigung") == "de"
    assert detect_language("Guten Morgen") == "de"
    assert detect_language("hund") == "de"
    assert detect_language("katze") == "de"
    assert detect_language("apfel") == "de"
    assert detect_language("schön") == "de"
    assert detect_language("Straße") == "de"

    # 2. Inglés
    assert detect_language("dog") == "en"
    assert detect_language("cat") == "en"
    assert detect_language("apple") == "en"
    assert detect_language("Thank you very much") == "en"
    assert detect_language("The quick brown fox") == "en"
    assert detect_language("good morning") == "en"

    # 3. Español
    assert detect_language("perro") == "es"
    assert detect_language("gato") == "es"
    assert detect_language("manzana") == "es"
    assert detect_language("¿Cómo te va?") == "es"
    assert detect_language("¡Buenos días!") == "es"
    assert detect_language("árbol") == "es"
    assert detect_language("Hola mundo") == "es"

def test_resolve_voice_and_language():
    """Verifica que la resolución automática asigna la voz correcta."""
    voice_de, lang_de = resolve_voice_and_language("Guten Tag", "auto")
    assert lang_de == "de"
    assert voice_de == "de-DE-KatjaNeural"

    voice_en, lang_en = resolve_voice_and_language("Welcome home", "auto")
    assert lang_en == "en"
    assert voice_en == "en-US-JennyNeural"

    voice_es, lang_es = resolve_voice_and_language("Muchas gracias", "auto")
    assert lang_es == "es"
    assert voice_es == "es-ES-AlvaroNeural"

    # Voz explícita
    explicit_voice, explicit_lang = resolve_voice_and_language("Hello", "es-ES-ElviraNeural")
    assert explicit_voice == "es-ES-ElviraNeural"
    assert explicit_lang == "es"

def test_get_voices_endpoint():
    """Verifica el endpoint GET /api/tts/voices."""
    client = TestClient(app, headers=AUTH_HEADERS)
    res = client.get("/api/tts/voices?engine=edge")
    assert res.status_code == 200
    data = res.json()
    assert data["engine"] == "edge"
    voices = data["voices"]
    assert len(voices) > 10

    # Opción 'auto' debe estar presente y ser recomendada
    auto_option = next((v for v in voices if v["id"] == "auto"), None)
    assert auto_option is not None
    assert auto_option["recommended"] is True

    # Voces clave de los 3 idiomas deben estar presentes
    voice_ids = {v["id"] for v in voices}
    assert "es-ES-AlvaroNeural" in voice_ids
    assert "en-US-JennyNeural" in voice_ids
    assert "de-DE-KatjaNeural" in voice_ids

def test_detect_language_endpoint():
    """Verifica el endpoint POST /api/tts/detect-language."""
    client = TestClient(app, headers=AUTH_HEADERS)
    res = client.post("/api/tts/detect-language", json={"text": "Wasser und Brot"})
    assert res.status_code == 200
    data = res.json()
    assert data["detected_lang"] == "de"
    assert data["recommended_voice"] == "de-DE-KatjaNeural"

    res_en = client.post("/api/tts/detect-language", json={"text": "A cup of coffee"})
    assert res_en.status_code == 200
    assert res_en.json()["detected_lang"] == "en"

def test_synthesize_endpoint_edge():
    """Verifica la síntesis con Edge-TTS para textos en los 3 idiomas principales."""
    client = TestClient(app, headers=AUTH_HEADERS)

    # 1. Español (auto)
    res_es = client.post("/api/tts/synthesize", json={"text": "Buenos días a todos", "voice_id": "auto"})
    assert res_es.status_code == 200
    assert res_es.headers.get("content-type") == "audio/mpeg"
    assert res_es.headers.get("X-Detected-Language") == "es"
    assert res_es.headers.get("X-Selected-Voice") == "es-ES-AlvaroNeural"
    assert len(res_es.content) > 1000

    # 2. Inglés (auto)
    res_en = client.post("/api/tts/synthesize", json={"text": "Learning languages with flashcards is fun", "voice_id": "auto"})
    assert res_en.status_code == 200
    assert res_en.headers.get("content-type") == "audio/mpeg"
    assert res_en.headers.get("X-Detected-Language") == "en"
    assert res_en.headers.get("X-Selected-Voice") == "en-US-JennyNeural"
    assert len(res_en.content) > 1000

    # 3. Alemán (auto)
    res_de = client.post("/api/tts/synthesize", json={"text": "Ich lerne jeden Tag Deutsch", "voice_id": "auto"})
    assert res_de.status_code == 200
    assert res_de.headers.get("content-type") == "audio/mpeg"
    assert res_de.headers.get("X-Detected-Language") == "de"
    assert res_de.headers.get("X-Selected-Voice") == "de-DE-KatjaNeural"
    assert len(res_de.content) > 1000
