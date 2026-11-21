# Güvenlik Kontrolü (OWASP Top 10 – 2021)

Tarih: 22.11.2026. Kapsam: `backend/` (FastAPI API) ve `frontend/` bağımlılıkları. Kontrol kod incelemesi, bağımlılık taraması ve otomatik testlerle yapıldı; sızma testi yapılmadı.

Sonuç değerleri: **Uygun** (sorun bulunmadı), **Düzeltildi** (bu çalışmada giderildi), **Açık** (bulundu, giderilmedi), **Kapsam dışı** (gerekçesiyle), **doğrulanmadı** (kontrol edilemedi).

## Özet

| Madde | Konu | Sonuç |
|---|---|---|
| A01 | Erişim denetimi hataları | Uygun (testlerle doğrulandı) |
| A02 | Kriptografik hatalar | Düzeltildi |
| A03 | Enjeksiyon | Uygun; Excel formül enjeksiyonu Açık |
| A04 | Güvensiz tasarım | Uygun |
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
- Sonuç: **Uygun**.

### A02 – Kriptografik hatalar

- Şifreler bcrypt ile saklanır. JWT HS256 ile imzalanır; `SECRET_KEY` en az 16 karakter olmalıdır.
- Düzeltme: token doğrulaması artık `exp` alanını zorunlu tutar (süresiz token kabul edilmez). `ALGORITHM` ayarı yalnızca `HS256`, `HS384`, `HS512` değerlerini alabilir; `none` gibi değerler açılışta reddedilir.
- HTTPS ve HSTS dağıtım ortamında (ters vekil) sağlanmalıdır: **Kapsam dışı** – uygulama kodunda değil, sunucu yapılandırmasındadır.
- Sonuç: **Düzeltildi**.

### A03 – Enjeksiyon

- Veritabanı erişimi SQLAlchemy ORM ve parametreli sorgularla yapılır. Ham SQL yalnızca ölçüm betiğinde (`app/benchmarks`) sabit adlarla kullanılır. Sıralama parametreleri desenle sınırlanır.
- Önyüzde `dangerouslySetInnerHTML` ya da `eval` kullanılmaz; React çıktıyı kaçışlar.
- **Açık:** Excel dışa aktarımında (`app/services/xlsx.py`) `=`, `+`, `-`, `@` ile başlayan metinler formül olarak yazılır. Müşteri kendi adını kayıtta serbestçe girdiği için sipariş raporunda formül çalıştırılabilir (CSV/Excel formül enjeksiyonu). Öneri: bu karakterlerle başlayan metin hücrelerinin başına `'` eklenmesi ya da hücrenin metin olarak yazılması. Bu dosya bu çalışmanın kapsamı dışında kaldığı için düzeltilmedi.

### A04 – Güvensiz tasarım

- Sipariş tutarı sunucudaki fiyatlarla hesaplanır; sepet sunucuda yeniden doğrulanır. Stok güncellemeleri kilitlenir (kötümser kilit). Yeni kayıtlar her zaman müşteri rolüyle açılır.
- Sonuç: **Uygun**.

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

- Şifre kuralı: en az 8 karakter, büyük harf, küçük harf ve rakam; en fazla 128 karakter. Aynı e-posta için 15 dakikada 5 hatalı denemeden sonra giriş geçici olarak engellenir (429). Token süresi 60 dakikadır; pasif hesaplar reddedilir.
- Testler: bozuk, yanlış anahtarla imzalanmış, süresi dolmuş, `exp` alanı olmayan, `alg: none` ve var olmayan kullanıcıya ait tokenlar 401 alır.
- Sınırlamalar (düzeltilmedi, düşük risk): deneme sayacı bellekte ve süreç başınadır, IP bazlı sınır yoktur; kayıtta e-postanın kullanımda olduğu bildirilir (kullanıcı deneyimi gereği); token önyüzde `localStorage`'da tutulur (XSS durumunda okunabilir, A03 ve CSP ile birlikte değerlendirilmelidir). Token iptali (çıkış sonrası geçersiz kılma) yoktur; kısa süreli token ile sınırlanır.
- Sonuç: **Uygun** (sınırlamalarla).

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

- Sayfalama: `page_size` en fazla 100 (rapor tablosunda 200), dashboard `limit` en fazla 20.
- Metin alanları ve arama parametreleri en fazla uzunlukla sınırlıdır (ör. arama 100, adres 1000, açıklama 2000 karakter). Sipariş ve sepet en fazla 100 kalem alır.
- Sonuç: **Uygun**; değişiklik gerekmedi.

## Testler

- `tests/test_security_access.py`: uç nokta envanteri, 401/403 kontrolleri, token doğrulaması, IDOR.
- `tests/test_security_headers.py`: güvenlik başlıkları ve dokümantasyon yollarında CSP istisnası.
- `tests/test_security_config.py`: CORS davranışı ve JWT algoritma kısıtı.
