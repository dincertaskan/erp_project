# Akıllı ERP Sistemi

Küçük ve orta ölçekli e-ticaret işletmeleri için ürün, stok, sipariş ve müşteri yönetimi sunan web tabanlı ERP sistemi. YM 491 Araştırma Projesi kapsamında geliştirilmektedir.

| Katman | Teknoloji |
|---|---|
| Önyüz | React, TypeScript, Vite, Ant Design |
| Arka uç | Python 3.12, FastAPI, SQLAlchemy, Alembic |
| Veritabanı | PostgreSQL 16 |
| Altyapı | Docker Compose, GitHub Actions |

## Özellikler

- **Müşteri:** kayıt olma, ürün kataloğunda arama ve filtreleme, sepet, sipariş verme, siparişleri izleme ve onay beklerken iptal etme.
- **Depo Personeli:** stok girişi ve çıkışı, stok hareketleri, kritik stok listesi, hazırlanan siparişleri kargoya verme.
- **Yönetici:** dashboard, ürün ve kategori yönetimi, sipariş onayı ve durum takibi, müşteri adına sipariş, müşteri yönetimi, satış/stok/sipariş raporları ve Excel'e aktarma, kullanıcı rolü atama.

## Gereksinimler

- Docker Desktop (Docker Compose ile)
- Yerel geliştirme için: Python 3.12, Node.js 22 veya üstü

## Hızlı başlangıç (Docker Compose)

```bash
cp backend/.env.example backend/.env    # SECRET_KEY değerini değiştirin
docker compose up -d --build            # backend açılırken veritabanı göçlerini uygular
docker compose exec -e SEED_PASSWORD=Demo1234 backend python -m app.seed
```

`backend/.env.example` içindeki `SECRET_KEY` yalnızca örnektir; en az 32 karakterlik rastgele bir değerle değiştirin. Üretmek için:

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
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
cp .env.example .env            # henüz yoksa; SECRET_KEY değerini değiştirin
python -m venv .venv
source .venv/Scripts/activate   # Windows Git Bash; PowerShell: .venv\Scripts\Activate.ps1; Linux/macOS: source .venv/bin/activate
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

## Olist verisi

Gerçekçi hacimde demo ve ölçüm için Olist açık veri seti aktarılabilir.

1. Kaggle'daki "Brazilian E-Commerce Public Dataset by Olist" veri setini indirin ve CSV dosyalarını `backend/data/olist/` klasörüne çıkarın (klasör git dışındadır). `experiments/requirements.txt` kuruluysa `python -c "import kagglehub; print(kagglehub.dataset_download('olistbr/brazilian-ecommerce'))"` komutu veri setini indirip klasörünü yazdırır; CSV'leri oradan kopyalayın.
2. Aktarımı çalıştırın:

```bash
docker compose exec backend python -m app.olist --data-dir data/olist            # tamamı (~100 bin sipariş)
docker compose exec backend python -m app.olist --data-dir data/olist --sample 1000  # küçük örnek
docker compose exec backend python -m app.olist --data-dir data/olist --reset    # silip yeniden yükle
```

Aktarım uygulamanın sipariş ve stok mantığını atlayıp verileri toplu yazar; Olist siparişleri için stok hareketi üretilmez. Olist'te olmayan alanlar sentetiktir: ürün adı (kategori + kısa kod), satış fiyatı (satırların medyanı), maliyet (satış fiyatının %60'ı), stok ve minimum stok (sabit tohumlu rastgele), müşteri adı ve e-postası (anonim). Sipariş tutarı kargo ücretini içermez. Olist siparişleri panelde salt okunurdur.

## Testler ve kod denetimi

Testler `TEST_DATABASE_URL` ile gösterilen ayrı bir veritabanında çalışır. Docker Compose, `erp_test` veritabanını yalnızca veritabanı birimi (`pgdata`) ilk oluşturulurken otomatik oluşturur. Birim bu özellik eklenmeden önce oluşturulduysa veritabanını bir kez elle oluşturun:

```bash
docker compose exec db createdb -U erp erp_test
```

Arka uç testlerini çalıştırmanın önerilen yolu Docker'dır; testler CI ile aynı Python 3.12 sürümünde, `db` servisindeki `erp_test` veritabanına karşı çalışır. Kod ve testler konteynere canlı bağlanır; yalnızca `requirements*.txt` değişince `--build` ekleyin.

```bash
docker compose --profile test run --rm backend-test                       # tüm testler
docker compose --profile test run --rm backend-test pytest --cov=app      # kapsam raporuyla
docker compose --profile test run --rm --build backend-test               # bağımlılıklar değiştiyse
```

`backend/tests/test_scenarios.py` API düzeyinde senaryo testleridir: bir kullanıcının işini baştan sona HTTP çağrılarıyla yürütür, tarayıcı kullanmaz.

Yerel sanal ortamda ve önyüzde:

```bash
cd backend
ruff check . && ruff format --check .
pytest

cd frontend
npm run lint && npm run format:check
npm run typecheck
npm test
```

Kod kapsamı raporu:

```bash
cd backend
pytest --cov=app

cd frontend
npm run test:coverage
```

CI'da arka uç kapsamı `--cov-fail-under`, önyüz kapsamı `vite.config.ts` içindeki `coverage.thresholds` ile denetlenir; kapsam bu eşiklerin altına düşerse CI başarısız olur. CI ayrıca göçlerin modellerle uyumunu (`alembic check`) ve bağımlılıklardaki bilinen açıkları (`pip-audit`, `npm audit`) denetler.

## Üretim kurulumu

`docker-compose.prod.yml` önyüzü derleyip nginx ile sunar. nginx `/api/` isteklerini önekini kaldırarak arka uca iletir; veritabanı ve arka uç dışarıya port açmaz, servisler hata durumunda yeniden başlar.

```bash
# Kök dizindeki .env dosyasına (ya da ortama) yazın:
#   POSTGRES_PASSWORD=<güçlü bir şifre>
#   SECRET_KEY=<en az 32 karakter, yukarıdaki komutla üretin>
#   HTTP_PORT=80                     (isteğe bağlı)
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec -e SEED_PASSWORD=... backend python -m app.seed   # isteğe bağlı demo verisi
```

- Uygulama: http://sunucu-adresi (`HTTP_PORT`, varsayılan 80)
- `POSTGRES_PASSWORD` ve `SECRET_KEY` tanımlı değilse compose başlamaz.
- HTTPS için önüne TLS sonlandıran bir ters vekil (ör. sunucudaki nginx ya da Caddy) koyun.
- Geliştirme kurulumu (`docker-compose.yml`) değişmeden kullanılabilir; iki dosya aynı dizinde farklı proje adlarıyla da çalışabilir (`-p`).

## Dokümantasyon

- [API özeti](docs/api.md): uç noktalar, roller ve hata kodları
- [Kullanıcı kılavuzu](docs/kullanici-kilavuzu.md): rollere göre ekranlar ve adım adım işlemler
- [Güvenlik kontrolü](docs/guvenlik-kontrolu.md): OWASP Top 10 incelemesi ve sonuçları
- [Üçüncü taraf lisansları](docs/lisanslar.md)
- [Deneyler](experiments/README.md) ve [deney sonuçları](experiments/results/README.md)

## Proje yapısı

```
backend/          FastAPI uygulaması (controllers, services, repositories, models, schemas)
backend/migrations/  Alembic göçleri
backend/tests/    pytest testleri
frontend/         React + TypeScript önyüzü (Ant Design, TanStack Query)
docker/           Docker Compose yardımcı dosyaları
docs/             Proje dokümantasyonu
experiments/      Ölçüm deneyleri ve sonuçları
```

## Lisans ve veri

Demo ve ölçümlerde Olist Brazilian E-Commerce Public Dataset kullanılır (kaynak: Kaggle, Olist; lisans: CC BY-NC-SA 4.0). Müşteri adları ve e-postaları anonimleştirilir; gerçek kişisel veri kullanılmaz. Kullanılan paketlerin lisansları için [docs/lisanslar.md](docs/lisanslar.md) dosyasına bakın.
