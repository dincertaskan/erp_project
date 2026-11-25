FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

# Test imajı: geliştirme bağımlılıkları eklenir, kod ve testler compose ile bağlanır.
# docker compose --profile test run --rm backend-test
FROM base AS test
COPY requirements-dev.txt .
RUN pip install -r requirements-dev.txt
CMD ["pytest"]

# Çalışma imajı (varsayılan hedef)
FROM base AS runtime

RUN useradd --create-home --uid 1000 app

COPY --chown=app:app . .
# Adlandırılmış birim ilk bağlandığında bu klasörün sahipliğini alır
RUN mkdir -p /app/uploads && chown app:app /app/uploads

USER app

EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=5 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=4)" || exit 1

CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers ${UVICORN_WORKERS:-1}"]
