import os
import json
import urllib.request
import urllib.error
import time
from typing import List, Dict, Any, Optional

from app.services.edge_tts_service import (
    detect_language,
    get_recommended_voice,
)

DEFAULT_GEMINI_API_KEYS = [
    "AIzaSyCcubEdOhK8DfITp0kTZRZr79vNACxeClw",
    "AIzaSyDTgUnZ2RT8YYjGY17lSFijI7Ip7STK0JM",
    "AIzaSyAyC_ci81MiIMIKJX77UwrLN-A0IM6fHd0",
    "AIzaSyDA-zTXxqJCXWsuVhKJ2uGB8CqlRjZ9PMI",
    "AIzaSyDr0usg7BWq_-MYWbtj-55RrdhiRaS9Sv0",
    "AIzaSyAliXIA_tl5Qgz3JmO7A-lVK7ZomSHDX4w",
]

def load_gemini_keys() -> List[str]:
    env_keys_raw = os.getenv("GEMINI_API_KEYS", "")
    if env_keys_raw:
        if env_keys_raw.strip().startswith("["):
            try:
                parsed = json.loads(env_keys_raw)
                keys = [str(k).strip() for k in parsed if str(k).strip()]
            except Exception:
                keys = [k.strip() for k in env_keys_raw.split(",") if k.strip()]
        else:
            keys = [k.strip() for k in env_keys_raw.split(",") if k.strip()]
    else:
        keys = list(DEFAULT_GEMINI_API_KEYS)

    # Solo conservar claves de AI Studio válidas con formato estándar
    valid_keys = [k for k in keys if k.startswith("AIzaSy") and len(k) > 20]
    return valid_keys if valid_keys else DEFAULT_GEMINI_API_KEYS

class GeminiKeyRotator:
    def __init__(self, keys: List[str]):
        self.keys = keys
        self.current_index = 0

    def get_current_key(self) -> str:
        if not self.keys:
            raise RuntimeError("No hay claves de API de Gemini configuradas.")
        return self.keys[self.current_index % len(self.keys)]

    def rotate_key(self) -> str:
        if not self.keys:
            raise RuntimeError("No hay claves de API de Gemini configuradas.")
        self.current_index = (self.current_index + 1) % len(self.keys)
        print(f"[GeminiRotator] Rotando a API Key #{self.current_index + 1} de {len(self.keys)}")
        return self.get_current_key()

rotator = GeminiKeyRotator(load_gemini_keys())

def _normalize_cards(cards_raw: Any) -> List[Dict[str, Any]]:
    """
    Normaliza la salida del modelo a la estructura esperada por la app.
    Detecta automáticamente el idioma y asigna la voz de Edge-TTS idónea.
    """
    if isinstance(cards_raw, dict):
        cards_list = cards_raw.get("cards") or cards_raw.get("flashcards") or []
        if not cards_list and ("Front" in cards_raw or "front" in cards_raw or "AudioText" in cards_raw or "audiotext" in cards_raw):
            cards_list = [cards_raw]
    elif isinstance(cards_raw, list):
        cards_list = cards_raw
    else:
        return []

    normalized = []
    for c in cards_list:
        if not isinstance(c, dict):
            continue

        raw_type = (c.get("note_type_name") or c.get("type") or "Basic").strip()
        # Normalizar nombres de tipos de nota
        if raw_type.lower() in ("fc_dictation", "dictation", "dictado", "audiotext"):
            note_type = "FC_Dictation"
        elif raw_type.lower() in ("fc_typeanswer", "typeanswer", "type_answer", "teclear"):
            note_type = "FC_TypeAnswer"
        elif raw_type.lower() in ("fc_multiplechoice", "multiplechoice", "multiple_choice", "opcion_multiple"):
            note_type = "FC_MultipleChoice"
        elif raw_type.lower() in ("fc_scrambledsentence", "scrambledsentence", "scrambled_sentence", "ordenar"):
            note_type = "FC_ScrambledSentence"
        elif "reversed" in raw_type.lower() or "invertida" in raw_type.lower():
            note_type = "Basic (and reversed card)"
        else:
            note_type = "Basic"

        raw_fields = c.get("fields")
        if not isinstance(raw_fields, dict):
            raw_fields = {
                k: str(v)
                for k, v in c.items()
                if k not in ("note_type_name", "type", "tags")
            }

        fields: Dict[str, str] = {}
        for k, v in raw_fields.items():
            fields[str(k)] = str(v)

        # Normalizar mayúsculas en campos estándar
        if "front" in fields and "Front" not in fields:
            fields["Front"] = fields.pop("front")
        if "back" in fields and "Back" not in fields:
            fields["Back"] = fields.pop("back")
        if "question" in fields and "Question" not in fields:
            fields["Question"] = fields.pop("question")
        if "sentence" in fields and "Sentence" not in fields:
            fields["Sentence"] = fields.pop("sentence")
        if "audiotext" in fields and "AudioText" not in fields:
            fields["AudioText"] = fields.pop("audiotext")
        if "audio_text" in fields and "AudioText" not in fields:
            fields["AudioText"] = fields.pop("audio_text")
        if "translation" in fields and "Translation" not in fields:
            fields["Translation"] = fields.pop("translation")
        if "pista" in fields and "Translation" not in fields:
            fields["Translation"] = fields.pop("pista")
        if "hint" in fields and "Translation" not in fields:
            fields["Translation"] = fields.pop("hint")

        # Ajustes de campos específicos para FC_Dictation
        if note_type == "FC_Dictation":
            if "AudioText" not in fields:
                fields["AudioText"] = fields.pop("Sentence", "") or fields.pop("Front", "") or fields.pop("Question", "") or fields.get("Back", "")
            if "Translation" not in fields:
                fields["Translation"] = fields.pop("Back", "") or fields.pop("Answer", "") or ""

        # Detección inteligente de idioma para la tarjeta
        # Evaluar el texto principal de aprendizaje
        text_to_eval = ""
        if note_type == "FC_Dictation":
            text_to_eval = fields.get("AudioText", "")
        elif note_type == "FC_ScrambledSentence":
            text_to_eval = fields.get("Sentence", "")
        elif note_type == "FC_TypeAnswer":
            # Si Back es una sola palabra en inglés/alemán, suele ser el término clave
            text_to_eval = fields.get("Back", "") or fields.get("Front", "")
        elif note_type == "FC_MultipleChoice":
            text_to_eval = fields.get("CorrectAnswer", "") or fields.get("Question", "")
        else:
            text_to_eval = fields.get("Front", "") or fields.get("Back", "")

        # Validar o detectar el idioma si no viene o viene genérico
        lang_field = fields.get("Language", "").strip()
        if not lang_field or lang_field.lower() in ("auto", "none", ""):
            detected = detect_language(text_to_eval)
            lang_map = {
                "es": "es-ES",
                "en": "en-US",
                "de": "de-DE",
                "fr": "fr-FR",
                "it": "it-IT",
                "pt": "pt-BR",
                "ja": "ja-JP",
            }
            lang_field = lang_map.get(detected, "es-ES")
            fields["Language"] = lang_field
        else:
            # Normalizar códigos cortos (ej. 'en' -> 'en-US', 'de' -> 'de-DE', 'es' -> 'es-ES')
            clean_code = lang_field.split("-")[0].lower()
            if clean_code == "en" and "-" not in lang_field:
                fields["Language"] = "en-US"
            elif clean_code == "de" and "-" not in lang_field:
                fields["Language"] = "de-DE"
            elif clean_code == "es" and "-" not in lang_field:
                fields["Language"] = "es-ES"

        # Asignar la voz ultraclara de Edge-TTS idónea según el idioma detectado
        norm_lang = fields.get("Language", "es-ES")
        recommended_voice = get_recommended_voice(norm_lang)
        fields["Voice"] = recommended_voice

        raw_tags = c.get("tags", [])
        if isinstance(raw_tags, str):
            tags = [t.strip() for t in raw_tags.split(",") if t.strip()]
        elif isinstance(raw_tags, list):
            tags = [str(t) for t in raw_tags if t]
        else:
            tags = []

        normalized.append({
            "note_type_name": note_type,
            "fields": fields,
            "tags": tags,
        })

    return normalized

def generate_flashcards_with_ai(text: str, card_mode: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Genera y clasifica automáticamente flashcards con inteligencia artificial.
    Detecta automáticamente el idioma (Español, Inglés, Alemán y otros) y asigna
    el tipo de tarjeta más didáctico, incluyendo la nueva tarjeta de Dictado ('FC_Dictation').
    """
    dictation_instruction = (
        "1. 'FC_Dictation': tarjeta de dictado y comprensión auditiva ('Escuchar y Escribir'). "
        "INTEGRACIÓN ESENCIAL: Úsala para frases, oraciones completas, expresiones idiomáticas o vocabulario en idiomas extranjeros (Inglés, Alemán, Español, etc.) donde escuchar la pronunciación y escribir correctamente sea clave. "
        "Campos obligatorios: {'AudioText': 'frase u oración a escuchar y escribir en el idioma objetivo', 'Translation': 'traducción o pista contextual en español', 'Language': 'en-US' | 'de-DE' | 'es-ES'}.\n"
    )

    if card_mode == "dictation_only":
        mode_instruction = (
            "MODO ESPECÍFICO: Genera tarjetas de tipo 'FC_Dictation' para todo el contenido proporcionado. "
            "Cada tarjeta debe tener: 'AudioText' (la frase u oración en el idioma correspondiente), 'Translation' (traducción en español) y 'Language' ('en-US', 'de-DE', 'es-ES', etc.)."
        )
    else:
        mode_instruction = (
            "SISTEMA INTEGRADO Y EQUILIBRADO: La IA integra de forma natural y unificada todos los formatos didácticos en un solo flujo inteligente:\n"
            f"{dictation_instruction}"
            "2. 'FC_TypeAnswer': para palabras sueltas de vocabulario, fechas o términos técnicos exactos donde escribir letra por letra refuerce la memoria ortográfica. "
            "Campos: {'Front': 'pregunta/término', 'Back': 'respuesta exacta', 'Language': 'es-ES' | 'en-US' | 'de-DE'}.\n"
            "3. 'FC_MultipleChoice': para conceptos con opciones, preguntas teóricas o posibles confusiones. "
            "Campos: {'Question': 'pregunta', 'CorrectAnswer': 'opción correcta', 'WrongAnswer1': 'distractor 1', 'WrongAnswer2': 'distractor 2', 'WrongAnswer3': 'distractor 3', 'Language': 'es-ES'}.\n"
            "4. 'FC_ScrambledSentence': para orden gramatical de oraciones en idiomas. "
            "Campos: {'Sentence': 'oración completa en orden correcto', 'Translation': 'pista o traducción', 'Language': 'en-US' | 'de-DE' | 'es-ES'}.\n"
            "5. 'Basic': para explicaciones teóricas, definiciones y conceptos generales. "
            "Campos: {'Front': 'pregunta/concepto', 'Back': 'explicación/respuesta'}.\n"
            "6. 'Basic (and reversed card)': para pares bidireccionales directos (ej. país y capital, sinónimos). "
            "Campos: {'Front': 'concepto A', 'Back': 'concepto B'}."
        )

    system_prompt = (
        "Eres un arquitecto pedagógico de flashcards con repetición espaciada FSRS y lingüista experto. "
        "Analiza el texto, apuntes, archivo CSV, TSV o lista proporcionada por el usuario y genera un conjunto óptimo de tarjetas de estudio.\n\n"
        "REGLAS CRÍTICAS DE DETECCIÓN DE IDIOMA:\n"
        "1. Detecta inteligentemente el idioma del contenido a estudiar con estricta prioridad:\n"
        "   - Español ('es-ES')\n"
        "   - Inglés ('en-US')\n"
        "   - Alemán ('de-DE')\n"
        "   - Otros idiomas si aplica ('fr-FR', 'it-IT', etc.).\n"
        "2. En TODAS las tarjetas de idiomas (dictado, vocabulario, oraciones, etc.), incluye SIEMPRE el campo 'Language' con el código correcto ('en-US', 'de-DE', 'es-ES', etc.).\n\n"
        f"{mode_instruction}\n\n"
        "Responde ÚNICAMENTE con un objeto JSON válido (sin texto extra antes ni después ni explicaciones fuera del JSON), con esta estructura exacta:\n"
        "{\n"
        '  "cards": [\n'
        '    {\n'
        '      "note_type_name": "FC_Dictation",\n'
        '      "fields": {\n'
        '        "AudioText": "The early bird catches the worm.",\n'
        '        "Translation": "A quien madruga, Dios le ayuda.",\n'
        '        "Language": "en-US"\n'
        '      },\n'
        '      "tags": ["idiomas", "ingles"]\n'
        '    },\n'
        '    {\n'
        '      "note_type_name": "FC_TypeAnswer",\n'
        '      "fields": {\n'
        '        "Front": "¿Cómo se dice perro en alemán?",\n'
        '        "Back": "der Hund",\n'
        '        "Language": "de-DE"\n'
        '      },\n'
        '      "tags": ["vocabulario", "aleman"]\n'
        '    }\n'
        '  ]\n'
        "}"
    )

    models_to_try = ["gemini-2.5-flash", "gemini-flash-latest"]
    total_keys = len(rotator.keys)
    max_attempts = total_keys * len(models_to_try) * 2
    attempts = 0
    last_error = ""

    while attempts < max_attempts:
        api_key = rotator.get_current_key()
        model_name = models_to_try[attempts % len(models_to_try)]
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"

        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": f"{system_prompt}\n\nTexto del usuario para generar flashcards:\n\"\"\"\n{text[:40000]}\n\"\"\""}
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0.2,
                "responseMimeType": "application/json",
            }
        }

        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=40) as response:
                res_data = json.loads(response.read().decode("utf-8"))
                candidates = res_data.get("candidates", [])
                if not candidates:
                    raise Exception("No se recibieron candidatos de Gemini")

                raw_text = candidates[0]["content"]["parts"][0]["text"].strip()
                # Limpiar bloques markdown si vinieran
                if raw_text.startswith("```json"):
                    raw_text = raw_text[7:]
                if raw_text.startswith("```"):
                    raw_text = raw_text[3:]
                if raw_text.endswith("```"):
                    raw_text = raw_text[:-3]

                parsed = json.loads(raw_text.strip())
                cards = _normalize_cards(parsed)
                print(f"[GeminiRotator] Generadas con éxito {len(cards)} flashcards con API Key #{rotator.current_index + 1} usando {model_name}")
                return cards

        except urllib.error.HTTPError as e:
            error_body = e.read().decode("utf-8", errors="ignore")
            last_error = f"HTTP {e.code}: {error_body[:150]}"
            print(f"[GeminiRotator] Error HTTP {e.code} con key #{rotator.current_index + 1} ({model_name}): {error_body[:120]}")

            # Rotar de clave ante 429 (cuota/rate limit), 403, 503 (sobrecarga temporal) o 400
            if e.code in (429, 403, 400, 503) or "RESOURCE_EXHAUSTED" in error_body or "quota" in error_body.lower():
                rotator.rotate_key()
                if e.code == 503:
                    time.sleep(0.5)
            elif e.code == 404:
                rotator.rotate_key()
            else:
                rotator.rotate_key()
            attempts += 1

        except Exception as e:
            last_error = str(e)
            print(f"[GeminiRotator] Excepción al invocar Gemini (key #{rotator.current_index + 1}): {e}")
            rotator.rotate_key()
            attempts += 1

    raise Exception(f"Se agotaron los intentos con las claves de Gemini disponibles. Último error: {last_error}")
