# Akıllı ERP Sistemi

Küçük ve orta ölçekli e-ticaret işletmeleri için ürün, stok, sipariş ve müşteri yönetimi sunan web tabanlı ERP sistemi. YM 491 Araştırma Projesi kapsamında geliştirilmektedir.

| Katman | Teknoloji |
|---|---|
| Önyüz | React, TypeScript, Vite, Ant Design |
| Arka uç | Python 3.12, FastAPI, SQLAlchemy, Alembic |
| Veritabanı | PostgreSQL 16 |
| Altyapı | Docker Compose, GitHub Actions |

## Gereksinimler

- Docker Desktop (Docker Compose ile)
- Yerel geliştirme için: Python 3.12, Node.js 22 veya üstü

## Hızlı başlangıç (Docker Compose)

```bash
cp backend/.env.example backend/.env    # SECRET_KEY değerini değiştirin
docker compose up -d --build
```

- API: http://localhost:8000 (Swagger: http://localhost:8000/docs)
- Sağlık kontrolü: http://localhost:8000/health

Bilgisayarınızda 5432 veya 8000 portu doluysa kök dizindeki `.env.example` dosyasını `.env` olarak kopyalayıp `POSTGRES_PORT` ve `BACKEND_PORT` değerlerini değiştirin. Veritabanı portunu değiştirirseniz `backend/.env` içindeki adresleri de güncelleyin.

## Yerel geliştirme (arka uç)

Veritabanını Docker ile açıp arka ucu yerelde çalıştırmak için:

```bash
docker compose up -d db
cd backend
python -m venv .venv
.venv/Scripts/activate          # Linux/macOS: source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload
```

## Testler ve kod denetimi

Testler `TEST_DATABASE_URL` ile gösterilen ayrı bir veritabanında çalışır. Docker Compose, ilk açılışta `erp_test` veritabanını otomatik oluşturur.

```bash
cd backend
ruff check .
pytest
```

## Proje yapısı

```
backend/          FastAPI uygulaması (controllers, services, repositories, models, schemas)
backend/tests/    pytest testleri
frontend/         React önyüzü
docker/           Docker Compose yardımcı dosyaları
```

## Lisans ve veri

Demo ve testlerde Olist Brazilian E-Commerce Public Dataset kullanılacaktır (kaynak: Kaggle, Olist). Gerçek kişisel veri kullanılmaz.
