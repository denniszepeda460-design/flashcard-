import os
import sys
import shutil
import urllib.request
import subprocess
import tempfile
from typing import Dict, List, Any, Optional

PIPER_VOICES_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data", "piper_voices"))
os.makedirs(PIPER_VOICES_DIR, exist_ok=True)

# Curated catalog of high-quality neural Piper voices across 26+ languages
VOICE_CATALOG: Dict[str, Dict[str, Any]] = {
    # Spanish
    "es_ES-davefx-medium": {
        "id": "es_ES-davefx-medium",
        "name": "Español (España) - Davefx",
        "lang": "es-ES",
        "lang_code": "es",
        "quality": "medium",
        "path_prefix": "es/es_ES/davefx/medium/es_ES-davefx-medium",
        "size_mb": 62,
    },
    "es_ES-carlfm-x_low": {
        "id": "es_ES-carlfm-x_low",
        "name": "Español (España) - Carlfm (Ligera)",
        "lang": "es-ES",
        "lang_code": "es",
        "quality": "x_low",
        "path_prefix": "es/es_ES/carlfm/x_low/es_ES-carlfm-x_low",
        "size_mb": 27,
    },
    "es_MX-ald-medium": {
        "id": "es_MX-ald-medium",
        "name": "Español (México) - Ald",
        "lang": "es-MX",
        "lang_code": "es",
        "quality": "medium",
        "path_prefix": "es/es_MX/ald/medium/es_MX-ald-medium",
        "size_mb": 63,
    },
    # English
    "en_US-lessac-medium": {
        "id": "en_US-lessac-medium",
        "name": "English (US) - Lessac",
        "lang": "en-US",
        "lang_code": "en",
        "quality": "medium",
        "path_prefix": "en/en_US/lessac/medium/en_US-lessac-medium",
        "size_mb": 63,
    },
    "en_US-amy-medium": {
        "id": "en_US-amy-medium",
        "name": "English (US) - Amy",
        "lang": "en-US",
        "lang_code": "en",
        "quality": "medium",
        "path_prefix": "en/en_US/amy/medium/en_US-amy-medium",
        "size_mb": 63,
    },
    "en_GB-alan-medium": {
        "id": "en_GB-alan-medium",
        "name": "English (UK) - Alan",
        "lang": "en-GB",
        "lang_code": "en",
        "quality": "medium",
        "path_prefix": "en/en_GB/alan/medium/en_GB-alan-medium",
        "size_mb": 63,
    },
    # French
    "fr_FR-siwis-medium": {
        "id": "fr_FR-siwis-medium",
        "name": "Français (France) - Siwis",
        "lang": "fr-FR",
        "lang_code": "fr",
        "quality": "medium",
        "path_prefix": "fr/fr_FR/siwis/medium/fr_FR-siwis-medium",
        "size_mb": 63,
    },
    "fr_FR-gilles-low": {
        "id": "fr_FR-gilles-low",
        "name": "Français (France) - Gilles",
        "lang": "fr-FR",
        "lang_code": "fr",
        "quality": "low",
        "path_prefix": "fr/fr_FR/gilles/low/fr_FR-gilles-low",
        "size_mb": 31,
    },
    # German
    "de_DE-eva_k-medium": {
        "id": "de_DE-eva_k-medium",
        "name": "Deutsch (Deutschland) - Eva",
        "lang": "de-DE",
        "lang_code": "de",
        "quality": "medium",
        "path_prefix": "de/de_DE/eva_k/medium/de_DE-eva_k-medium",
        "size_mb": 63,
    },
    "de_DE-karlsson-low": {
        "id": "de_DE-karlsson-low",
        "name": "Deutsch (Deutschland) - Karlsson",
        "lang": "de-DE",
        "lang_code": "de",
        "quality": "low",
        "path_prefix": "de/de_DE/karlsson/low/de_DE-karlsson-low",
        "size_mb": 31,
    },
    # Italian
    "it_IT-riccardo-x_low": {
        "id": "it_IT-riccardo-x_low",
        "name": "Italiano (Italia) - Riccardo",
        "lang": "it-IT",
        "lang_code": "it",
        "quality": "x_low",
        "path_prefix": "it/it_IT/riccardo/x_low/it_IT-riccardo-x_low",
        "size_mb": 27,
    },
    "it_IT-paola-medium": {
        "id": "it_IT-paola-medium",
        "name": "Italiano (Italia) - Paola",
        "lang": "it-IT",
        "lang_code": "it",
        "quality": "medium",
        "path_prefix": "it/it_IT/paola/medium/it_IT-paola-medium",
        "size_mb": 63,
    },
    # Portuguese
    "pt_BR-faber-medium": {
        "id": "pt_BR-faber-medium",
        "name": "Português (Brasil) - Faber",
        "lang": "pt-BR",
        "lang_code": "pt",
        "quality": "medium",
        "path_prefix": "pt/pt_BR/faber/medium/pt_BR-faber-medium",
        "size_mb": 63,
    },
    "pt_PT-tugao-medium": {
        "id": "pt_PT-tugao-medium",
        "name": "Português (Portugal) - Tugão",
        "lang": "pt-PT",
        "lang_code": "pt",
        "quality": "medium",
        "path_prefix": "pt/pt_PT/tugao/medium/pt_PT-tugao-medium",
        "size_mb": 63,
    },
    # Russian
    "ru_RU-denis-medium": {
        "id": "ru_RU-denis-medium",
        "name": "Русский (Россия) - Denis",
        "lang": "ru-RU",
        "lang_code": "ru",
        "quality": "medium",
        "path_prefix": "ru/ru_RU/denis/medium/ru_RU-denis-medium",
        "size_mb": 63,
    },
    # Japanese
    "ja_JP-hira-low": {
        "id": "ja_JP-hira-low",
        "name": "日本語 (日本) - Hira",
        "lang": "ja-JP",
        "lang_code": "ja",
        "quality": "low",
        "path_prefix": "ja/ja_JP/hira/low/ja_JP-hira-low",
        "size_mb": 31,
    },
    # Chinese
    "zh_CN-huayan-medium": {
        "id": "zh_CN-huayan-medium",
        "name": "中文 (中国) - Huayan",
        "lang": "zh-CN",
        "lang_code": "zh",
        "quality": "medium",
        "path_prefix": "zh/zh_CN/huayan/medium/zh_CN-huayan-medium",
        "size_mb": 63,
    },
    # Polish
    "pl_PL-darkman-medium": {
        "id": "pl_PL-darkman-medium",
        "name": "Polski (Polska) - Darkman",
        "lang": "pl-PL",
        "lang_code": "pl",
        "quality": "medium",
        "path_prefix": "pl/pl_PL/darkman/medium/pl_PL-darkman-medium",
        "size_mb": 63,
    },
    # Dutch
    "nl_NL-mls_7432-low": {
        "id": "nl_NL-mls_7432-low",
        "name": "Nederlands (Nederland) - MLS",
        "lang": "nl-NL",
        "lang_code": "nl",
        "quality": "low",
        "path_prefix": "nl/nl_NL/mls_7432/low/nl_NL-mls_7432-low",
        "size_mb": 31,
    },
    # Ukrainian
    "uk_UA-lada-x_low": {
        "id": "uk_UA-lada-x_low",
        "name": "Українська (Україна) - Lada",
        "lang": "uk-UA",
        "lang_code": "uk",
        "quality": "x_low",
        "path_prefix": "uk/uk_UA/lada/x_low/uk_UA-lada-x_low",
        "size_mb": 27,
    },
    # Arabic
    "ar_JO-kareem-medium": {
        "id": "ar_JO-kareem-medium",
        "name": "العربية (الأردن) - Kareem",
        "lang": "ar-JO",
        "lang_code": "ar",
        "quality": "medium",
        "path_prefix": "ar/ar_JO/kareem/medium/ar_JO-kareem-medium",
        "size_mb": 63,
    },
    # Catalan
    "ca_ES-upc_ona-medium": {
        "id": "ca_ES-upc_ona-medium",
        "name": "Català (Espanya) - Ona",
        "lang": "ca-ES",
        "lang_code": "ca",
        "quality": "medium",
        "path_prefix": "ca/ca_ES/upc_ona/medium/ca_ES-upc_ona-medium",
        "size_mb": 63,
    },
    # Greek
    "el_GR-rapunzelina-low": {
        "id": "el_GR-rapunzelina-low",
        "name": "Ελληνικά (Ελλάδα) - Rapunzelina",
        "lang": "el-GR",
        "lang_code": "el",
        "quality": "low",
        "path_prefix": "el/el_GR/rapunzelina/low/el_GR-rapunzelina-low",
        "size_mb": 31,
    },
    # Turkish
    "tr_TR-dfki-medium": {
        "id": "tr_TR-dfki-medium",
        "name": "Türkçe (Türkiye) - Dfki",
        "lang": "tr-TR",
        "lang_code": "tr",
        "quality": "medium",
        "path_prefix": "tr/tr_TR/dfki/medium/tr_TR-dfki-medium",
        "size_mb": 63,
    },
    # Swedish
    "sv_SE-nst-medium": {
        "id": "sv_SE-nst-medium",
        "name": "Svenska (Sverige) - NST",
        "lang": "sv-SE",
        "lang_code": "sv",
        "quality": "medium",
        "path_prefix": "sv/sv_SE/nst/medium/sv_SE-nst-medium",
        "size_mb": 63,
    },
    # Vietnamese
    "vi_VN-25hours_single-low": {
        "id": "vi_VN-25hours_single-low",
        "name": "Tiếng Việt (Việt Nam) - 25hours",
        "lang": "vi-VN",
        "lang_code": "vi",
        "quality": "low",
        "path_prefix": "vi/vi_VN/25hours_single/low/vi_VN-25hours_single-low",
        "size_mb": 31,
    },
}

def get_piper_executable() -> Optional[str]:
    """Busca el ejecutable piper.exe en el sistema."""
    piper_bin = shutil.which("piper")
    if piper_bin:
        return piper_bin
    
    # Rutas comunes en Windows
    scripts_dir = os.path.dirname(sys.executable)
    candidate = os.path.join(scripts_dir, "piper.exe")
    if os.path.isfile(candidate):
        return candidate
        
    return None

def is_voice_installed(voice_id: str) -> bool:
    """Verifica si el modelo .onnx y su .json están descargados."""
    onnx_path = os.path.join(PIPER_VOICES_DIR, f"{voice_id}.onnx")
    json_path = os.path.join(PIPER_VOICES_DIR, f"{voice_id}.onnx.json")
    return os.path.isfile(onnx_path) and os.path.isfile(json_path) and os.path.getsize(onnx_path) > 1024

def list_voices() -> List[Dict[str, Any]]:
    """Devuelve la lista de voces catalogadas con su estado de instalación."""
    voices = []
    has_piper = get_piper_executable() is not None
    for voice_id, data in VOICE_CATALOG.items():
        installed = is_voice_installed(voice_id)
        voices.append({
            **data,
            "installed": installed,
            "piper_available": has_piper,
        })
    return voices

def download_voice(voice_id: str) -> bool:
    """Descarga el modelo ONNX y el archivo de configuración JSON desde HuggingFace."""
    if voice_id not in VOICE_CATALOG:
        raise ValueError(f"Voz {voice_id} no encontrada en el catálogo.")
    
    data = VOICE_CATALOG[voice_id]
    prefix = data["path_prefix"]
    base_url = "https://huggingface.co/rhasspy/piper-voices/resolve/main"

    onnx_url = f"{base_url}/{prefix}.onnx"
    json_url = f"{base_url}/{prefix}.onnx.json"

    dest_onnx = os.path.join(PIPER_VOICES_DIR, f"{voice_id}.onnx")
    dest_json = os.path.join(PIPER_VOICES_DIR, f"{voice_id}.onnx.json")

    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) PiperDownloader/1.0"}

    def _download_file(url: str, dest: str):
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=120) as resp, open(dest, "wb") as out_file:
            shutil.copyfileobj(resp, out_file)

    # Descargar .onnx.json primero
    _download_file(json_url, dest_json)
    # Descargar .onnx
    _download_file(onnx_url, dest_onnx)
    return True

def synthesize_to_wav_bytes(text: str, voice_id: str = "es_ES-carlfm-x_low", length_scale: float = 1.0) -> bytes:
    """Sintetiza texto a audio WAV utilizando Piper y devuelve los bytes WAV generados."""
    piper_bin = get_piper_executable()
    if not piper_bin:
        raise RuntimeError("Piper TTS no está instalado o no se encuentra en el PATH.")

    # Si la voz no está instalada, intentar buscar la primera voz instalada o descargar la voz por defecto
    if not is_voice_installed(voice_id):
        # Buscar alguna voz instalada para el mismo idioma
        lang_prefix = voice_id.split("-")[0]
        installed_alternatives = [
            vid for vid in VOICE_CATALOG
            if vid.startswith(lang_prefix) and is_voice_installed(vid)
        ]
        if installed_alternatives:
            voice_id = installed_alternatives[0]
        else:
            download_voice(voice_id)

    model_path = os.path.join(PIPER_VOICES_DIR, f"{voice_id}.onnx")
    config_path = os.path.join(PIPER_VOICES_DIR, f"{voice_id}.onnx.json")

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp_out:
        output_wav_path = tmp_out.name

    try:
        cmd = [
            piper_bin,
            "-m", model_path,
            "-c", config_path,
            "-f", output_wav_path,
            "--length-scale", str(length_scale),
        ]

        # Pasar texto limpio mediante stdin codificado en UTF-8
        clean_text = text.replace("<[^>]*>", "").strip()
        result = subprocess.run(
            cmd,
            input=clean_text.encode("utf-8"),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False,
        )

        if result.returncode != 0:
            error_str = result.stderr.decode("utf-8", errors="ignore")
            raise RuntimeError(f"Error en ejecución de Piper ({result.returncode}): {error_str}")

        with open(output_wav_path, "rb") as f:
            wav_bytes = f.read()

        return wav_bytes

    finally:
        if os.path.exists(output_wav_path):
            try:
                os.remove(output_wav_path)
            except Exception:
                pass
