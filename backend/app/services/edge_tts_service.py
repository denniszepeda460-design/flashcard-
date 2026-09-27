import asyncio
import io
import re
from typing import Dict, List, Any, Optional, Tuple
import edge_tts
import langdetect

# Curated catalog of Microsoft Edge Neural voices prioritizing clarity and natural pronunciation
EDGE_VOICE_CATALOG: Dict[str, Dict[str, Any]] = {
    # 1. ESPAÑOL (Prioritario)
    "es-ES-AlvaroNeural": {
        "id": "es-ES-AlvaroNeural",
        "name": "Español (España) - Álvaro (Masculino, Muy Claro)",
        "locale": "es-ES",
        "lang_code": "es",
        "gender": "Male",
        "recommended": True,
    },
    "es-ES-ElviraNeural": {
        "id": "es-ES-ElviraNeural",
        "name": "Español (España) - Elvira (Femenino, Natural)",
        "locale": "es-ES",
        "lang_code": "es",
        "gender": "Female",
        "recommended": True,
    },
    "es-MX-DaliaNeural": {
        "id": "es-MX-DaliaNeural",
        "name": "Español (México) - Dalia (Femenino, Neutro)",
        "locale": "es-MX",
        "lang_code": "es",
        "gender": "Female",
        "recommended": True,
    },
    "es-MX-JorgeNeural": {
        "id": "es-MX-JorgeNeural",
        "name": "Español (México) - Jorge (Masculino)",
        "locale": "es-MX",
        "lang_code": "es",
        "gender": "Male",
        "recommended": False,
    },

    # 2. INGLÉS (Prioritario)
    "en-US-JennyNeural": {
        "id": "en-US-JennyNeural",
        "name": "English (US) - Jenny (Female, Crystal Clear)",
        "locale": "en-US",
        "lang_code": "en",
        "gender": "Female",
        "recommended": True,
    },
    "en-US-GuyNeural": {
        "id": "en-US-GuyNeural",
        "name": "English (US) - Guy (Male, Natural)",
        "locale": "en-US",
        "lang_code": "en",
        "gender": "Male",
        "recommended": False,
    },
    "en-GB-SoniaNeural": {
        "id": "en-GB-SoniaNeural",
        "name": "English (UK) - Sonia (Female, British Clear)",
        "locale": "en-GB",
        "lang_code": "en",
        "gender": "Female",
        "recommended": True,
    },
    "en-GB-RyanNeural": {
        "id": "en-GB-RyanNeural",
        "name": "English (UK) - Ryan (Male, British)",
        "locale": "en-GB",
        "lang_code": "en",
        "gender": "Male",
        "recommended": False,
    },

    # 3. ALEMÁN (Prioritario)
    "de-DE-KatjaNeural": {
        "id": "de-DE-KatjaNeural",
        "name": "Deutsch (Deutschland) - Katja (Weiblich, Sehr Klar)",
        "locale": "de-DE",
        "lang_code": "de",
        "gender": "Female",
        "recommended": True,
    },
    "de-DE-ConradNeural": {
        "id": "de-DE-ConradNeural",
        "name": "Deutsch (Deutschland) - Conrad (Männlich, Natürlich)",
        "locale": "de-DE",
        "lang_code": "de",
        "gender": "Male",
        "recommended": True,
    },
    "de-DE-KillianNeural": {
        "id": "de-DE-KillianNeural",
        "name": "Deutsch (Deutschland) - Killian (Männlich)",
        "locale": "de-DE",
        "lang_code": "de",
        "gender": "Male",
        "recommended": False,
    },

    # 4. OTROS IDIOMAS DESTACADOS
    "fr-FR-DeniseNeural": {
        "id": "fr-FR-DeniseNeural",
        "name": "Français (France) - Denise (Féminin, Claire)",
        "locale": "fr-FR",
        "lang_code": "fr",
        "gender": "Female",
        "recommended": True,
    },
    "fr-FR-HenriNeural": {
        "id": "fr-FR-HenriNeural",
        "name": "Français (France) - Henri (Masculin)",
        "locale": "fr-FR",
        "lang_code": "fr",
        "gender": "Male",
        "recommended": False,
    },
    "it-IT-ElsaNeural": {
        "id": "it-IT-ElsaNeural",
        "name": "Italiano (Italia) - Elsa (Femminile, Chiara)",
        "locale": "it-IT",
        "lang_code": "it",
        "gender": "Female",
        "recommended": True,
    },
    "pt-BR-FranciscaNeural": {
        "id": "pt-BR-FranciscaNeural",
        "name": "Português (Brasil) - Francisca (Feminino)",
        "locale": "pt-BR",
        "lang_code": "pt",
        "gender": "Female",
        "recommended": True,
    },
    "ja-JP-NanamiNeural": {
        "id": "ja-JP-NanamiNeural",
        "name": "日本語 (日本) - Nanami (女性, クリア)",
        "locale": "ja-JP",
        "lang_code": "ja",
        "gender": "Female",
        "recommended": True,
    },
}

DEFAULT_VOICE_PER_LANG: Dict[str, str] = {
    "es": "es-ES-AlvaroNeural",
    "en": "en-US-JennyNeural",
    "de": "de-DE-KatjaNeural",
    "fr": "fr-FR-DeniseNeural",
    "it": "it-IT-ElsaNeural",
    "pt": "pt-BR-FranciscaNeural",
    "ja": "ja-JP-NanamiNeural",
}

# High-precision vocabulary sets for instant single-word and short-phrase flashcard detection
COMMON_WORDS = {
    # 1. ALEMAN
    "de": {
        "der", "die", "das", "und", "ist", "sind", "war", "waren", "nicht", "ein", "eine", "einer", "eines",
        "einem", "einen", "mit", "auf", "für", "fuer", "wie", "aber", "haben", "hat", "hatte", "sein", "werden",
        "wird", "wurde", "kann", "können", "sie", "er", "es", "wir", "ihr", "ihre", "mein", "meine", "dein", "deine",
        "guten", "morgen", "tag", "abend", "nacht", "bitte", "danke", "ja", "nein", "buch", "haus", "wasser",
        "apfel", "brot", "schön", "schoen", "hund", "katze", "tier", "auto", "zug", "flugzeug", "essen", "trinken",
        "schlafen", "gehen", "laufen", "sehen", "schauen", "sprechen", "reden", "hören", "hoeren", "geben",
        "nehmen", "machen", "tun", "sagen", "kommen", "zeit", "jahr", "woche", "monat", "mann", "frau", "kind",
        "leute", "mensch", "freund", "familie", "leben", "hand", "auge", "kopf", "arbeit", "schule", "stadt",
        "land", "welt", "gut", "neu", "erste", "letzte", "lang", "gross", "groß", "klein", "alt", "jung", "richtig",
        "falsch", "wichtig", "wenig", "viel", "schlecht", "gleich", "tisch", "stuhl", "tür", "tuer", "fenster",
        "strasse", "straße", "sonne", "mond", "stern", "himmel", "baum", "blume", "vogel", "fisch", "rot", "blau",
        "grün", "gruen", "gelb", "schwarz", "weiss", "weiß", "eins", "zwei", "drei", "vier", "fünf", "fuenf",
        "sechs", "sieben", "acht", "neun", "zehn", "hallo", "tschüss", "tschuss", "auf", "wiedersehen", "welche",
        "welcher", "welches", "warum", "wann", "wo", "woher", "wohin", "was", "wer", "etwas", "nichts", "immer"
    },
    # 2. ESPAÑOL
    "es": {
        "el", "la", "los", "las", "un", "una", "unos", "unas", "es", "son", "era", "eran", "fue", "fueron", "de", "en",
        "con", "por", "para", "que", "qué", "como", "cómo", "pero", "y", "o", "hola", "buenos", "días", "tardes",
        "noches", "gracias", "favor", "sí", "si", "no", "libro", "casa", "agua", "manzana", "pan", "hermoso",
        "hermosa", "conocimiento", "poder", "perro", "gato", "animal", "coche", "carro", "auto", "tren", "avión",
        "avion", "comida", "beber", "dormir", "caminar", "correr", "ver", "mirar", "hablar", "escuchar", "oír",
        "oir", "dar", "tomar", "hacer", "decir", "venir", "tiempo", "año", "ano", "semana", "mes", "hombre",
        "mujer", "niño", "niña", "nino", "nina", "gente", "persona", "amigo", "amiga", "familia", "vida", "mano",
        "ojo", "cabeza", "trabajo", "escuela", "ciudad", "país", "pais", "mundo", "bueno", "buena", "nuevo", "nueva",
        "primero", "primera", "último", "ultima", "largo", "grande", "pequeño", "pequeña", "viejo", "vieja",
        "joven", "correcto", "falso", "importante", "poco", "mucho", "malo", "mala", "igual", "mesa", "silla",
        "puerta", "ventana", "calle", "sol", "luna", "estrella", "cielo", "árbol", "arbol", "flor", "pájaro",
        "pajaro", "pez", "rojo", "azul", "verde", "amarillo", "negro", "blanco", "uno", "dos", "tres", "cuatro",
        "cinco", "seis", "siete", "ocho", "nueve", "diez", "adiós", "adios", "hasta", "luego", "quién", "quien",
        "cuándo", "cuando", "dónde", "donde", "por qué", "porque", "algo", "nada", "siempre", "nunca", "también"
    },
    # 3. INGLÉS
    "en": {
        "the", "a", "an", "is", "are", "was", "were", "be", "been", "being", "in", "on", "at", "to", "for", "with",
        "and", "or", "but", "this", "that", "these", "those", "what", "where", "when", "how", "why", "who", "which",
        "hello", "hi", "good", "morning", "afternoon", "evening", "night", "thank", "thanks", "you", "your", "my",
        "mine", "his", "her", "their", "our", "please", "yes", "no", "not", "book", "house", "water", "apple",
        "bread", "beautiful", "knowledge", "power", "dog", "cat", "animal", "car", "train", "plane", "food",
        "drink", "eat", "sleep", "walk", "run", "see", "look", "speak", "talk", "listen", "hear", "give", "take",
        "make", "do", "say", "get", "go", "come", "time", "year", "day", "week", "month", "man", "woman", "child",
        "children", "people", "friend", "family", "life", "hand", "eye", "head", "work", "school", "city",
        "country", "world", "new", "first", "last", "long", "great", "little", "own", "other", "old", "young",
        "right", "wrong", "big", "high", "different", "small", "large", "next", "early", "important", "few",
        "many", "much", "public", "bad", "same", "able", "table", "chair", "door", "window", "road", "street",
        "sun", "moon", "star", "sky", "tree", "flower", "bird", "fish", "red", "blue", "green", "yellow", "black",
        "white", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "bye", "goodbye",
        "something", "nothing", "always", "never", "also", "have", "has", "had", "can", "could", "would", "should"
    },
    # 4. FRANCÉS
    "fr": {
        "le", "la", "les", "un", "une", "des", "est", "sont", "et", "ou", "mais", "dans", "sur", "avec", "pour",
        "bonjour", "bonsoir", "merci", "oui", "non", "livre", "maison", "eau", "pomme", "pain", "chat", "chien",
        "voiture", "monde", "temps", "homme", "femme", "enfant", "jour", "nuit", "beau", "belle", "grand", "petit"
    },
    # 5. ITALIANO
    "it": {
        "il", "lo", "la", "i", "gli", "le", "un", "uno", "una", "è", "sono", "e", "o", "ma", "in", "su", "con",
        "per", "ciao", "grazie", "prego", "sì", "no", "libro", "casa", "acqua", "mela", "pane", "gatto", "cane",
        "macchina", "mondo", "tempo", "uomo", "donna", "bambino", "giorno", "notte", "bello", "bella", "grande"
    }
}

def detect_language(text: str) -> str:
    """
    Detecta automáticamente el idioma del texto con prioridad en:
    1. Español ('es')
    2. Inglés ('en')
    3. Alemán ('de')
    4. Otros idiomas reconocidos ('fr', 'it', 'pt', 'ja', etc.)

    Diseñado para flashcards: maneja tanto palabras sueltas como frases u oraciones.
    """
    clean = re.sub(r"<[^>]*>", "", text).strip()
    if not clean:
        return "es"

    lower = clean.lower()

    # 1. Caracteres CJK (Japonés / Chino)
    if re.search(r"[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]", lower):
        return "ja"

    # 2. Chequeo de caracteres y diacríticos exclusivos o altamente característicos
    # Alemán: ß o diéresis ä, ö, ü
    if "ß" in lower or any(c in lower for c in ["ä", "ö", "ü"]):
        return "de"

    # Español: signos de apertura ¿, ¡ o la letra ñ
    if "¿" in lower or "¡" in lower or "ñ" in lower:
        return "es"

    # Francés: ç, œ, æ
    if "ç" in lower or "œ" in lower or "æ" in lower:
        return "fr"

    # Acentos comunes españoles (si no hay diacríticos alemanes ni franceses)
    if any(c in lower for c in ["á", "í", "ó", "ú"]):
        return "es"

    # 3. Conteo léxico con palabras comunes (esencial para palabras sueltas o frases cortas)
    words = set(re.findall(r"\b[a-zA-ZáéíóúüñÄÖÜßàèìòùâêîôûç]+\b", lower))
    if words:
        matches_de = len(words.intersection(COMMON_WORDS["de"]))
        matches_es = len(words.intersection(COMMON_WORDS["es"]))
        matches_en = len(words.intersection(COMMON_WORDS["en"]))
        matches_fr = len(words.intersection(COMMON_WORDS.get("fr", set())))
        matches_it = len(words.intersection(COMMON_WORDS.get("it", set())))

        # Puntuaciones ordenadas
        scores = [
            ("es", matches_es),
            ("en", matches_en),
            ("de", matches_de),
            ("fr", matches_fr),
            ("it", matches_it),
        ]
        scores.sort(key=lambda x: x[1], reverse=True)

        if scores[0][1] > 0:
            return scores[0][0]

    # 4. Análisis estadístico con langdetect para textos más largos (> 3 palabras)
    try:
        # Usar probabilidades si está disponible
        candidates = langdetect.detect_langs(clean)
        if candidates:
            # Revisar las mejores probabilidades
            top_candidate = candidates[0].lang
            # Si el top es uno de los prioritarios, devolverlo
            if top_candidate in ("es", "en", "de", "fr", "it", "pt", "ja"):
                return top_candidate

            # Si langdetect sugirió un idioma menor (e.g. 'da' para 'dog'),
            # buscar si 'en', 'es' o 'de' tienen alguna presencia en la lista de probabilidades
            for cand in candidates:
                if cand.lang in ("en", "es", "de"):
                    return cand.lang

            return top_candidate
    except Exception:
        pass

    # Fallback predeterminado seguro
    return "es"

def get_recommended_voice(lang: str) -> str:
    """Devuelve el ID de la voz de mayor claridad recomendada para un idioma dado."""
    lang_norm = lang.split("-")[0].lower() if lang else "es"
    return DEFAULT_VOICE_PER_LANG.get(lang_norm, "es-ES-AlvaroNeural")

def resolve_voice_and_language(text: str, voice_id: Optional[str] = None) -> Tuple[str, str]:
    """
    Determina la voz de Edge-TTS y el idioma del texto.
    Si voice_id no está definido o es 'auto', se ejecuta la detección automática.
    """
    clean_text = re.sub(r"<[^>]*>", "", text).strip()
    if not voice_id or voice_id == "auto" or voice_id not in EDGE_VOICE_CATALOG:
        detected_lang = detect_language(clean_text)
        selected_voice = get_recommended_voice(detected_lang)
        return selected_voice, detected_lang
    else:
        catalog_entry = EDGE_VOICE_CATALOG.get(voice_id, {})
        lang = catalog_entry.get("lang_code", "es")
        return voice_id, lang

def list_edge_voices() -> List[Dict[str, Any]]:
    """Devuelve la lista organizada de voces disponibles en Edge-TTS con la opción Auto."""
    catalog_list = list(EDGE_VOICE_CATALOG.values())
    return catalog_list

async def synthesize_edge_tts(text: str, voice_id: Optional[str] = None, speed: float = 1.0) -> bytes:
    """
    Sintetiza texto con Microsoft Edge TTS y devuelve los bytes MP3 generados.
    Si voice_id no se especifica o es 'auto', detecta automáticamente el idioma.
    """
    clean_text = re.sub(r"<[^>]*>", "", text).strip()
    if not clean_text:
        raise ValueError("El texto a sintetizar no puede estar vacío.")

    # Resolver voz (con autodetección si aplica)
    chosen_voice, _ = resolve_voice_and_language(clean_text, voice_id)

    # Formatear velocidad para Edge-TTS: e.g. speed = 1.0 -> "+0%", speed = 1.2 -> "+20%", speed = 0.85 -> "-15%"
    rate_percent = int(round((speed - 1.0) * 100))
    rate_str = f"{rate_percent:+d}%"

    communicate = edge_tts.Communicate(clean_text, chosen_voice, rate=rate_str)
    audio_buffer = io.BytesIO()

    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio_buffer.write(chunk["data"])

    audio_bytes = audio_buffer.getvalue()
    if not audio_bytes:
        raise RuntimeError("No se recibieron datos de audio desde Edge-TTS.")

    return audio_bytes
