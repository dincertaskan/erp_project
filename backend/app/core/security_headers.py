"""API yanıtlarına güvenlik başlıkları ekleyen ASGI ara katmanı.

API yalnızca JSON ve dosya (xlsx) döndürür; bu yüzden içerik güvenlik politikası hiçbir kaynağa izin vermez.
Swagger UI ve ReDoc sayfaları CDN'den betik yüklediği için bu yollarda CSP eklenmez.
"""

from starlette.types import ASGIApp, Message, Receive, Scope, Send

API_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"

COMMON_HEADERS: dict[str, str] = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
}

# Dokümantasyon sayfaları (FastAPI varsayılan yolları)
DOCS_PATHS = frozenset({"/docs", "/docs/oauth2-redirect", "/redoc", "/openapi.json"})


class SecurityHeadersMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers_to_add = dict(COMMON_HEADERS)
        if scope["path"] not in DOCS_PATHS:
            headers_to_add["Content-Security-Policy"] = API_CSP
        encoded = [(name.lower().encode("latin-1"), value.encode("latin-1")) for name, value in headers_to_add.items()]

        async def send_with_headers(message: Message) -> None:
            if message["type"] == "http.response.start":
                existing = {name.lower() for name, _ in message.get("headers", [])}
                extra = [(name, value) for name, value in encoded if name not in existing]
                message["headers"] = [*message.get("headers", []), *extra]
            await send(message)

        await self.app(scope, receive, send_with_headers)
