import os
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuración de la aplicación, cargada desde .env o variables de entorno."""

    # API settings (prefixed FLASHCARD_)
    api_key: str = "dev-key-change-me"
    api_host: str = "0.0.0.0"
    api_port: int = 8001

    # Collection path
    collection_path: str = "./data/collection.anki2"

    # Sync server settings (env vars without prefix: SYNC_*)
    sync_user: str = "usuario:password"
    sync_base: str = "./data/sync"
    sync_host: str = "0.0.0.0"
    sync_port: int = 8080

    # Environment and CORS
    environment: str = "development"
    cors_origins: str = ""

    # Gemini AI
    gemini_api_keys: str = ""
    # Groq AI (Fallback)
    groq_api_keys: str = ""

    model_config = SettingsConfigDict(
        env_file=("../.env", ".env"),
        extra="ignore",
    )

    @classmethod
    def _load_from_env(cls) -> dict:
        """Load settings from env vars with mixed prefixes."""
        values = {}
        # FLASHCARD_ prefixed
        for key in ("api_key", "api_host", "api_port"):
            env_val = os.environ.get(f"FLASHCARD_{key.upper()}")
            if env_val is not None:
                if key == "api_port":
                    try:
                        values[key] = int(env_val)
                    except ValueError:
                        pass
                else:
                    values[key] = env_val

        # Direct env names
        env_map = {
            "COLLECTION_PATH": "collection_path",
            "SYNC_USER1": "sync_user",
            "SYNC_BASE": "sync_base",
            "SYNC_HOST": "sync_host",
            "SYNC_PORT": "sync_port",
            "ENVIRONMENT": "environment",
            "CORS_ORIGINS": "cors_origins",
            "GEMINI_API_KEYS": "gemini_api_keys",
            "GROQ_API_KEYS": "groq_api_keys",
        }
        for env_name, field_name in env_map.items():
            env_val = os.environ.get(env_name)
            if env_val is not None:
                values[field_name] = env_val

        return values


@lru_cache()
def get_settings() -> Settings:
    """Devuelve la configuración de la app (singleton cacheado)."""
    # Load .env file manually for mixed-prefix support
    try:
        from dotenv import load_dotenv

        backend_dir = os.path.dirname(os.path.dirname(__file__))
        root_env = os.path.join(backend_dir, "..", ".env")
        backend_env = os.path.join(backend_dir, ".env")
        if os.path.exists(root_env):
            load_dotenv(root_env)
        if os.path.exists(backend_env):
            load_dotenv(backend_env, override=True)
    except ImportError:
        pass

    overrides = Settings._load_from_env()
    return Settings(**overrides)
