# Deney 3: Kullanılabilirlik (SUS)

Bu klasör kullanılabilirlik oturumlarının materyallerini içerir:

- `gorevler.md`: rollere göre görev senaryoları ve gözlem formu
- `sus-formu.md`: 10 maddelik SUS formu (Google Forms'a aktarmak için)
- `onam.md`: katılımcı bilgilendirme ve onam metni
- `yanitlar-sablon.csv`: yanıtların toplanacağı tablo şablonu; `gorevler.md`'deki her görev (M1–M6, D1–D4, Y1–Y4) için `task_<no>_done` ve `task_<no>_seconds` sütunları vardır, her katılımcı yalnızca kendi rolünün görev sütunlarını doldurur
- `sus_score.py`: SUS puanlarını hesaplar; ortalama için %95 güven aralığı verir ve 68 eşiğine karşı tek örneklem t-testi uygular

## Akış

1. En az 10 katılımcı (öneri: 4 müşteri, 3 depo personeli, 3 yönetici). Gerçek kişisel veri girilmez; katılımcılar demo hesaplarla ya da oturum için açılan hesaplarla çalışır.
2. Onam metni okunur ve onay alınır.
3. Katılımcı rolüne ait görevleri sırayla yapar. Gözlemci her görev için tamamlandı mı (evet/hayır), süre (saniye) ve notları `yanitlar-sablon.csv` biçiminde kaydeder. Katılımcıya ipucu verilmez; 5 dakikayı aşan görev "tamamlanmadı" sayılır.
4. Görevlerden sonra SUS formu doldurulur.
5. Yanıtlar CSV'ye aktarılıp puanlanır:

```bash
python sus_score.py yanitlar.csv
```

## Notlar

- SUS puanı: tek numaralı maddelerde (yanıt − 1), çift numaralı maddelerde (5 − yanıt); toplam × 2,5 (0–100).
- Türkçe madde metinleri bir çalışma çevirisidir. Raporda yayımlanmış ve geçerliği gösterilmiş bir Türkçe uyarlama kullanılacaksa form metni onunla değiştirilmeli ve uyarlamanın kaynağı birincil yayından gösterilmelidir.
- Yaklaşık 10 katılımcıyla 68 eşiğine karşı t-testinin gücü sınırlıdır; sonuç ortalama ve %95 güven aralığıyla raporlanır.
- `onam.md`'deki iletişim satırı oturumlardan önce doldurulmalıdır.
- Etik kurul gerekliliği danışmana sorulmalıdır. Katılımcı adları sonuç dosyalarına yazılmaz; yalnızca K01, K02 gibi kodlar kullanılır.
