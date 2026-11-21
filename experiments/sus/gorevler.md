# Görev senaryoları

Görevler gereksinim belgesindeki senaryolardan türetilmiştir. Gözlemci her görevi sırayla okur; katılımcıya ekranın neresinde ne olduğu söylenmez.

## Müşteri (yaklaşık 10 dakika)

| No | Görev | Başarı ölçütü |
|---|---|---|
| M1 | Kendinize bir hesap oluşturun. | Kayıt tamamlanır ve giriş ekranına dönülür |
| M2 | Oluşturduğunuz hesapla giriş yapın. | Ürünler sayfası açılır |
| M3 | Ofis Malzemeleri kategorisindeki A4 fotokopi kağıdını bulun. | Ürün detayı açılır |
| M4 | Bu üründen 2 adet sepete ekleyin. | Sepet rozeti 2 gösterir |
| M5 | Kapıda ödeme ile siparişinizi tamamlayın. | "Siparişiniz alındı" görünür |
| M6 | Verdiğiniz siparişi iptal edin. | Sipariş "İptal" durumuna geçer |

## Depo personeli (yaklaşık 8 dakika)

Hesap: depo personeli rolünde bir hesap.

| No | Görev | Başarı ölçütü |
|---|---|---|
| D1 | YDK-0001 kodlu ürünü bulun. | Ürün listede görünür ya da stok penceresi açılır |
| D2 | Bu ürüne tedarikçiden gelen 20 adetlik girişi kaydedin. | Stok 20 artar |
| D3 | Kritik stokta kaç ürün olduğunu söyleyin. | Doğru sayı söylenir |
| D4 | Hazırlanmakta olan bir siparişi kargoya verin. | Sipariş "Kargolandı" olur |

## Yönetici (yaklaşık 10 dakika)

Hesap: yönetici rolünde bir hesap. Oturumdan önce stoğu yetmeyen bir sipariş ve stoğu yeten bir sipariş "Onay Bekliyor" durumunda hazırlanır.

| No | Görev | Başarı ölçütü |
|---|---|---|
| Y1 | Onay bekleyen siparişlerden stoğu yeten siparişi onaylayın. | Sipariş "Hazırlanıyor" olur |
| Y2 | Diğer siparişi onaylamayı deneyin; onaylanamıyorsa nedenini bulun ve sorunu çözüp onaylayın. | Eksik ürüne stok girişi yapılır ve sipariş onaylanır |
| Y3 | Stoğu minimumun altına düşmüş ürünleri listeleyin. | Kritik stok sayfası açılır |
| Y4 | Bu ayın satış raporunu kategori bazında Excel olarak indirin. | Excel dosyası iner |

## Gözlem formu (her görev için)

| Alan | Açıklama |
|---|---|
| Katılımcı kodu | K01, K02 … |
| Rol | musteri / depo / yonetici |
| Görev | M1 … Y4 |
| Tamamlandı | evet / hayır |
| Süre (sn) | görev okunduktan bitene kadar |
| Hata / tereddüt | kısa not |
