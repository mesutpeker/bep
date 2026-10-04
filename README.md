# BEP Hazırlama Aracı (Lise • 2026-2027)

Ortaöğretimde kaynaştırma/bütünleştirme yoluyla eğitim alan lise öğrencileri için **Bireyselleştirilmiş Eğitim Programı (BEP)** hazırlayan, internet bağlantısı ve kurulum gerektirmeyen web uygulaması.

🌐 **Canlı Uygulama:** [mesutpeker.com/bep](https://mesutpeker.com/bep/)

---

## Öne Çıkan Özellikler

- **Resmî Müfredat Entegrasyonu:** MEB'in 2026-2027 çerçeve yıllık planlarındaki (TYMM Hazırlık, 9, 10, 11 ve 12. sınıf programları; 42 ders, 162 plan) haftalık konu ve kazanımları otomatik çeker.
- **Otomatik Doldurma:** RAM raporundaki yetersizlik türü ve seçilen derse göre mevcut performans düzeyi, eğitsel uyarlamalar, sınav uyarlamaları, BEP birimi kararları ve UDA/KDA hedefleri otomatik oluşturulur.
- **e-Okul Entegrasyonu:** e-Okul "Özel Eğitim Gereksinimli Öğrenci Listesi" metnini kopyalayıp yapıştırarak öğrencileri tek tıkla aktarma imkânı.
- **Resmî Standartlarda Word (.docx) Çıktısı:** A4 yatay sayfa düzeninde, MEB formatına birebir uygun, tabloları bölünmeyen ve sayfalandırması hazır Word ve PDF/yazdırma çıktısı.
- **Tek Dosyada Çevrim Dışı Kullanım:** `BEP_Hazirlama_Uygulamasi.html` tek başına açılabilir; internet veya sunucu gerektirmez, USB ile taşınabilir.
- **Gizlilik ve KVKK:** Özel nitelikli kişisel veriler hiçbir uzak sunucuya gönderilmez; tüm kayıtlar kullanıcının kendi tarayıcısının yerel deposunda (localStorage) kalır.

---

## 6 Adımda Kolay BEP Hazırlama

1. **Okul ve BEP Birimi:** Okul ve kurul üyeleri girilir (bilgiler sonraki BEP'lerde otomatik hatırlanır).
2. **Öğrenci:** Öğrenci ve tanı bilgileri seçilir veya e-Okul'dan aktarılır.
3. **Ders:** Ders ve sınıf seçilir; resmî çerçeve plan otomatik eşleştirilir.
4. **Performans Düzeyi:** Tanıya ve derse göre performans ve davranış özellikleri otomatik gelir.
5. **Yıllık Plan:** 37 haftalık ünitelendirilmiş BEP planı ve hedefleri oluşturulur, düzenlenebilir.
6. **Önizle ve İndir:** Önizleme yapılır, tek tıkla Word (.docx) indirilir veya yazdırılır.

---

## Dosya Yapısı

```
BEP_Hazirlama_Uygulamasi.html   # Tek dosyalık taşınabilir uygulama (çevrim dışı)
index.html                       # Web sürümü ana giriş sayfası (GitHub Pages)
src/                             # Stil (CSS) ve iş mantığı / modüller (JS)
data/dersler.js                  # 42 ders ve 162 resmî yıllık plan veri seti
ornek_cikti/                     # Örnek üretilmiş Word (.docx) çıktıları
tools/                           # Plan ayrıştırma, paketleme ve doğrulama araçları
BENIOKU.md                       # Ayrıntılı kullanım kılavuzu ve resmî dayanaklar
```

---

## Geliştirme ve Veri Üretimi

Resmî Excel planları güncellendiğinde veri setini ve tek dosyayı yeniden üretmek için:

```bash
# 1. Excel planlarını ayrıştır (tools/ara/planlar_ham.json üretir)
python3 tools/plan_ayristir.py

# 2. Web veri setini oluştur (data/dersler.js üretir)
python3 tools/veri_olustur.py

# 3. Tek dosyalık dağıtımı paketle
python3 tools/paketle.py
```

Gereksinimler: Python 3 (`openpyxl`), Node.js (testler için). Ayrıntılı yasal ve teknik bilgi için [BENIOKU.md](BENIOKU.md) dosyasına bakabilirsiniz.
