# Deneyler

## Kurulum

```bash
cd experiments
python -m venv .venv
source .venv/Scripts/activate   # Windows Git Bash; PowerShell: .venv\Scripts\Activate.ps1; Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
```

Aşağıdaki komutlar `experiments` klasöründe, sanal ortam etkinken çalıştırılır.

Deneyler Docker Compose ile çalışan sistem üzerinde yapılır. Ölçümden önce imajları güncelleyin (`docker compose up -d --build`) ve demo verisini yükleyin (README'deki seed adımı). Ölçümler veritabanına deney ürünleri ve siparişleri ekler; mümkünse ayrı bir veritabanında çalışın.

Yönetici şifresi `ERP_PASSWORD` ortam değişkeniyle verilir (bash: `ERP_PASSWORD=... komut`; PowerShell: önce `$env:ERP_PASSWORD='...'`, ardından komut). API adresi `--base-url` ya da `ERP_API` ile değiştirilebilir (varsayılan `http://localhost:8000`).

## Deney 1: Eşzamanlı onayda stok kilidi

Stratejiler backend'de `STOCK_STRATEGY` ile seçilir:

| Strateji | Davranış |
|---|---|
| `pessimistic` (varsayılan) | Ürün satırı `SELECT ... FOR UPDATE` ile kilitlenir |
| `optimistic` | Kilit yok; `UPDATE ... WHERE version = ?`, çakışmada 3 deneme, sonra 409 |
| `none` | Yalnızca deney referansı: kilitsiz oku-kontrol et-yaz (fazla satışa açık, üretimde kullanılmaz) |

```bash
ERP_PASSWORD=... python deney1.py --strategies none,pessimistic,optimistic \
    --concurrency 10,50,100 --stock 0.5 --repetitions 30 --workers 4 --restart \
    --database erp_deney --pool-size 10 --max-overflow 12
python analyze_deney1.py
```

PowerShell:

```powershell
$env:ERP_PASSWORD='...'
python deney1.py --strategies none,pessimistic,optimistic `
    --concurrency 10,50,100 --stock 0.5 --repetitions 30 --workers 4 --restart `
    --database erp_deney --pool-size 10 --max-overflow 12
python analyze_deney1.py
```

- `--restart` backend'i her strateji için `STOCK_STRATEGY` ve `UVICORN_WORKERS` ile yeniden başlatır; bitince varsayılana (`pessimistic`, 1 worker) döndürür.
- `--database erp_deney` ayrı bir deney veritabanı kullanır: yoksa oluşturulur, backend açılışta göçleri uygular ve seed çalıştırılır; demo verisi kirlenmez.
- `--pool-size 10 --max-overflow 12` worker başına bağlantı havuzudur; 4 worker × 22 = 88 bağlantı, PostgreSQL'in 100 bağlantı sınırının altında kalır.
- `--stock 0.5`, başlangıç stoğunu eşzamanlı istek sayısının yarısı yapar (talep stoktan fazla). Tam sayı da verilebilir.
- Her koşu `results/deney1.csv` dosyasına bir satır ekler: onaylanan, stok yetersiz, diğer hatalar, son stok, fazla satış (onaylanan − başlangıç stoğu), kayıp güncelleme (onaylanan satışların stoğa yansımayan kısmı), ortalama ve p95 süre, başarısız istek oranı.
- `analyze_deney1.py` strateji ve eşzamanlılık düzeyine göre medyan ve çeyrekler açıklığı (IQR) ile özet verir. Stratejiler arasındaki fark Kruskal-Wallis testi ve etki büyüklüğü ε² ile, ardından Holm düzeltmeli Dunn ikili karşılaştırmaları ve Cliff's δ ile incelenir.

Eşzamanlı onay istekleri Locust yerine `httpx` ile aynı anda gönderilir: her koşuda tam N isteğin birlikte başlaması ve koşunun sabit süre beklememesi için. Genel yük testi için Locust senaryosu ayrıca vardır.

## Deney 2: Sorgu indekslerinin etkisi

Anlamlı sonuç için önce Olist verisini yükleyin (ana README, "Olist verisi"). Araç backend konteynerinde çalışır; 0002 göçündeki indeksleri kaldırıp geri ekleyerek dashboard, sipariş listesi, rapor ve ürün geçmişi sorgularını iki koşulda `EXPLAIN (ANALYZE, BUFFERS)` ile ölçer (ilk koşu ısınma, ardından N tekrar):

```bash
docker compose exec -T backend python -m app.benchmarks.indexes --repetitions 30 > results/deney2.csv
python analyze_deney2.py
```

- İndeksler göç geri alınarak değil doğrudan kaldırılır (`alembic downgrade 0001` sipariş kodu dizisini de geri alırdı) ve araç bitince, hata olsa bile, geri eklenir.
- Sorgu parametreleri verideki en son sipariş tarihine göre seçilir (Olist 2016–2018).
- `analyze_deney2.py` sorgu başına medyan süreleri ve hızlanma oranını (medyanlar oranı, bootstrap ile %95 güven aralığı) verir. İki koşul çift yönlü Mann-Whitney U testi ve Cliff's δ ile karşılaştırılır; 9 sorgunun p değerlerine Holm düzeltmesi uygulanır.
- Ölçüm sırasında başka yük çalıştırmayın (Deney 1 ile aynı anda değil).

## Deney 3: SUS

Materyaller ve puanlama `sus/` klasöründe (bkz. `sus/README.md`).

## Genel yük testi (Locust)

```bash
ERP_PASSWORD=... locust -f locustfile.py --host http://localhost:8000 --headless -u 50 -r 10 -t 2m --csv results/yuk
```

Yönetici (dashboard, sipariş, ürün ve müşteri listeleri) ve depo personeli (stok listesi, kritik stok) kullanıcıları.

## Ortam bilgisi

Sonuçları raporlarken işlemci, bellek, işletim sistemi, Docker sürümü, worker sayısı ve veri hacmini (Olist yüklü mü) not edin.
