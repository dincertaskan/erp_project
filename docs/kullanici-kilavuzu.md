# Kullanıcı Kılavuzu

Bu kılavuz Akıllı ERP'nin üç rolü için ekranları ve sık yapılan işlemleri adım adım anlatır: Müşteri, Depo Personeli ve Yönetici. Metindeki tırnak içindeki adlar arayüzdeki buton, menü ve alan adlarıdır.

> Ekran görüntüleri eklenecek.

Demo hesapları için `README.md` dosyasındaki "Demo hesaplar" tablosuna bakın.

## Ortak işlemler

### Giriş ve çıkış

1. Uygulama adresini açın (yerelde http://localhost:5173). "Hesabınıza giriş yapın" ekranı gelir.
2. "E-posta" ve "Şifre" alanlarını doldurup "Giriş Yap" butonuna basın.
3. Rolünüze göre açılış sayfasına yönlendirilirsiniz: Müşteri mağazaya, Depo Personeli ve Yönetici yönetim paneline.
4. Çıkmak için sağ üstteki kullanıcı menüsünden "Çıkış Yap" seçin.

Arka arkaya çok sayıda hatalı deneme yapılırsa giriş bir süre engellenir ve kaç dakika sonra tekrar denenebileceği gösterilir. Oturum süresi dolduğunda "Oturumunuzun süresi doldu" uyarısıyla giriş ekranına dönülür.

### Profil ve şifre

- Kullanıcı menüsünden "Profilim" ile "Kişisel Bilgiler" (ad soyad; müşteride ayrıca telefon, firma, şehir ve teslimat adresi) güncellenir ve "Kaydet" ile saklanır.
- "Şifre Değiştir" ekranında "Mevcut Şifre", "Yeni Şifre" ve "Yeni Şifre Tekrarı" girilip "Şifreyi Güncelle" butonuna basılır.

## Müşteri

Üst menü: "Ürünler" (katalog), "Siparişlerim" ve "Sepet".

### Kayıt olma

1. Giriş ekranında "Kayıt Ol" bağlantısına tıklayın.
2. "Ad Soyad", "E-posta", isteğe bağlı "Telefon (isteğe bağlı)", "Şifre" ve "Şifre Tekrarı" alanlarını doldurun.
3. "Demo sistem olduğunu biliyorum, gerçek kişisel veri girmeyeceğim." kutusunu işaretleyip "Hesap Oluştur" butonuna basın.
4. "Hesabınız oluşturuldu" mesajıyla giriş ekranına dönülür; yeni hesapla giriş yapın.

Kayıt formundan açılan hesaplar her zaman Müşteri rolündedir.

### Ürün bulma

- Katalogda "Ürün ara" kutusuyla arama yapılır.
- "Filtrele" bölümünde "Kategoriler", "Fiyat Aralığı" ve "Yalnızca stokta olanlar" seçenekleri vardır; "Filtreleri Temizle" tüm filtreleri kaldırır.
- "Sıralama" listesi: "Önerilen", "En yeni", "Fiyat (artan)", "Fiyat (azalan)", "Ada göre".
- Ürün kartında stok durumu "Stok Sınırında" ya da "Stokta Yok" etiketiyle gösterilir.

### Sipariş verme

1. Ürün kartında ya da ürün detayında "Sepete Ekle" butonuna basın. Detay sayfasında "Adet" seçilebilir; "Sepete Git" ile sepete geçilir.
2. Sepet sayfasında adetleri düzenleyin. "Sipariş Özeti" kartında "Ara toplam", "Kargo" ve "Genel toplam" görünür.
3. "Teslimat Adresi" ve "Ödeme Yöntemi" (Kredi Kartı, Havale/EFT, Kapıda Ödeme) alanlarını doldurun; isterseniz "Not (isteğe bağlı)" ekleyin.
4. "Siparişi Tamamla" butonuna basın. "Siparişiniz alındı!" şeridiyle sipariş detayı açılır. Sipariş "Onay Bekliyor" durumundadır ve yönetici onayından sonra hazırlanır.

Sepet tarayıcıda tutulur. Bu arada fiyat, satış durumu ya da stok değiştiyse "Sepetinizdeki bazı ürünler değişti." uyarısı çıkar; işaretli satırları kontrol edip "Güncelle" butonuyla güncel değerlerle devam edin. Sepeti tümüyle silmek için "Sepeti Boşalt" kullanılır.

### Siparişleri izleme ve iptal

1. "Siparişlerim" sayfasında siparişler "Tümü", "Devam Eden", "Tamamlanan" ve "İptal" sekmelerinde listelenir; "Sipariş kodu" ile arama yapılabilir.
2. "Detay" ile siparişin ürünleri, teslimat adresi ve durumu görülür.
3. Yalnızca "Onay Bekliyor" durumundaki sipariş iptal edilebilir: detay sayfasında "İptal Et" butonuna basıp onaylayın. Onaylanmış sipariş müşteri tarafından iptal edilemez.

## Depo Personeli

Sol menü: "Ürünler", "Stok" ("Stok İşlemleri", "Stok Hareketleri", "Kritik Stok") ve "Siparişler". Kritik stoktaki ürün sayısı menüde "Kritik Stok" yanında rozetle gösterilir.

### Stok girişi ve çıkışı

1. "Stok" menüsünden "Stok İşlemleri" sayfasını açın. Üstte "Aktif Ürün", "Kritik Stok" ve "Bugünkü Hareket" sayıları yer alır.
2. Ürünü "Ürün adı veya SKU ile arayın" kutusuyla bulun; gerekirse "Kategori" ve "Stok durumu" ile süzün.
3. Satırdaki "Giriş" ya da "Çıkış" butonuna basın. "Stok İşlemi" penceresi açılır.
4. "İşlem Türü" ve "Miktar" alanlarını doldurun. "Açıklama" girişte isteğe bağlı, çıkışta zorunludur (ör. sayım farkı, fire).
5. "Kaydet" ile işlemi tamamlayın. İşlem sonucunda ürün kritik stoka düşecekse pencerede "İşlem sonrası ürün kritik stoka düşecek." uyarısı görünür.

Mevcut stoktan fazla çıkış yapılamaz; bu durumda "Yetersiz stok. Mevcut: ..." hatası gösterilir. Aynı işlem ürün detayındaki "Stok Girişi/Çıkışı" butonuyla da yapılabilir. Satırdaki "Geçmiş" bağlantısı ürünün hareket geçmişini açar.

### Stok hareketlerini inceleme

"Stok Hareketleri" sayfasında tüm hareketler "Tarih", "Ürün", "İşlem Türü" (Giriş, Çıkış, Sipariş Çıkışı, İptal İadesi), "Miktar", "Önceki Stok", "Yeni Stok", "Yapan" ve "Sipariş" sütunlarıyla listelenir. Tarih aralığı, ürün, işlem türü ve "Sipariş kodu" ile süzüp "Filtrele" butonuna basın.

### Kritik stok

1. "Kritik Stok" sayfası, stoğu minimum seviyenin altına düşen aktif ürünleri en kritik olan önce listeler.
2. "Eksik Miktar" ve "Son 30 Gün Satış" sütunları ne kadar giriş gerektiğine karar vermeye yardımcı olur.
3. Satırdaki "Stok Girişi" butonuyla doğrudan giriş yapın. Liste boşsa "Tüm ürünlerin stoğu yeterli." mesajı görünür.

### Siparişleri kargolama

1. "Siparişler" sayfasında depo personeli yalnızca "Hazırlanıyor" ve "Kargolandı" durumundaki siparişleri görür.
2. Hazırlanan siparişte "Kargoya Ver" butonuna basıp onaylayın; sipariş "Kargolandı" durumuna geçer.

Depo personeli ürün ve kategori ekleyemez, ürün maliyetini göremez.

## Yönetici

Sol menü: "Dashboard", "Ürünler", "Kategoriler", "Stok", "Siparişler", "Müşteriler", "Raporlar" ve "Kullanıcılar". Yönetici, depo personelinin yapabildiği tüm stok işlemlerini de yapabilir.

### Dashboard

"Genel Bakış" sayfasında "Bugünkü Satış", "Bu Ayki Satış", "Onay Bekleyen Sipariş" ve "Kritik Stoktaki Ürün" kartları, "Satış Trendi" grafiği, "En Çok Satan Ürünler", "Kritik Stoktaki Ürünler" ve "Son Siparişler" listeleri yer alır. "Tümünü Gör" bağlantıları ilgili sayfaya gider.

### Ürün ve kategori yönetimi

- "Kategoriler" sayfasında "Yeni Kategori" ile kategori eklenir; satırdaki "Düzenle" ve "Pasife Al" / "Aktifleştir" ile güncellenir. Pasif kategoriye yeni ürün eklenemez.
- "Ürünler" sayfasında "Yeni Ürün" ile ürün eklenir. Kategori seçilince "SKU (Ürün Kodu)" önerilir; boş bırakılırsa otomatik üretilir. "Başlangıç Stoku" yalnızca eklemede girilir, sonraki değişiklikler stok işlemleriyle yapılır.
- Pasife alınan ürünler müşteri kataloğunda görünmez ve siparişe eklenemez.

### Sipariş onaylama

1. "Siparişler" sayfasında durum sekmelerinden "Onay Bekliyor" sekmesini açın.
2. Siparişin satırındaki ya da detay sayfasındaki "Onayla" butonuna basın ve pencerede onaylayın.
3. Stok yeterliyse "Sipariş onaylandı, stok düşüldü." mesajı görünür; sipariş "Hazırlanıyor" durumuna geçer ve tüm kalemlerin stoğu tek işlemde düşülür.

Diğer işlemler: "Kargoya Ver" (Hazırlanıyor → Kargolandı), "Teslim Edildi" (Kargolandı → Tamamlandı), "İptal Et" (Onay Bekliyor ya da Hazırlanıyor → İptal; hazırlanan siparişte düşülen stok geri eklenir). Olist'ten aktarılan siparişler salt okunurdur.

### Yetersiz stoku çözme

Onay sırasında bir kalemde bile stok yetmezse sipariş onaylanmaz ve hiçbir stok değiştirilmez.

1. "Stok yetersiz, sipariş onaylanamadı" penceresi açılır; eksik ürünler "İstenen" ve "Mevcut" miktarlarıyla listelenir.
2. "Stok İşlemlerine Git" butonuyla "Stok İşlemleri" sayfasına geçin ve eksik ürünler için "Giriş" yapın.
3. "Siparişler" sayfasına dönüp siparişi yeniden "Onayla".

### Müşteri adına sipariş

1. "Siparişler" sayfasında "Yeni Sipariş" butonuna basın (ya da müşteri detayında "Bu Müşteri Adına Sipariş Oluştur").
2. "Müşteri" kartında müşteriyi arayıp seçin; kayıtlı değilse "Yeni Müşteri" ile ekleyin.
3. "Ürünler" kartında "SKU veya ürün adı ile arayın" kutusundan ürünü seçin, adedi girip "Ekle" butonuna basın.
4. "Teslimat ve Ödeme" bölümünü doldurup "Siparişi Oluştur" butonuna basın. Sipariş "Onay Bekliyor" durumunda oluşur; stok onay sırasında düşülür.

### Müşteriler

"Müşteriler" sayfasında müşteriler sipariş sayısı, "Toplam Harcama" ve "Son Sipariş" bilgileriyle listelenir. "Yeni Müşteri" ile kayıt eklenir, "Düzenle" ile güncellenir. Giriş hesabı olan müşterinin e-postası değiştirilemez. Pasif müşteri adına sipariş oluşturulamaz.

### Raporlar ve Excel'e aktarma

1. "Raporlar" sayfasında "Satış Raporu", "Stok Raporu" ya da "Sipariş Raporu" sekmesini seçin.
2. Tarih aralığını seçin. Satış raporunda kategori ve gruplama ("Gruplama: Gün", "Hafta", "Ay", "Ürün", "Kategori"), stok raporunda kategori, sipariş raporunda durum filtresi vardır.
3. "Listele" butonuna basın. Satış raporunda "Ciro", "Maliyet", "Brüt Kâr" ve "Satılan Adet"; stok raporunda "Dönem Başı", "Dönem Sonu", "Dönem İçi Giriş", "Dönem İçi Çıkış" ve "Stok Değeri (dönem sonu)" gösterilir.
4. "Excel'e Aktar" butonuyla aynı rapor `.xlsx` dosyası olarak iner.

Rapor aralığı en fazla 3 yıl olabilir. Maliyet ve stok değeri ürünlerin güncel maliyetiyle hesaplanır.

### Kullanıcı rolü atama

Yeni personel önce kayıt formundan hesap açar; ardından yönetici rol atar.

1. "Kullanıcılar" sayfasında kullanıcıyı "Ad veya e-posta" ile arayın.
2. Satırdaki "Rol Ata" butonuna basın, "Rol" listesinden Yönetici, Depo Personeli ya da Müşteri seçip "Kaydet" ile onaylayın.
3. Hesabı kapatmak için "Pasife Al" kullanın; pasif kullanıcı giriş yapamaz. Geri açmak için "Aktifleştir".

Yönetici kendi rolünü değiştiremez ve kendi hesabını pasife alamaz. Sistemdeki son aktif yönetici değiştirilemez. Müşteri rolüne alınan kullanıcı için müşteri kaydı oluşturulur.
