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
docker compose up -d --build            # backend açılırken veritabanı göçlerini uygular
docker compose exec -e SEED_PASSWORD=Demo1234 backend python -m app.seed
```

- Uygulama: http://localhost:5173
- API: http://localhost:8000 (Swagger: http://localhost:8000/docs)
- Sağlık kontrolü: http://localhost:8000/health

`package.json` ya da `requirements.txt` değiştiğinde (ör. `git pull` sonrası) imajları yeniden derleyin: `docker compose up -d --build`. Konteynerdeki bağımlılıklar imajın içindedir; yalnızca `frontend/src` klasörü canlı bağlanır.

Bilgisayarınızda 5432, 8000 veya 5173 portu doluysa kök dizindeki `.env.example` dosyasını `.env` olarak kopyalayıp `POSTGRES_PORT`, `BACKEND_PORT` ve `FRONTEND_PORT` değerlerini değiştirin. Veritabanı portunu değiştirirseniz `backend/.env` içindeki adresleri de güncelleyin.

## Yerel geliştirme (arka uç)

Veritabanını Docker ile açıp arka ucu yerelde çalıştırmak için:

```bash
docker compose up -d db
cd backend
python -m venv .venv
.venv/Scripts/activate          # Linux/macOS: source .venv/bin/activate
pip install -r requirements-dev.txt
alembic upgrade head
SEED_PASSWORD=Demo1234 python -m app.seed     # PowerShell: $env:SEED_PASSWORD="Demo1234"; python -m app.seed
uvicorn app.main:app --reload
```

## Yerel geliştirme (önyüz)

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

Geliştirme sunucusu `/api` ile başlayan istekleri arka uca iletir (varsayılan `http://localhost:8000`). Arka uç başka bir portta çalışıyorsa `frontend/.env.example` dosyasını `frontend/.env.local` olarak kopyalayıp `VITE_API_PROXY_TARGET` değerini değiştirin.

## Veritabanı göçleri

Şema değişiklikleri Alembic ile yönetilir. Modelleri değiştirdikten sonra:

```bash
cd backend
alembic revision --autogenerate -m "kısa açıklama"   # üretilen dosyayı gözden geçirin
alembic upgrade head
```

Sorgu indeksleri ayrı bir göçtedir (`0002`). İndekssiz ölçüm için `alembic downgrade 0001`, geri almak için `alembic upgrade head`.

## Demo hesaplar

Seed betiği her rol için bir hesap oluşturur. Şifre seed çalıştırılırken `SEED_PASSWORD` ile verilir; yukarıdaki komutlarda `Demo1234` kullanılmıştır.

| Rol | E-posta | Şifre |
|---|---|---|
| Yönetici | yonetici@example.com | Demo1234 |
| Depo Personeli | depo@example.com | Demo1234 |
| Müşteri | musteri@example.com | Demo1234 |

Bu hesaplar yalnızca yerel geliştirme ve demo içindir.

## Testler ve kod denetimi

Testler `TEST_DATABASE_URL` ile gösterilen ayrı bir veritabanında çalışır. Docker Compose, ilk açılışta `erp_test` veritabanını otomatik oluşturur.

```bash
cd backend
ruff check . && ruff format --check .
pytest

cd frontend
npm run lint && npm run format:check
npm run typecheck
npm test
```

## Proje yapısı

```
backend/          FastAPI uygulaması (controllers, services, repositories, models, schemas)
backend/migrations/  Alembic göçleri
backend/tests/    pytest testleri
frontend/         React + TypeScript önyüzü (Ant Design, TanStack Query)
docker/           Docker Compose yardımcı dosyaları
```

## Lisans ve veri

Demo ve testlerde Olist Brazilian E-Commerce Public Dataset kullanılacaktır (kaynak: Kaggle, Olist). Gerçek kişisel veri kullanılmaz.
