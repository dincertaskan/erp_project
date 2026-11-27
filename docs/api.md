# API Özeti

Akıllı ERP arka ucunun uç noktalarının özeti. Ayrıntılı istek ve yanıt şemaları için çalışan uygulamada Swagger arayüzünü kullanın: http://localhost:8000/docs (OpenAPI belgesi: `/openapi.json`). Bu sayfalar `ENABLE_DOCS` ayarıyla açılıp kapatılır: geliştirmede varsayılan olarak açıktır, `docker-compose.prod.yml` ile kurulan üretim ortamında kapalıdır ve 404 döner.

## Genel kurallar

- **Adres:** Uç noktalar kök dizindedir (ör. `GET /products`). Önyüz geliştirme sunucusu `/api` önekiyle gelen istekleri öneki kaldırarak arka uca iletir.
- **Kimlik doğrulama:** `POST /auth/login` bir JWT döndürür (`access_token`, `token_type: "bearer"`, `user`). Korunan uçlarda `Authorization: Bearer <token>` başlığı gönderilir. Token süresi varsayılan olarak 60 dakikadır (`ACCESS_TOKEN_EXPIRE_MINUTES`).
- **Roller:** `admin` (Yönetici), `warehouse` (Depo Personeli), `customer` (Müşteri). Aşağıdaki tablolarda "Personel" Yönetici ve Depo Personelini birlikte ifade eder.
- **Sayfalama:** Sayfalı listeler `page` (varsayılan 1) ve `page_size` (varsayılan 20, en fazla 100) parametrelerini alır ve `{items, total, page, page_size}` biçiminde döner.
- **Sıralama:** `sort` parametresi alan adını alır; azalan sıra için başına `-` eklenir (ör. `sort=-stock`).
- **Tarih filtreleri:** Listelerde `from` ve `to` sorgu parametreleri kullanılır.

## Hata biçimi

Tüm hatalar aynı gövdeyle döner:

```json
{ "code": "INSUFFICIENT_STOCK", "message": "Yetersiz stok. Mevcut: 2.", "details": [...] }
```

| HTTP | Kod | Anlamı |
|---|---|---|
| 401 | `UNAUTHORIZED`, `INVALID_TOKEN`, `ACCOUNT_INACTIVE` | Token yok, geçersiz/süresi dolmuş ya da hesap pasif |
| 403 | `FORBIDDEN` | Rolün bu işleme yetkisi yok |
| 404 | `NOT_FOUND` | Kayıt bulunamadı |
| 409 | `CONFLICT` ve alana özgü kodlar | Çakışma (ör. aynı e-posta, yetersiz stok) |
| 422 | `VALIDATION_ERROR` | Girdi doğrulaması başarısız; `details` içinde `{field, message}` listesi |
| 429 | `TOO_MANY_REQUESTS` | Çok fazla hatalı giriş denemesi; `details.retry_after` saniye cinsinden |
| 503 | `SERVER_BUSY` | Veritabanı bağlantı havuzu dolu; `Retry-After: 1` başlığıyla döner |
| 500 | `INTERNAL_ERROR` | Beklenmeyen hata; ayrıntı yalnızca sunucu logunda |

## Health

| Yöntem | Yol | Rol | Amaç | Önemli hatalar |
|---|---|---|---|---|
| GET | `/health` | Herkes | Uygulama ve veritabanı bağlantısının durumu | Veritabanına ulaşılamazsa 503 `{status: "error", database: "unavailable"}` |

## Kimlik

| Yöntem | Yol | Rol | Amaç | Önemli hatalar |
|---|---|---|---|---|
| POST | `/auth/register` | Herkes | Yeni müşteri hesabı oluşturur (rol her zaman Müşteri). Aynı e-postalı, hesabı olmayan bir müşteri kartı varsa yöneticinin ürettiği `invite_code` gerekir; doğru kodla hesap karta bağlanır | `EMAIL_TAKEN` (409), `INVITE_CODE_REQUIRED` (400), `INVALID_INVITE_CODE` (400, yanlış, süresi geçmiş ya da kullanılmış kod), `TOO_MANY_REQUESTS` (429, aynı IP'den 10 dakikada 5'ten fazla deneme; `Retry-After` başlığı ve `details.retry_after` saniye cinsinden bekleme süresini verir. Sınır `REGISTER_RATE_LIMIT` ve `REGISTER_RATE_WINDOW_MINUTES` ile ayarlanır) |
| POST | `/auth/login` | Herkes | E-posta ve şifreyle giriş; JWT döndürür | `INVALID_CREDENTIALS` (401), `ACCOUNT_INACTIVE` (403), `TOO_MANY_REQUESTS` (429, 15 dakikada 5 hatalı deneme) |
| GET | `/auth/me` | Giriş yapmış kullanıcı | Oturumdaki kullanıcının bilgileri | `INVALID_TOKEN` (401) |
| PATCH | `/auth/me` | Giriş yapmış kullanıcı | Profil bilgilerini günceller | `NOT_A_CUSTOMER` (400, müşteriye özgü alanlar personel tarafından gönderilirse) |
| POST | `/auth/me/password` | Giriş yapmış kullanıcı | Şifre değiştirir (204) | `INVALID_PASSWORD` (400) |

## Kullanıcılar

| Yöntem | Yol | Rol | Amaç | Önemli hatalar |
|---|---|---|---|---|
| GET | `/users` | Yönetici | Kullanıcı listesi (sayfalı; `search`, `role`, `is_active`) | |
| PATCH | `/users/{user_id}/role` | Yönetici | Kullanıcıya rol atar | `SELF_CHANGE` (400), `LAST_ADMIN` (409) |
| PATCH | `/users/{user_id}/status` | Yönetici | Hesabı aktif ya da pasif yapar | `SELF_CHANGE` (400), `LAST_ADMIN` (409) |

## Kategoriler

| Yöntem | Yol | Rol | Amaç | Önemli hatalar |
|---|---|---|---|---|
| GET | `/categories` | Personel | Kategori listesi (sayfasız; aktif ürün sayısıyla) | |
| POST | `/categories` | Yönetici | Kategori ekler | `CATEGORY_NAME_TAKEN` (409) |
| PUT | `/categories/{category_id}` | Yönetici | Kategoriyi günceller | `CATEGORY_NAME_TAKEN` (409) |
| PATCH | `/categories/{category_id}/status` | Yönetici | Kategoriyi aktif ya da pasif yapar | |

## Ürünler

| Yöntem | Yol | Rol | Amaç | Önemli hatalar |
|---|---|---|---|---|
| GET | `/products` | Personel | Ürün listesi (sayfalı; `search`, `category_id`, `stock_status`, `is_active`, `sort`). `stock_status`: `out_of_stock` (stok = 0), `critical` (0 < stok < minimum), `sufficient` (stok ≥ minimum). Depo personeli yanıtında `cost_price` yoktur | `INVALID_SORT` (400) |
| POST | `/products` | Yönetici | Ürün ekler (başlangıç stoku yalnızca burada girilir) | `SKU_TAKEN` (409), `CATEGORY_NOT_FOUND`, `CATEGORY_INACTIVE` (400) |
| GET | `/products/next-sku` | Yönetici | Seçilen kategori için SKU önerir | |
| GET | `/products/{product_id}` | Personel | Ürün detayı | `NOT_FOUND` (404) |
| PUT | `/products/{product_id}` | Yönetici | Ürünü günceller | `SKU_TAKEN` (409), `CATEGORY_INACTIVE` (400) |
| PATCH | `/products/{product_id}/status` | Yönetici | Ürünü aktif ya da pasif yapar | |
| GET | `/products/{product_id}/movements` | Personel | Ürünün stok hareketleri (sayfalı; `type`, `from`, `to`) | |

## Stok

| Yöntem | Yol | Rol | Amaç | Önemli hatalar |
|---|---|---|---|---|
| POST | `/stock/movements` | Personel | Elle stok girişi ya da çıkışı; işlemi yapan oturumdan alınır | `INSUFFICIENT_STOCK` (409), `STOCK_CONFLICT` (409), `PRODUCT_INACTIVE` (400) |
| GET | `/stock/movements` | Personel | Stok hareketleri (sayfalı; `from`, `to`, `product_id`, `type`, `user_id`, `order_code`) | |
| GET | `/stock/critical` | Personel | Kritik stoktaki (0 < stok < minimum) aktif ürünler, en kritik olan önce (sayfalı). Stoğu 0 olanlar dahil değildir | |
| GET | `/stock/critical/count` | Personel | Kritik stoktaki aktif ürün sayısı (`/stock/critical` ile aynı tanım) | |
| GET | `/stock/summary` | Personel | Stok özeti (aktif ürün, kritik stok, bugünkü hareket) | |

## Siparişler

Durumlar: `pending` (Onay Bekliyor), `preparing` (Hazırlanıyor), `shipped` (Kargolandı), `completed` (Tamamlandı), `cancelled` (İptal). Stok, sipariş onaylanırken düşülür. Olist'ten aktarılan siparişler salt okunurdur.

İş kuyrukları yalnızca uygulamada oluşturulan siparişleri (`source=app`) kapsar: depo personelinin sipariş listesi, durum sayıları ve detay erişimi ile dashboard'daki onay bekleyen sayısı Olist siparişlerini içermez; yönetici listesi ve sayıları tüm siparişleri gösterir.

| Yöntem | Yol | Rol | Amaç | Önemli hatalar |
|---|---|---|---|---|
| GET | `/orders` | Personel | Sipariş listesi (sayfalı; `status`, `search`, `customer_id`, `from`, `to`). Depo personeli yalnızca Hazırlanıyor ve Kargolandı durumlarını görür | |
| POST | `/orders` | Yönetici | Müşteri adına sipariş girer (Onay Bekliyor); stok yetmeyen kalemler `shortages` alanında bildirilir | `CUSTOMER_NOT_FOUND`, `CUSTOMER_INACTIVE`, `PRODUCT_NOT_FOUND`, `PRODUCT_INACTIVE` (400) |
| GET | `/orders/{order_id}` | Personel | Sipariş detayı ve izin verilen işlemler (`allowed_actions`) | `NOT_FOUND` (404) |
| POST | `/orders/{order_id}/approve` | Yönetici | Onay Bekliyor → Hazırlanıyor; tüm kalemlerin stoğu tek işlemde düşülür | `INSUFFICIENT_STOCK` (409, `details` içinde tüm eksikler), `INVALID_TRANSITION` (409) |
| POST | `/orders/{order_id}/ship` | Personel | Hazırlanıyor → Kargolandı | `INVALID_TRANSITION` (409) |
| POST | `/orders/{order_id}/complete` | Yönetici | Kargolandı → Tamamlandı | `INVALID_TRANSITION` (409) |
| POST | `/orders/{order_id}/cancel` | Yönetici | Onay Bekliyor ya da Hazırlanıyor → İptal; hazırlanan siparişte düşülen stok geri eklenir | `INVALID_TRANSITION` (409) |

## Müşteriler

| Yöntem | Yol | Rol | Amaç | Önemli hatalar |
|---|---|---|---|---|
| GET | `/customers` | Yönetici | Müşteri listesi; sipariş sayısı, toplam harcama, son sipariş (sayfalı) | |
| POST | `/customers` | Yönetici | Müşteri kaydı ekler | `EMAIL_TAKEN` (409) |
| GET | `/customers/cities` | Yönetici | Şehir filtresi için kayıtlı şehirler | |
| GET | `/customers/{customer_id}` | Yönetici | Müşteri detayı. Geçerli bir davet kodu varsa `invite_expires_at` son geçerlilik zamanını verir | `NOT_FOUND` (404) |
| PUT | `/customers/{customer_id}` | Yönetici | Müşteriyi günceller | `EMAIL_TAKEN` (409), `EMAIL_LOCKED` (400, giriş hesabı olan müşterinin e-postası), `READ_ONLY` (400, Olist kaydı) |
| PATCH | `/customers/{customer_id}/status` | Yönetici | Müşteriyi aktif ya da pasif yapar | |
| POST | `/customers/{customer_id}/invite` | Yönetici | Kayıtta bu karta bağlanmak için tek kullanımlık, 7 gün geçerli davet kodu üretir (`code`, `expires_at`); önceki kod geçersizleşir. Kod yalnızca bu yanıtta döner | `HAS_ACCOUNT` (409), `CUSTOMER_INACTIVE` (400), `READ_ONLY` (400, Olist kaydı) |
| GET | `/customers/{customer_id}/orders` | Yönetici | Müşterinin siparişleri (sayfalı; `status`, `from`, `to`) | |

## Dashboard

| Yöntem | Yol | Rol | Amaç | Önemli hatalar |
|---|---|---|---|---|
| GET | `/dashboard/summary` | Yönetici | Bugünkü ve bu ayki satış, onay bekleyen sipariş (yalnızca `source=app`) ve kritik stok sayıları | |
| GET | `/dashboard/sales-trend` | Yönetici | Satış trendi (`granularity`: `day` ya da `month`) | |
| GET | `/dashboard/top-products` | Yönetici | En çok satan ürünler (`period`: `today`, `week`, `month`; `limit` 1–20) | |

## Raporlar

Tüm raporlar `from` ve `to` (tarih, iki uç dahil, İstanbul saati) alır. `format=xlsx` ile aynı rapor Excel dosyası olarak iner.

| Yöntem | Yol | Rol | Amaç | Önemli hatalar |
|---|---|---|---|---|
| GET | `/reports/sales` | Yönetici | Satış raporu: ciro, maliyet, brüt kâr (`group_by`, `category_id`) | `INVALID_RANGE` (400, ters aralık ya da 3 yıldan uzun) |
| GET | `/reports/stock` | Yönetici | Dönem başı/sonu stok, dönem içi giriş-çıkış ve stok değeri (`category_id`) | `INVALID_RANGE` (400) |
| GET | `/reports/orders` | Yönetici | Sipariş raporu (`status`; JSON sayfalı, `page_size` en fazla 200; Excel en fazla 10.000 satır; kesilirse dosyadaki not satırı bunu belirtir) | `INVALID_RANGE` (400) |

## Mağaza

Müşteri arayüzünün uçları. Sepet tarayıcıda tutulur; sunucu sipariş anında sepeti yeniden doğrular.

| Yöntem | Yol | Rol | Amaç | Önemli hatalar |
|---|---|---|---|---|
| GET | `/catalog/categories` | Müşteri | İçinde satışta ürün bulunan aktif kategoriler | |
| GET | `/catalog/products` | Müşteri | Katalog (sayfalı; `search`, `category_id`, `min_price`, `max_price`, `in_stock`, `sort`); maliyet dönmez | |
| GET | `/catalog/products/{product_id}` | Müşteri | Ürün detayı | `PRODUCT_UNAVAILABLE` (404) |
| POST | `/me/cart/validate` | Müşteri | Sepeti güncel fiyat, satış durumu ve stokla karşılaştırır | |
| POST | `/me/orders` | Müşteri | Sipariş verir (Onay Bekliyor) | `CART_CHANGED` (409, `details` içinde sorunlu kalemler), `NO_CUSTOMER_PROFILE`, `CUSTOMER_INACTIVE` (403) |
| GET | `/me/orders` | Müşteri | Kendi siparişleri (sayfalı; `status_group`, `search`, `from`, `to`) | |
| GET | `/me/orders/{order_id}` | Müşteri | Kendi sipariş detayı | `NOT_FOUND` (404) |
| POST | `/me/orders/{order_id}/cancel` | Müşteri | Onay bekleyen siparişini iptal eder | `CANNOT_CANCEL` (409) |
