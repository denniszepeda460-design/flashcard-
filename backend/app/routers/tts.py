import logging
from fastapi import APIRouter, HTTPException, Response, Query
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

from app.services.edge_tts_service import (
    list_edge_voices,
    synthesize_edge_tts,
    detect_language,
    get_recommended_voice,
    resolve_voice_and_language,
    EDGE_VOICE_CATALOG,
)
from app.services.piper_service import (
    list_voices as list_piper_voices,
    download_voice as download_piper_voice,
    synthesize_to_wav_bytes,
    is_voice_installed,
    VOICE_CATALOG as PIPER_VOICE_CATALOG,
    get_piper_executable,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/tts", tags=["tts"])

class DownloadVoiceRequest(BaseModel):
    voice_id: str

class DetectLanguageRequest(BaseModel):
    text: str

class SynthesizeRequest(BaseModel):
    text: str
    voice_id: Optional[str] = "auto"
    engine: Optional[str] = "edge"  # "edge" | "piper"
    speed: Optional[float] = 1.0
    lang: Optional[str] = None

@router.get("/voices")
@router.get("/voices/")
async def get_voices(engine: str = Query("edge", description="Motor de voz: 'edge' o 'piper'")):
    """
    Devuelve la lista de voces disponibles según el motor seleccionado.
    Para Edge-TTS, incluye la opción especial 'auto' para detección inteligente.
    """
    if engine == "piper":
        has_piper = get_piper_executable() is not None
        return {
            "engine": "piper",
            "piper_available": has_piper,
            "voices": list_piper_voices(),
        }

    # Por defecto: Edge-TTS (Microsoft Neural Voices ultraclaras)
    edge_voices = [
        {
            "id": "auto",
            "name": "🌐 Detección Automática (Español, Inglés, Alemán...)",
            "locale": "auto",
            "lang_code": "auto",
            "gender": "Neutral",
            "recommended": True,
        }
    ] + list_edge_voices()

    return {
        "engine": "edge",
        "piper_available": get_piper_executable() is not None,
        "voices": edge_voices,
    }

@router.post("/detect-language")
@router.post("/detect-language/")
async def detect_language_endpoint(req: DetectLanguageRequest):
    """
    Detecta automáticamente el idioma de un texto con prioridad en Español, Inglés y Alemán.
    Devuelve también la voz recomendada de Edge-TTS correspondiente.
    """
    if not req.text or not req.text.strip():
        raise HTTPException(status_code=400, detail="El texto no puede estar vacío.")

    detected = detect_language(req.text)
    recommended_voice = get_recommended_voice(detected)
    return {
        "text": req.text.strip(),
        "detected_lang": detected,
        "recommended_voice": recommended_voice,
    }

@router.post("/download")
@router.post("/download/")
async def download_voice_endpoint(req: DownloadVoiceRequest):
    """Descarga un modelo de voz neuronal localmente para Piper TTS."""
    if req.voice_id not in PIPER_VOICE_CATALOG:
        raise HTTPException(status_code=404, detail="Voz no encontrada en el catálogo de Piper.")
    try:
        download_piper_voice(req.voice_id)
        return {"success": True, "message": f"Voz {req.voice_id} descargada correctamente."}
    except Exception as e:
        logger.error(f"Error descargando voz Piper: {e}")
        raise HTTPException(status_code=500, detail=f"Error descargando voz: {str(e)}")

@router.post("/synthesize")
@router.post("/synthesize/")
async def synthesize_endpoint(req: SynthesizeRequest):
    """
    Genera audio para el texto proporcionado.
    Soporta 'edge' (Edge-TTS ultraclaro, MP3) y 'piper' (Piper offline, WAV).
    Si voice_id es 'auto' o no se especifica, detecta el idioma automáticamente.
    """
    clean_text = req.text.strip() if req.text else ""
    if not clean_text:
        raise HTTPException(status_code=400, detail="El texto a sintetizar no puede estar vacío.")

    speed = req.speed if req.speed and req.speed > 0 else 1.0
    engine = (req.engine or "edge").lower()
    voice_id = req.voice_id or "auto"

    # ==========================
    # 1. MOTOR EDGE-TTS (PREDETERMINADO, ULTRACLARO)
    # ==========================
    if engine != "piper":
        try:
            chosen_voice, detected_lang = resolve_voice_and_language(clean_text, voice_id)
            audio_bytes = await synthesize_edge_tts(clean_text, voice_id=chosen_voice, speed=speed)
            return Response(
                content=audio_bytes,
                media_type="audio/mpeg",
                headers={
                    "X-TTS-Engine": "edge-tts",
                    "X-Detected-Language": detected_lang,
                    "X-Selected-Voice": chosen_voice,
                }
            )
        except Exception as edge_err:
            logger.warning(f"Error con Edge-TTS: {edge_err}. Intentando fallback local si es posible.")
            # Si Edge-TTS falla (ej. sin internet), intentar fallback con Piper si está disponible
            if get_piper_executable() is not None:
                try:
                    detected_lang = detect_language(clean_text)
                    piper_voice = "es_ES-davefx-medium" if detected_lang == "es" else (
                        "en_US-lessac-medium" if detected_lang == "en" else "de_DE-eva_k-medium"
                    )
                    if not is_voice_installed(piper_voice):
                        piper_voice = "es_ES-carlfm-x_low"
                    length_scale = round(1.0 / speed, 2)
                    wav_bytes = synthesize_to_wav_bytes(clean_text, voice_id=piper_voice, length_scale=length_scale)
                    return Response(content=wav_bytes, media_type="audio/wav", headers={"X-TTS-Engine": "piper-fallback"})
                except Exception:
                    pass
            raise HTTPException(
                status_code=500,
                detail=f"Error en síntesis con Edge-TTS: {str(edge_err)}"
            )

    # ==========================
    # 2. MOTOR PIPER TTS (OFFLINE)
    # ==========================
    try:
        # Si voice_id es auto o no se especificó, seleccionar según el idioma detectado
        if voice_id == "auto":
            detected_lang = detect_language(clean_text)
            if detected_lang == "en":
                voice_id = "en_US-lessac-medium" if is_voice_installed("en_US-lessac-medium") else "es_ES-carlfm-x_low"
            elif detected_lang == "de":
                voice_id = "de_DE-eva_k-medium" if is_voice_installed("de_DE-eva_k-medium") else "es_ES-carlfm-x_low"
            else:
                voice_id = "es_ES-davefx-medium" if is_voice_installed("es_ES-davefx-medium") else "es_ES-carlfm-x_low"

        length_scale = round(1.0 / speed, 2)
        wav_bytes = synthesize_to_wav_bytes(clean_text, voice_id=voice_id, length_scale=length_scale)
        return Response(content=wav_bytes, media_type="audio/wav", headers={"X-TTS-Engine": "piper"})
    except Exception as piper_err:
        logger.error(f"Error en síntesis con Piper: {piper_err}")
        raise HTTPException(status_code=500, detail=f"Error en síntesis con Piper: {str(piper_err)}")
