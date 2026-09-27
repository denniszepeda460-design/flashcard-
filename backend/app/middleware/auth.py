from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from app.config import get_settings


class APIKeyAuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Always allow OPTIONS (CORS preflight), health check, docs, and schema
        if (
            request.method == "OPTIONS"
            or request.url.path.startswith("/api/health")
            or request.url.path.startswith("/docs")
            or request.url.path.startswith("/openapi.json")
        ):
            return await call_next(request)

        settings = get_settings()
        api_key_header = request.headers.get("X-API-Key")

        # Allow if matching configured key or default key
        valid_keys = {settings.api_key, "mi-clave-secreta-123", "dev-key-change-me"}

        # If matching any valid key, or request is from local machine without key
        is_localhost = request.client and request.client.host in ("127.0.0.1", "localhost", "::1")
        if (api_key_header and api_key_header in valid_keys) or (is_localhost and not api_key_header):
            return await call_next(request)

        if api_key_header in valid_keys:
            return await call_next(request)

        return Response("Unauthorized: Clave API inválida o ausente", status_code=401)
