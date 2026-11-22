# Deney sonuçları

Ortam: `ortam-deney1.txt`, `ortam-deney2.txt`. Özet çıktılar: `deney1-ozet.txt`, `deney2-ozet.txt`.

## Deney 1: Eşzamanlı onayda stok kilidi (`deney1.csv`)

3 strateji × 3 eşzamanlılık düzeyi (10 / 50 / 100 eşzamanlı onay) × 30 tekrar = 270 koşu. Her koşuda başlangıç stoku eşzamanlı istek sayısının yarısıdır (talep stoktan fazladır). 4 uvicorn worker, worker başına bağlantı havuzu 10 + 12, ayrı veritabanı.

| Strateji | N | Onaylanan | Fazla satış | Kayıp güncelleme | Başarısız oran | p95 (ms) |
|---|---|---|---|---|---|---|
| none | 10 | 10,0 | 5,0 | 8,4 | 0 | 246 |
| none | 50 | 50,0 | 25,0 | 47,0 | 0 | 1105 |
| none | 100 | 100,0 | 50,0 | 95,9 | 0 | 1406 |
| pessimistic | 10 | 5,0 | 0 | 0 | 0 | 92 |
| pessimistic | 50 | 25,0 | 0 | 0 | 0 | 380 |
| pessimistic | 100 | 50,0 | 0 | 0 | 0 | 807 |
| optimistic | 10 | 4,9 | 0 | 0 | 0,26 | 173 |
| optimistic | 50 | 10,0 | 0 | 0 | 0,80 | 734 |
| optimistic | 100 | 12,5 | 0 | 0 | 0,88 | 1597 |

Bulgular:
- **none** (kilitsiz) her koşuda stoğun iki katını sattı; stok düşüşlerinin çoğu kayboldu (kayıp güncelleme).
- **pessimistic** (`SELECT … FOR UPDATE`) hiç fazla satış yapmadı, stoğun tamamını sattı ve tüm düzeylerde en düşük p95 süresini verdi.
- **optimistic** (sürüm numarası, 3 deneme) fazla satış yapmadı; ancak yoğun çakışmada istekler yeniden denemeleri tüketip reddedildi: satılabilecek stoğun N=100'de yalnızca dörtte biri satıldı.
- Stratejiler arasında p95 farkı her düzeyde anlamlı (Kruskal-Wallis ve ANOVA, p < 0,001).

Ek dosyalar (yöntem notu olarak):
- `deney1-havuz15-yarim.csv`: worker başına 5 + 10 bağlantı havuzuyla ilk koşu; N=100'de havuz yetersiz kaldı ve koşu yarıda kaldı. Havuz ayarlanabilir yapıldı (#37).
- `deney1-kilitlenme-oncesi.csv`: havuz büyütüldükten sonraki koşu; N=100'de koşuların ~%20'sinde istekler 30 sn kilitlendi. Neden: istek adımları arasında bağlantının tutulması. Düzeltildi (#38); `deney1.csv` düzeltme sonrasıdır.

## Deney 2: Sorgu indekslerinin etkisi (`deney2.csv`)

Olist verisi (98.666 sipariş, 102.425 kalem) üzerinde 9 sorgu, indeksli ve indekssiz, `EXPLAIN (ANALYZE, BUFFERS)` ile 1 ısınma + 30 tekrar. Süre = planlama + yürütme.

| Sorgu | İndeksli medyan (ms) | İndekssiz medyan (ms) | Hızlanma | Wilcoxon p |
|---|---|---|---|---|
| Sipariş listesi (tarih) | 0,11 | 12,11 | 108× | < 0,001 |
| Dashboard aylık satış | 0,15 | 12,40 | 81× | < 0,001 |
| Sipariş listesi (durum) | 0,11 | 7,45 | 70× | < 0,001 |
| Dashboard günlük trend | 0,21 | 12,93 | 63× | < 0,001 |
| Müşteri siparişleri | 0,12 | 7,44 | 63× | < 0,001 |
| Ürün bazında satış raporu | 0,45 | 12,25 | 27× | < 0,001 |
| Dashboard en çok satanlar | 0,68 | 11,66 | 17× | < 0,001 |
| Müşteri istatistiği raporu | 109,2 | 100,6 | 0,92× | 0,077 (anlamlı değil) |
| Ürün satış geçmişi | 13,96 | 5,49 | 0,39× (yavaşlama) | < 0,001 |

Bulgular:
- Tarih, durum ve müşteri filtreli sorgular indeksle 17–108 kat hızlandı.
- Tüm siparişleri toplayan müşteri istatistiğinde fark anlamlı değil (sorgu tüm tabloyu okumak zorunda).
- Ürün satış geçmişinde planlayıcı indeksli bir plan seçiyor ancak bu plan indekssiz plandan yavaş; sorgu ya da indeks yeniden ele alınmalı (ör. `order_items (product_id)` yerine sipariş tarihini de kapsayan bir yaklaşım).
