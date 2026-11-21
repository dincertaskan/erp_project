# Deneyler

## Kurulum

```bash
cd experiments
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt   # Linux/macOS: .venv/bin/pip
```

Deneyler Docker Compose ile çalışan sistem üzerinde yapılır. Ölçümden önce imajları güncelleyin (`docker compose up -d --build`) ve demo verisini yükleyin (README'deki seed adımı). Ölçümler veritabanına deney ürünleri ve siparişleri ekler; mümkünse ayrı bir veritabanında çalışın.

Yönetici şifresi `ERP_PASSWORD` ortam değişkeniyle verilir. API adresi `--base-url` ya da `ERP_API` ile değiştirilebilir (varsayılan `http://localhost:8000`).

## Deney 1: Eşzamanlı onayda stok kilidi

Stratejiler backend'de `STOCK_STRATEGY` ile seçilir:

| Strateji | Davranış |
|---|---|
| `pessimistic` (varsayılan) | Ürün satırı `SELECT ... FOR UPDATE` ile kilitlenir |
| `optimistic` | Kilit yok; `UPDATE ... WHERE version = ?`, çakışmada 3 deneme, sonra 409 |
| `none` | Yalnızca deney referansı: kilitsiz oku-kontrol et-yaz (fazla satışa açık, üretimde kullanılmaz) |

```bash
ERP_PASSWORD=... python deney1.py --strategies none,pessimistic,optimistic \
    --concurrency 10,50,100 --stock 0.5 --repetitions 30 --workers 4 --restart
python analyze_deney1.py
```

- `--restart` backend'i her strateji için `STOCK_STRATEGY` ve `UVICORN_WORKERS` ile yeniden başlatır; bitince varsayılana (`pessimistic`, 1 worker) döndürür.
- `--stock 0.5`, başlangıç stokunu eşzamanlı istek sayısının yarısı yapar (talep stoktan fazla). Tam sayı da verilebilir.
- Her koşu `results/deney1.csv` dosyasına bir satır ekler: onaylanan, stok yetersiz, diğer hatalar, son stok, fazla satış (onaylanan − başlangıç stoku), kayıp güncelleme (onaylanan satışların stoğa yansımayan kısmı), ortalama ve p95 süre, başarısız istek oranı.
- `analyze_deney1.py` strateji ve eşzamanlılık düzeyine göre özet ile p95 süresi için Kruskal-Wallis ve ANOVA çıktısı verir.

Eşzamanlı onay istekleri Locust yerine `httpx` ile aynı anda gönderilir: her koşuda tam N isteğin birlikte başlaması ve koşunun sabit süre beklememesi için. Genel yük testi için Locust senaryosu ayrıca vardır.

## Genel yük testi (Locust)

```bash
ERP_PASSWORD=... locust -f locustfile.py --host http://localhost:8000 --headless -u 50 -r 10 -t 2m --csv results/yuk
```

Yönetici (dashboard, sipariş, ürün ve müşteri listeleri) ve depo personeli (stok listesi, kritik stok) kullanıcıları.

## Ortam bilgisi

Sonuçları raporlarken işlemci, bellek, işletim sistemi, Docker sürümü, worker sayısı ve veri hacmini (Olist yüklü mü) not edin.
