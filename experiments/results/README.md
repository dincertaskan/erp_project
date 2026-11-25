# Deney sonuçları

Ortam: `ortam-deney1.txt`, `ortam-deney2.txt`. Özet çıktılar: `deney1-ozet.txt`, `deney2-ozet.txt` (`python analyze_deney1.py > results/deney1-ozet.txt`, `python analyze_deney2.py > results/deney2-ozet.txt`). Aşağıdaki tablolar bu çıktılardan alınmıştır.

## Deney 1: Eşzamanlı onayda stok kilidi (`deney1.csv`)

3 strateji × 3 eşzamanlılık düzeyi (10 / 50 / 100 eşzamanlı onay) × 30 tekrar = 270 koşu. Her koşuda başlangıç stoğu eşzamanlı istek sayısının yarısıdır (talep stoktan fazladır). 4 uvicorn worker, worker başına bağlantı havuzu 10 + 12, ayrı veritabanı.

CSV'de her satır bir koşunun özetidir; istek düzeyinde süreler saklanmamıştır. Tablodaki süre değerleri 30 koşunun p95 değerlerinin ortalaması ve medyanıdır (IQR: 1.–3. çeyrek).

| Strateji | N | Onaylanan | Başarı oranı | Fazla satış | Kayıp güncelleme | Başarısız oran | p95 ort. (ms) | p95 medyan [IQR] (ms) |
|---|---|---|---|---|---|---|---|---|
| none | 10 | 10,0 | 1,00 | 5,0 | 8,4 | 0 | 246 | 180 [166–234] |
| none | 50 | 50,0 | 1,00 | 25,0 | 47,0 | 0 | 1105 | 973 [847–1103] |
| none | 100 | 100,0 | 1,00 | 50,0 | 95,9 | 0 | 1406 | 1123 [1071–1335] |
| pessimistic | 10 | 5,0 | 0,50 | 0 | 0 | 0 | 92 | 83 [70–110] |
| pessimistic | 50 | 25,0 | 0,50 | 0 | 0 | 0 | 380 | 366 [353–402] |
| pessimistic | 100 | 50,0 | 0,50 | 0 | 0 | 0 | 807 | 785 [765–847] |
| optimistic | 10 | 4,9 | 0,49 | 0 | 0 | 0,26 | 173 | 173 [149–198] |
| optimistic | 50 | 10,0 | 0,20 | 0 | 0 | 0,80 | 734 | 732 [653–791] |
| optimistic | 100 | 12,5 | 0,125 | 0 | 0 | 0,88 | 1597 | 1548 [1489–1667] |

Başarı oranı = onaylanan / N. Başarısız oran, stok yetersizliği dışındaki ret oranıdır (optimistic'te 409 çakışma).

**p95 tanımı.** Bu CSV, sıralı süre listesinde round(0,95·N)'inci değeri alan formülle üretilmiştir. N=10'da bu değer koşunun en yavaş isteğine (maksimuma) eşittir; N=50'de 48./50, N=100'de 95./100 değerdir. Dolayısıyla N=10 sütunundaki "p95" fiilen koşu başına en uzun süredir. `deney1.py` bundan sonraki koşular için doğrusal enterpolasyonlu yüzdeliğe (`numpy.percentile`, linear) geçirilmiştir; mevcut değerler yeniden hesaplanamaz. Bu nedenle analizde koşu ortalama süresi (`mean_ms`) de ayrıca test edilmiş ve aynı örüntü bulunmuştur (`deney1-ozet.txt`).

**Stratejilerin iş yükü farklıdır.** none isteklerin tamamını onaylar; pessimistic yarısını stok yetersizliği nedeniyle hızlıca reddeder; optimistic ise N=50 ve N=100'de isteklerin çoğunu 409 ile reddeder. Süreler başarılı ve reddedilen isteklerin karışımıdır. Yalnızca başarılı onayların süresi ve saniyede başarılı onay sayısı bu veriden hesaplanamaz (istek düzeyinde süre ve koşu süresi saklanmadı). Bu yüzden süre karşılaştırmaları "aynı işi daha hızlı yapma" biçiminde yorumlanmamalıdır. `deney1.py` artık bu ölçüleri de kaydeder (`ok_mean_ms`, `ok_p95_ms`, `duration_ms`, `ok_per_s`); yeni koşularda `analyze_deney1.py` bunları ayrıca raporlar.

### İstatistik testleri (p95, her N ayrı)

Kruskal-Wallis (etki büyüklüğü ε²), ardından Holm düzeltmeli Dunn ikili karşılaştırmaları ve Cliff's δ. δ > 0, soldaki stratejinin sürelerinin genelde daha uzun olduğunu gösterir.

| N | Kruskal-Wallis | none – pessimistic | none – optimistic | pessimistic – optimistic |
|---|---|---|---|---|
| 10 | H = 53,8; p < 0,001; ε² = 0,60 | p < 0,001; δ = +0,96 | p = 0,17; δ = +0,28 | p < 0,001; δ = −0,91 |
| 50 | H = 72,8; p < 0,001; ε² = 0,81 | p < 0,001; δ = +1,00 | p < 0,001; δ = +0,82 | p < 0,001; δ = −1,00 |
| 100 | H = 66,9; p < 0,001; ε² = 0,75 | p < 0,001; δ = +1,00 | p = 0,006; δ = −0,62 | p < 0,001; δ = −1,00 |

Tek yönlü ANOVA da her düzeyde p < 0,001 vermektedir; ancak dağılımlar çarpık olduğundan (ör. none'da ortalama medyanın belirgin üstünde) parametrik olmayan sonuçlar esas alınmıştır.

### Isınma etkisi ve duyarlılık analizi

Isınma koşusu yapılmamıştır ve ilk ölçülen koşul none N=10'dur. none'ın ilk koşusu her üç düzeyde de kalan koşuların Tukey üst sınırının (Q3 + 1,5·IQR) üzerindedir; none N=10'da ilk dört koşu 437–728 ms iken kalan koşuların medyanı 179 ms'dir, none N=100'de ilk üç koşu 1880–3987 ms'dir. pessimistic ve optimistic'te ilk koşu aykırı değildir. none N=50'nin son dört koşusunda da (1626–2648 ms) yükselme vardır; bu, veritabanının koşular boyunca büyümesiyle ya da ortamdaki başka bir yükle ilişkili olabilir.

Her koşulun ilk koşusu çıkarıldığında none N=10 p95 ortalaması 246'dan 234 ms'ye, ilk 5 koşu çıkarıldığında 197 ms'ye iner (medyan 180 → 179 → 178 ms); none N=100 ortalaması 1406 → 1389 → 1160 ms olur. Her iki duyarlılık analizinde de ikili karşılaştırmaların anlamlılık örüntüsü değişmez (none – optimistic N=10'da p = 0,27 ve 0,55; diğer tüm çiftlerde p < 0,01). Isınma, none'ın ortalamalarını şişirmektedir; bu strateji için medyan daha temsilîdir.

### Bulgular

- **none** (kilitsiz) her koşuda stoğun iki katını sattı; stok düşüşlerinin çoğu kayboldu (kayıp güncelleme).
- **pessimistic** (`SELECT … FOR UPDATE`) hiç fazla satış yapmadı, stoğun tamamını sattı ve tüm düzeylerde en düşük p95 süresini verdi (diğer iki stratejiyle farkı her düzeyde anlamlı, |δ| ≥ 0,91). Ancak isteklerinin yarısı hızlı bir stok yetersizliği yanıtıyla sonuçlandığından bu fark kısmen yapılan işin azlığından kaynaklanır; başarılı onay başına süre bu veriyle karşılaştırılamaz.
- **optimistic** (sürüm numarası, 3 deneme) fazla satış yapmadı; ancak yoğun çakışmada istekler yeniden denemeleri tüketip reddedildi: satılabilecek stoğun N=100'de yalnızca dörtte biri satıldı. N=100'de reddettiği isteklere rağmen p95 süresi none'dan bile uzundur.
- Stratejiler arasındaki p95 farkı her düzeyde anlamlıdır (Kruskal-Wallis, p < 0,001); ancak ikili karşılaştırmada N=10'da none ile optimistic arasında anlamlı fark yoktur (p = 0,17). Önceki "her düzeyde tüm stratejiler farklı" yorumu bu çift için geçerli değildir.

Ek dosyalar (yöntem notu olarak):
- `deney1-havuz15-yarim.csv`: worker başına 5 + 10 bağlantı havuzuyla ilk koşu; N=100'de havuz yetersiz kaldı ve koşu yarıda kaldı. Havuz ayarlanabilir yapıldı (#37).
- `deney1-kilitlenme-oncesi.csv`: havuz büyütüldükten sonraki koşu; N=100'de koşuların ~%20'sinde istekler 30 sn kilitlendi. Neden: istek adımları arasında bağlantının tutulması. Düzeltildi (#38); `deney1.csv` düzeltme sonrasıdır.

## Deney 2: Sorgu indekslerinin etkisi (`deney2.csv`)

Olist verisi (98.666 sipariş, 102.425 kalem) üzerinde 9 sorgu, indeksli ve indekssiz, `EXPLAIN (ANALYZE, BUFFERS)` ile 1 ısınma + 30 tekrar. Süre = planlama + yürütme.

İki koşulun ölçümleri ayrı zamanlarda alındığından eşleştirilmiş değildir; önceki analizdeki Wilcoxon işaretli sıralar testi ölçümleri tekrar numarasına göre eşleştiriyordu ve bu eşleştirmenin bir dayanağı yoktu. Analiz bağımsız iki örneklem için iki yönlü Mann-Whitney U testiyle yenilenmiştir. Etki büyüklüğü Cliff's δ'dır (δ > 0: indekssiz süreler daha uzun). Hızlanma = indekssiz medyan / indeksli medyan; %95 güven aralığı bootstrap ile (10.000 yeniden örnekleme) hesaplanmıştır.

| Sorgu | İndeksli medyan (ms) | İndekssiz medyan (ms) | Hızlanma [%95 GA] | Mann-Whitney p | Cliff's δ |
|---|---|---|---|---|---|
| Sipariş listesi (tarih) | 0,11 | 12,11 | 108× [100–118] | < 0,001 | +1,00 |
| Dashboard aylık satış | 0,15 | 12,40 | 81× [74–89] | < 0,001 | +1,00 |
| Sipariş listesi (durum) | 0,11 | 7,45 | 70× [68–76] | < 0,001 | +1,00 |
| Dashboard günlük trend | 0,21 | 12,93 | 63× [57–69] | < 0,001 | +1,00 |
| Müşteri siparişleri | 0,12 | 7,44 | 63× [59–75] | < 0,001 | +1,00 |
| Ürün bazında satış raporu | 0,45 | 12,25 | 27× [24–31] | < 0,001 | +1,00 |
| Dashboard en çok satanlar | 0,68 | 11,66 | 17× [16–19] | < 0,001 | +1,00 |
| Müşteri istatistiği raporu | 109,2 | 100,6 | 0,92× [0,88–1,02] | 0,054 (anlamlı değil) | −0,29 |
| Ürün satış geçmişi | 13,96 | 5,49 | 0,39× [0,36–0,44] (yavaşlama) | < 0,001 | −1,00 |

p değerleri 9 sorgu için Holm yöntemiyle düzeltildiğinde de aynı sonuç elde edilir. δ = ±1,00, iki koşulun dağılımlarının hiç örtüşmediğini gösterir.

Bulgular:
- Tarih, durum ve müşteri filtreli sorgular indeksle 17–108 kat hızlandı; güven aralıklarının hiçbiri 1'e yaklaşmaz.
- Tüm siparişleri toplayan müşteri istatistiğinde fark anlamlı değil (p = 0,054; hızlanmanın güven aralığı 1'i içeriyor); sorgu tüm tabloyu okumak zorunda.
- Ürün satış geçmişinde planlayıcı indeksli bir plan seçiyor ancak bu plan indekssiz plandan yavaş; sorgu ya da indeks yeniden ele alınmalı (ör. `order_items (product_id)` yerine sipariş tarihini de kapsayan bir yaklaşım).
- Test değişikliği hiçbir sorgunun sonucunu değiştirmedi; müşteri istatistiği raporunda p 0,077'den 0,054'e indi ve yine anlamlılık sınırının üstünde kaldı.

## Deney 3 (SUS)

Materyaller `experiments/sus/` klasöründedir (görevler, SUS formu, onam metni, yanıt şablonu ve puanlama betiği). Oturumlar henüz yapılmamıştır; sonuçlar `results/sus.csv` olarak eklenecektir. Planlanan katılımcı sayısı yaklaşık 10'dur; bu örneklemle 68 eşiğine karşı tek örneklem t-testinin gücü sınırlıdır. Bu nedenle sonuç, ortalama SUS puanı ve %95 güven aralığıyla raporlanacak; t-testi yalnızca ek bilgi olarak verilecektir.

## Genel yük testi (Locust)

`locustfile.py` isteğe bağlı genel yük testi senaryosudur. Bu çalışma kapsamında Locust ile ölçüm raporlanmamıştır.

## Geçerlilik tehditleri

Deney 1:
- Yük üreten istemci ile sunucu (backend, PostgreSQL) aynı makinede çalıştı (Windows + Docker Desktop). İstemci ve sunucu aynı işlemciyi paylaştığından mutlak süreler üretim ortamına genellenemez; stratejiler arasındaki göreli karşılaştırma daha güvenilirdir.
- Isınma koşusu yapılmadı. İlk ölçülen koşulun (none) ilk koşuları belirgin biçimde yavaştır; etkisi yukarıdaki duyarlılık analiziyle sınanmıştır.
- Stratejiler ve N düzeyleri sabit sırada (none → pessimistic → optimistic; her birinde 10 → 50 → 100) ve rastgeleleştirilmeden çalıştırıldı. Zamana bağlı etkiler (ısınma, arka plan yükü) strateji etkisiyle karışabilir.
- Her koşu yeni ürün ve siparişler oluşturur; veritabanı koşular boyunca büyür ve sonraki koşullar daha büyük tablolar üzerinde ölçülür.
- Tek parametre seti kullanıldı: stok oranı 0,5, 4 worker, worker başına havuz 10 + 12. Havuz boyutu, ilk denemede (`deney1-havuz15-yarim.csv`, 5 + 10) N=100'de görülen bağlantı havuzu tükenmesini önlemek için seçildi. Sonuçların farklı stok oranı, worker sayısı ya da havuz boyutunda aynı kalacağı sınanmadı.
- İstek düzeyinde süre saklanmadığından yalnızca koşu özetleri vardır; p95 formülü N=10'da maksimuma eşittir ve başarılı onaylara özgü süre ya da verim hesaplanamaz.

Deney 2:
- Yalnızca sıcak önbellek ölçüldü (tüm ölçümlerde `shared_read` = 0); soğuk önbellekte, diskten okuma gerektiğinde fark farklı olabilir.
- Ölçülen SQL, uygulamanın ORM'inin ürettiği sorgunun sadeleştirilmiş bir karşılığıdır; ORM sorgusunun kendisi değildir.
- Süre `EXPLAIN ANALYZE` planlama + yürütme süresidir; ağ, uygulama ve serileştirme dahil uçtan uca HTTP yanıt süresi değildir.
- Tek parametre seti (verideki son tarihe göre seçilen tarih aralıkları, tek müşteri) kullanıldı.
- İndeksli koşul her zaman önce ölçüldü; sıra etkisi dışlanamaz.
- `ortam-deney2.txt` dosyasındaki ölçüm zamanı (2026-11-21T18:28Z), yarıda kalan ilk Deney 1 denemesinin (`deney1-havuz15-yarim.csv`) ilk satırıyla (18:28:47Z) aynı dakikadadır; bu deneme 18:57:54Z'ye kadar sürdü. Deney 2 bu deneme ile aynı anda çalışmış olabilir. Bu durumda indekssiz koşul gibi uzun sorgular ek yükten etkilenmiş olabilir; Deney 2'nin sessiz bir ortamda yeniden çalıştırılması önerilir.
