# Güvenlik Kontrolü (OWASP Top 10 – 2021)

Tarih: 22.11.2026. Kapsam: `backend/` (FastAPI API) ve `frontend/` bağımlılıkları. Kontrol kod incelemesi, bağımlılık taraması ve otomatik testlerle yapıldı; sızma testi yapılmadı.

Sonuç değerleri: **Uygun** (sorun bulunmadı), **Düzeltildi** (bu çalışmada giderildi), **Açık** (bulundu, giderilmedi), **Kapsam dışı** (gerekçesiyle), **doğrulanmadı** (kontrol edilemedi).

## Özet

| Madde | Konu | Sonuç |
|---|---|---|
| A01 | Erişim denetimi hataları | Uygun (testlerle doğrulandı) |
| A02 | Kriptografik hatalar | Düzeltildi |
| A03 | Enjeksiyon | Uygun; Excel formül enjeksiyonu Düzeltildi |
| A04 | Güvensiz tasarım | Düzeltildi (kalan risk belgelendi) |
| A05 | Güvenlik yanlış yapılandırması | Düzeltildi |
| A06 | Zafiyetli ve güncel olmayan bileşenler | Uygun |
| A07 | Kimlik doğrulama hataları | Uygun (sınırlamalarla) |
| A08 | Yazılım ve veri bütünlüğü hataları | Uygun |
| A09 | Güvenlik günlüğü ve izleme eksikleri | Açık |
| A10 | Sunucu taraflı istek sahteciliği (SSRF) | Uygun |

## Ayrıntılar

### A01 – Erişim denetimi

- `tests/test_security_access.py` uygulamadaki tüm uç noktaları otomatik toplar. Herkese açık olanlar (`/health`, `/auth/register`, `/auth/login`, Swagger/ReDoc/OpenAPI) dışındaki her uç nokta tokensız istekte 401 döndürür.
- Müşteri tokenı personel uçlarında (`/users`, `/products`, `/stock`, `/orders`, `/customers`, `/dashboard`, `/reports`, `/categories`) 403 alır. Depo personeli yalnızca yönetici uçlarında 403 alır. Personel mağaza uçlarında (`/catalog`, `/me`) 403 alır.
- Rol kısıtı olmayan korumalı uç yalnızca profil uçlarıdır (`/auth/me`, `/auth/me/password`). Yeni bir uç rol belirtmeden eklenirse test kırılır.
- IDOR: müşteri başka müşterinin siparişini `/me/orders/{id}` ile göremez, iptal edemez ve listede bulamaz (404). Sorgular oturumdaki müşteriyle sınırlanır.
- Müşteri kartına bağlanma: yöneticinin uygulamada açtığı bir kartın e-postasıyla kayıt olan kişi, davet kodu girmeden karta bağlanamaz ve kartın siparişlerini göremez (aşağıda A04). Hesaba bağlı bir kartın e-postasıyla yeni kayıt 409 döner; kart önceki sahibinden alınamaz (`tests/test_auth.py`, `tests/test_customers.py`).
- Sonuç: **Uygun**.

### A02 – Kriptografik hatalar

- Şifreler bcrypt ile saklanır. JWT HS256 ile imzalanır; `SECRET_KEY` en az 32 karakter olmalıdır; örnek dosyadaki yer tutucu değerle uygulama açılmaz.
- Düzeltme: token doğrulaması artık `exp` alanını zorunlu tutar (süresiz token kabul edilmez). `ALGORITHM` ayarı yalnızca `HS256`, `HS384`, `HS512` değerlerini alabilir; `none` gibi değerler açılışta reddedilir.
- HTTPS ve HSTS dağıtım ortamında (ters vekil) sağlanmalıdır: **Kapsam dışı** – uygulama kodunda değil, sunucu yapılandırmasındadır.
- Sonuç: **Düzeltildi**.

### A03 – Enjeksiyon

- Veritabanı erişimi SQLAlchemy ORM ve parametreli sorgularla yapılır. Ham SQL yalnızca ölçüm betiğinde (`app/benchmarks`) sabit adlarla kullanılır. Sıralama parametreleri desenle sınırlanır.
- Önyüzde `dangerouslySetInnerHTML` ya da `eval` kullanılmaz; React çıktıyı kaçışlar.
- **Düzeltildi:** Excel dışa aktarımında (`app/services/xlsx.py`) `=` ile başlayan metinler formül olarak yazılıyordu; müşteri kendi adını kayıtta serbestçe girdiği için sipariş raporunda formül çalıştırılabilirdi. Raporlar yalnızca veri içerdiğinden tüm hücreler artık metin ya da sayı olarak yazılır, formül olarak yazılmaz (`tests/test_xlsx.py`).

### A04 – Güvensiz tasarım

- Sipariş tutarı sunucudaki fiyatlarla hesaplanır; sepet sunucuda yeniden doğrulanır. Stok güncellemeleri kilitlenir (kötümser kilit). Yeni kayıtlar her zaman müşteri rolüyle açılır.
- **Düzeltildi:** Kayıt olurken ya da kullanıcı müşteri rolüne alınırken aynı e-postalı müşteri kartı hesaba otomatik bağlanıyordu. Olist'ten aktarılan kartların e-postaları tahmin edilebilir (`olist-00001@example.com`) olduğundan bu kartlar artık hiçbir hesaba bağlanmaz; bu e-postayla kayıt 409 döner (`tests/test_auth.py`, `tests/test_users.py`).
- **Düzeltildi:** Yöneticinin uygulamada eklediği müşteri kartı, aynı e-postayla ilk kayıt olan kişiye otomatik bağlanıyordu; kişi kartın sipariş geçmişini, adresini ve telefonunu görüyordu. E-posta gönderimi kapsam dışı olduğundan e-posta doğrulaması yerine **davet kodu** kullanılır:
  - Yönetici müşteri detayında "Davet Kodu Oluştur" ile kod üretir (`POST /customers/{id}/invite`) ve müşteriye kendisi iletir.
  - Kart varken kodsuz kayıt `INVITE_CODE_REQUIRED` (400) ile reddedilir; hesap açılmaz, kart bağlanmaz.
  - Kod tek kullanımlıktır, 7 gün geçerlidir; yeni kod üretmek ve kartın e-postasını değiştirmek eski kodu geçersiz kılar. Yanlış, süresi geçmiş, kullanılmış ya da pasif karta ait kod `INVALID_INVITE_CODE` (400) döner.
  - Kod yaklaşık 49 bit rastgeledir. Veritabanında düz hali değil, `SECRET_KEY` ile anahtarlanmış HMAC-SHA256 özeti saklanır (`app/core/invite_codes.py`).
  - Testler: `tests/test_auth.py`, `tests/test_customers.py`.
- Yönetici bir personel hesabını Müşteri rolüne aldığında aynı e-postalı kart bağlanır. Bu bağlamayı yönetici kendisi yaptığı için yönetici onayı sayılır. Kartı olmayan hesaplar yalnızca personel hesaplarıdır; kayıt olan her hesabın kartı vardır.
- **Kalan risk:** Kayıt ucu, kartı olan bir e-postayı "davet kodu gerekli" yanıtıyla belli eder (e-posta adresinin sistemde olup olmadığı zaten `EMAIL_TAKEN` ile anlaşılabiliyordu). Kod tahmini kayıt ucunun IP başına deneme sınırı (A07), 7 günlük süre ve kodun büyüklüğüyle pratikte önlenir.
- Sonuç: **Düzeltildi**; kalan risk yukarıda belgelendi.

### A05 – Güvenlik yanlış yapılandırması

- Düzeltme: tüm API yanıtlarına `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer` ve kısıtlayıcı bir `Content-Security-Policy` eklendi (`app/core/security_headers.py`). Swagger UI ve ReDoc CDN'den betik yüklediği için `/docs`, `/redoc`, `/openapi.json` yollarında CSP eklenmez.
- Düzeltme: CORS'ta `allow_credentials` kapatıldı. Kimlik doğrulama `Authorization` başlığıyla yapılır, çerez kullanılmaz. İzinli kaynaklar açık listedir (`localhost:5173` + `CORS_ORIGINS`); bilinmeyen kaynak reddedilir.
- Beklenmeyen hatalarda ayrıntı istemciye dönmez, yalnızca sunucu loguna yazılır. İstek gövdelerinde tanımsız alanlar reddedilir.
- Not: 500 yanıtları Starlette'in en dıştaki hata katmanında üretildiği için güvenlik başlıklarını taşımaz; gövde ayrıntı içermediği için risk düşüktür.
- Sonuç: **Düzeltildi**.

### A06 – Zafiyetli bileşenler

| Tarama | Araç | Sonuç |
|---|---|---|
| Arka uç (`requirements.txt`) | pip-audit 2.10.1 | Bilinen zafiyet yok |
| Arka uç geliştirme (`requirements-dev.txt`) | pip-audit 2.10.1 | Bilinen zafiyet yok |
| Önyüz üretim bağımlılıkları | `npm audit --omit=dev` (npm 11.21.0) | 0 zafiyet |
| Önyüz tüm bağımlılıklar | `npm audit` | 0 zafiyet |

Sürümler tam olarak sabitlenmiştir (`==` ve `package-lock.json`); değişiklik gerekmedi. Sonuç: **Uygun**.

### A07 – Kimlik doğrulama hataları

- Şifre kuralı: en az 8 karakter, büyük harf, küçük harf ve rakam; en fazla 128 karakter. 15 dakika içinde aynı e-postaya 5 hatalı denemeden sonra o e-postayla giriş (her IP'den) engellenir (429). Token süresi 60 dakikadır; pasif hesaplar reddedilir.
- **Düzeltildi:** Giriş sayacı bellekte ve yalnızca e-postaya göre tutuluyordu: uygulama yeniden başlayınca sıfırlanıyor, her uvicorn süreci kendi sayacını tutuyor ve aynı IP'den farklı e-postalar sınırsız denenebiliyordu. Hatalı denemeler artık `login_attempts` tablosunda e-posta ve IP ile saklanır (`app/services/login_throttle.py`). Aynı IP'den 15 dakikada 20 hatalı denemeden sonra o IP 15 dakika engellenir. Sayaçlar yeniden başlatmada korunur ve tüm süreçlerde ortaktır. Başarılı giriş yalnızca o e-postanın sayacını sıfırlar; saldırgan kendi hesabına girerek IP sayacını temizleyemez. Pencereden eski kayıtlar yeni deneme yazılırken silinir (`tests/test_auth.py`).
- **Düzeltildi:** Kayıt ucunda hız sınırı yoktu; her kayıt bcrypt yüzünden yaklaşık 250 ms CPU harcadığından betikle binlerce hesap açılabilir, sunucu yorulabilirdi. Artık aynı IP'den 10 dakikada en fazla 5 kayıt denemesi yapılabilir (`REGISTER_RATE_LIMIT`, `REGISTER_RATE_WINDOW_MINUTES`). Başarısız denemeler de sayılır. Sınır aşılınca 429 `TOO_MANY_REQUESTS` ve `Retry-After` başlığı döner; giriş ucunun 429 yanıtı da bu başlığı taşır (`tests/test_auth.py`).
- Gerçek istemci adresi: arka uç nginx'in (üretim) ya da Vite'ın (geliştirme) arkasındadır. nginx `X-Forwarded-For` başlığını istemcinin bağlantı adresiyle ezer, uvicorn adresi bu başlıktan alır (`FORWARDED_ALLOW_IPS`). İstemcinin kendi eklediği başlık dikkate alınmaz; böylece sınır sahte adreslerle aşılamaz.
- **Düzeltildi:** Çıkış yapınca token geçersiz olmuyordu; çalınan bir token süresi bitene kadar (60 dakika) kullanılabiliyor, şifre değiştikten sonra da eski token'lar geçerli kalıyordu. Kullanıcı tablosuna `token_version` eklendi ve JWT'ye `ver` olarak yazılır; her istekte veritabanındaki sürümle karşılaştırılır (`app/core/deps.py`). "Çıkış Yap" sunucuya bildirilir (`POST /auth/logout`) ve sürümü artırır; şifre değişikliği de sürümü artırır ve yalnızca değişikliği yapan oturuma yeni token verir. Böylece eski token'lar (çalınmış kopyalar dahil) 401 alır. Çıkış kullanıcının tüm cihazlardaki oturumlarını kapatır. Bu sürümden önce verilen, `ver` taşımayan token'lar da reddedilir (`tests/test_auth.py`, `tests/test_security_access.py`).
- Testler: bozuk, yanlış anahtarla imzalanmış, süresi dolmuş, `exp` ya da `ver` alanı olmayan, eski sürümlü, `alg: none` ve var olmayan kullanıcıya ait tokenlar 401 alır.
- Sınırlamalar (düzeltilmedi, düşük risk): kayıt ucunun sayacı bellekte ve süreç başınadır (birden fazla uvicorn worker'ında sınır worker sayısıyla çarpılır); giriş sayacında kontrol ve yazma ayrı adımlar olduğundan eşzamanlı isteklerde sınır birkaç deneme aşılabilir; çok sayıda IP'ye dağıtılmış saldırı IP sınırına takılmaz (e-posta sınırı yine geçerlidir); kayıtta e-postanın kullanımda olduğu bildirilir (kullanıcı deneyimi gereği); token önyüzde `localStorage`'da tutulur (aşağıda).
- Sonuç: **Uygun** (sınırlamalarla).

#### Token'ın localStorage'da tutulması (A07 notu)

- **Risk:** Erişim token'ı tarayıcıda `localStorage`'da tutulur. Sayfada çalışan herhangi bir betik onu okuyabilir; uygulamada bir XSS açığı olursa saldırgan token'ı çalıp kullanıcı adına istek yapabilir. HttpOnly çerez bu riski kaldırırdı ama CSRF korumasını gerektirir; bu proje kapsamında `Authorization` başlığıyla devam edildi.
- **Alınan önlemler:**
  - React tüm çıktıyı kaçışlar; önyüzde `dangerouslySetInnerHTML` ve `eval` kullanılmaz (A03). Bilinen bir XSS açığı yoktur.
  - API yanıtları kısıtlayıcı bir `Content-Security-Policy` (`default-src 'none'`), `X-Content-Type-Options: nosniff` ve `X-Frame-Options: DENY` taşır; böylece bir API yanıtı tarayıcıda belge olarak açılsa bile betik çalıştıramaz.
  - Excel dışa aktarımında formül enjeksiyonu engellenir (A03).
  - Çalınan bir token'ın ömrü sınırlıdır: en fazla 60 dakika geçerlidir ve kullanıcı çıkış yaptığında ya da şifresini değiştirdiğinde hemen geçersizleşir (token sürümü).
- **Kalan risk:** Önyüz sayfasının (nginx'in sunduğu `index.html`) kendi `Content-Security-Policy` başlığı yoktur; API'nin CSP'si sayfada çalışan betikleri kısıtlamaz. Önerilen politika: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` (Ant Design satır içi stil kullandığından `style-src` için `'unsafe-inline'` gerekir). Gerçek tarayıcıda denenerek eklenmelidir.

### A08 – Yazılım ve veri bütünlüğü

- Bağımlılıklar sabit sürümlü ve kilit dosyalıdır; CI her değişiklikte testleri çalıştırır. Güvenilmeyen veriden nesne çözme (pickle vb.) yoktur.
- Paket imza doğrulaması: **doğrulanmadı**.
- Sonuç: **Uygun**.

### A09 – Günlük ve izleme

- Yalnızca beklenmeyen hatalar ve bağlantı havuzu doluluğu loglanır. Başarısız giriş, yetkisiz erişim (401/403) ve rol değişikliği gibi güvenlik olayları loglanmaz; merkezi izleme ve uyarı yoktur.
- Sonuç: **Açık** – proje ölçeğinde (tek sunucu, demo) önceliklendirilmedi.

### A10 – SSRF

- Sunucu kullanıcıdan gelen bir adrese istek atmaz. Ürün görsel adresi (`image_url`) yalnızca `http(s)` olarak doğrulanıp saklanır, sunucu tarafından indirilmez.
- Sonuç: **Uygun**.

## Girdi doğrulama ve sınırlar

- Sayfalama: `page` en fazla 100000, `page_size` en fazla 100 (rapor tablosunda 200), dashboard `limit` en fazla 20.
- Sipariş satır tutarı ve sipariş toplamı `Numeric(12,2)` sınırını (9.999.999.999,99) aşarsa istek 422 ile reddedilir.
- Metin alanları ve arama parametreleri en fazla uzunlukla sınırlıdır (ör. arama 100, adres 1000, açıklama 2000 karakter). Sipariş ve sepet en fazla 100 kalem alır.
- Sonuç: **Uygun**; değişiklik gerekmedi.

## Testler

- `tests/test_security_access.py`: uç nokta envanteri, 401/403 kontrolleri, token doğrulaması, IDOR.
- `tests/test_security_headers.py`: güvenlik başlıkları ve dokümantasyon yollarında CSP istisnası.
- `tests/test_security_config.py`: CORS davranışı ve JWT algoritma kısıtı.
