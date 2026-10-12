#!/usr/bin/env python3
"""
Haftalık çerçeve planı yayımlanmamış, kazanım temelli (TYMM öncesi) seçmeli ders öğretim programlarını ayrıştırır.

Girdi:  tools/kaynaklar/programlar/*.pdf   (mufredat.meb.gov.tr / meslek.meb.gov.tr resmî program PDF'leri)
Çıktı:  tools/kaynaklar/programlar/kazanim_programlari.json

Her program TTKB şablonundadır: "Ünite, Kazanım Sayısı ve Süre Tablosu" ile "Ünite, Kazanım ve Açıklamaları".
Ünite (ve varsa konu) adları ile ders saatleri aşağıdaki DERSLER sözlüğüne süre tablosundan aktarılmıştır
(Spor Eğitimi'nde tablo PDF'ten okunur); kazanımlar ve açıklamaları PDF metninden ayrıştırılır ve tablodaki
kazanım sayılarıyla karşılaştırılır. Sosyal Medya (MTAL seçmeli meslek dersi) çerçeve öğretim programı ile ders
bilgi formundan elle aktarılmıştır (SOSYAL_MEDYA).

Gereksinim: PyMuPDF (pip install pymupdf). CI bu aracı çalıştırmaz; çıktı JSON depoda tutulur.
"""
import json
import os
import re
import sys
import unicodedata

import fitz  # PyMuPDF

KOK = os.path.dirname(os.path.abspath(__file__))
KAYNAK = os.path.join(KOK, "kaynaklar", "programlar")
CIKTI = os.path.join(KAYNAK, "kazanim_programlari.json")

MUFREDAT = "https://mufredat.meb.gov.tr/ProgramDetay.aspx?PID="

# Ünite tabloları: (ünite başlığı, kazanım sayısı, ders saati). Konulu programlarda konular: (konu, kazanım sayısı, saat).
DERSLER = {
    "adabimuaseret": {
        "ad": "Adabımuaşeret Dersi Öğretim Programı (2025)",
        "url": MUFREDAT + "1783", "pdf": "adabimuaseret_dop.pdf",
        "bas": r"3\.2\. ÖĞRETİM PROGRAMININ ÜNİTE, KAZANIM VE AÇIKLAMALARI",
        "planlar": [{"uniteler": [
            ("1. ÜNİTE: KÜLTÜRDEN KAVRAMA ADABIMUAŞERET", 3, 3),
            ("2. ÜNİTE: KİŞİSEL TUTUM VE ADABIMUAŞERET", 4, 4),
            ("3. ÜNİTE: AİLEDE ADABIMUAŞERET", 2, 4),
            ("4. ÜNİTE: TOPLUMDA ADABIMUAŞERET", 8, 15),
            ("5. ÜNİTE: İLETİŞİMDE, TEKNOLOJİ VE SOSYAL MEDYA KULLANIMINDA ADABIMUAŞERET", 2, 5),
            ("6. ÜNİTE: DOĞAL KAYNAKLARIN KULLANIMI VE ÇEVRENİN KORUNMASINDA ADABIMUAŞERET", 2, 3),
            ("7. ÜNİTE: İŞ VE MESLEK HAYATINDA ADABIMUAŞERET", 2, 2),
        ]}],
    },
    "dusunme-egitimi": {
        "ad": "Düşünme Eğitimi Dersi Öğretim Programı",
        "url": MUFREDAT + "1292", "pdf": "dusunme_egitimi_dop.pdf",
        "bas": r"3\.2\. ÜNİTE, KAZANIM VE AÇIKLAMALAR\s*\n1\. ÜNİTE",
        "planlar": [{"uniteler": [
            ("1. ÜNİTE: DÜŞÜNME VE ÖZ ETKİLİLİK", 3, 10),
            ("2. ÜNİTE: AKIL YÜRÜTME VE ARGÜMANTASYON", 5, 20),
            ("3. ÜNİTE: VERİ ORGANİZASYONU VE AÇIKLAMA", 3, 12),
            ("4. ÜNİTE: PROBLEM ÇÖZME VE KARAR VERME", 2, 10),
            ("5. ÜNİTE: ELEŞTİREL DÜŞÜNME VE ÖZ ELEŞTİRİ", 5, 20),
        ]}],
    },
    "ahilik-girisimcilik": {
        "ad": "Ahilik Kültürü ve Girişimcilik Dersi Öğretim Programı (TTKK 2023/68)",
        "url": "https://meslek.meb.gov.tr/upload/krl/Secmeli_Dersler/2023-68-Ahilik_Kulturu_ve_Girisimcilik_9_10_11_12.pdf",
        "pdf": "ahilik_kulturu_ve_girisimcilik_dop.pdf",
        "bas": r"3\.2\. ÜNİTE, KONU, KAZANIM VE AÇIKLAMALARI\s*\n1\. AHİLİK",
        "konulu": True,
        "planlar": [{"uniteler": [
            ("1. ÜNİTE: AHİLİK KÜLTÜRÜ", None, None, [
                ("Ahiliğin Anlamı, İçeriği ve Genel İlkeleri", 5, 3),
                ("Ahiliğin Anadolu’da Kuruluşu, Gelişimi ve Ahi Evran’ın Öncülüğü", 3, 2),
                ("Ahiliğin İş Ahlakı İlkeleri ve Ekonomik Hayata Etkisi", 2, 1),
                ("Ahiliğin Türk Kültürüne ve Anadolu'nun Sosyal Hayatına Katkısı", 1, 2),
                ("Ahilik Tarzı Esnaf Sisteminin Yapısı", 2, 1),
                ("Ahilik Geleneğinde Meslek Ahlakı", 3, 2),
                ("Ahilikte İş Eğitimi ve Model İnsan", 3, 2),
                ("Ahilikte İş ve Meslek İlkeleri", 2, 1),
                ("Bâciyân-ı Rûm Teşkilatı ve Kadınların Ticaret Hayatındaki Önemi", 3, 2),
                ("Meslek ve Meslek Örgütlerinin Ekonomideki Yeri ve Kurumsal Yapıları", 4, 2),
            ]),
            ("2. ÜNİTE: GİRİŞİMCİLİK", None, None, [
                ("Girişimcilik", 4, 2),
                ("Girişimcilik Çeşitleri", 1, 1),
                ("Girişimcilik ve Etik Değerler", 3, 1),
                ("Girişimcilik Sürecinde Değer Oluşturma", 3, 1),
                ("Başarılı Girişimcilerin Nitelik ve Becerileri", 3, 1),
                ("Pazar Araştırması", 4, 2),
                ("İş Planı", 3, 4),
                ("Yeni Girişimler İçin Finansal Kaynaklara Erişim", 4, 2),
                ("Girişimcilikte Başarısızlık Faktörleri", 2, 2),
                ("Fikrî ve Sınai Mülkiyet Hakları", 5, 2),
            ]),
        ]}],
    },
    "ortak-turk-tarihi": {
        "ad": "Ortak Türk Tarihi Dersi Öğretim Programı",
        "url": MUFREDAT + "1203", "pdf": "ortak_turk_tarihi_dop.pdf",
        "bas": r"3\.2\. ÜNİTE, KONU, KAZANIM VE AÇIKLAMALARI\s*\n1\. ÜNİTE",
        "planlar": [{"uniteler": [
            ("1. ÜNİTE: DÜNYA TARİHİ ÇERÇEVESİNDE TÜRK DÜNYASI", 8, 10),
            ("2. ÜNİTE: HUN İMPARATORLUKLARI VE SONRAKİ TÜRK DEVLETLERİ", 11, 12),
            ("3. ÜNİTE: TÜRK KAĞANLIKLARI", 10, 12),
            ("4. ÜNİTE: İLK TÜRK İSLAM DEVLETLERİ", 10, 12),
            ("5. ÜNİTE: TÜRK-MOĞOL DEVLETLERİ", 7, 8),
            ("6. ÜNİTE: TÜRK DÜNYASI (XIII-XV. YÜZYILLAR)", 6, 12),
            ("7. ÜNİTE: TÜRK DÜNYASININ ORTAK MANEVİ VE KÜLTÜREL MİRASLARI", 4, 6),
        ]}],
    },
    "turk-dunyasi-cografyasi": {
        "ad": "Türk Dünyası Coğrafyası Dersi Öğretim Programı",
        "url": MUFREDAT + "1205", "pdf": "turk_dunyasi_cografyasi_dop.pdf",
        "bas": r"3\.2\. ÜNİTE, KONU VE KAZANIMLAR\s*\n1\. ÜNİTE",
        "konulu": True,
        "planlar": [{"uniteler": [
            ("1. ÜNİTE: TÜRK HALKLARINDA COĞRAFİ ANLAYIŞIN OLUŞUMU", None, None, [
                ("Eski Türklerde Coğrafi Düşünce ve Anlayışlar", 2, 4),
                ("Eski Türklerde Coğrafi Terimler", 2, 4),
                ("Muhtelif Dönemlere Ait Kaynaklarda Türk Dünyası", 3, 4),
                ("Türk Dünyası ve Büyük İpek Yolu", 3, 6),
                ("Türk Dünyasının Kutlu Coğrafyası", 3, 6),
            ]),
            ("2. ÜNİTE: TÜRK DÜNYASININ COĞRAFİ ÖZELLİKLERİ", None, None, [
                ("Türk Dünyasının Genel Coğrafi Özellikleri", 1, 8),
                ("Türk Devletleri", 1, 20),
                ("Türk Toplulukları", 1, 10),
                ("Türk Dünyasında Bütünleşme", 1, 10),
            ]),
        ]}],
    },
    "klasik-ahlak-metinleri": {
        "ad": "Klasik Ahlak Metinleri Dersi (I-II-III) Öğretim Programı",
        "url": MUFREDAT + "1300", "pdf": "klasik_ahlak_metinleri_dop.pdf",
        "planlar": [
            {"ek": "kam1", "etiket": "Klasik Ahlak Metinleri I", "bas": r"KLASİK AHLAK METİNLERİ I\s*\nÜNİTE 1:", "son": r"3\.2\. ÜNİTE, KAZANIM",
             "uniteler": [("1. ÜNİTE: AHLAKIN DOĞASI", 2, 10), ("2. ÜNİTE: AHLAK, AKIL, MUTLULUK VE HUZUR", 3, 26)]},
            {"ek": "kam2", "etiket": "Klasik Ahlak Metinleri II", "bas": r"KLASİK AHLAK METİNLERİ II\s*\nÜNİTE 1:", "son": r"KLASİK AHLAK METİNLERİ III\s*\nÜNİTE 1:",
             "uniteler": [("1. ÜNİTE: BİLGİ ALANLARININ AHLAKLA İLİŞKİSİ", 2, 10), ("2. ÜNİTE: AHLAK VE ERDEM", 3, 26)]},
            {"ek": "kam3", "etiket": "Klasik Ahlak Metinleri III", "bas": r"KLASİK AHLAK METİNLERİ III\s*\nÜNİTE 1:", "son": None,
             "uniteler": [("1. ÜNİTE: AHLAKIN TOPLUMSAL BOYUTLARI", 2, 10), ("2. ÜNİTE: AHLAK VE EĞİTİM", 3, 26)]},
        ],
    },
    "bilisim-teknolojileri-yazilim": {
        "ad": "Bilişim Teknolojileri ve Yazılım Dersi Öğretim Programı (TTKK 2023/109)",
        "url": MUFREDAT + "1663", "pdf": "bilisim_teknolojileri_ve_yazilim_dop.pdf",
        "bas": r"3\.2\. ÜNİTE, KAZANIM VE AÇIKLAMALAR\s*\nPROGRAMLAMAYA GİRİŞ",
        "moduller": True,  # modüller metinde sırayla, her biri "1. ÜNİTE:" ile başlar
        "planlar": [
            {"ek": "m01", "etiket": "Programlamaya Giriş ve Algoritma", "uniteler": [
                ("1. ÜNİTE: BİLİŞİM TEKNOLOJİLERİNİN PROGRAMLAMADAKİ YERİ", 7, 8),
                ("2. ÜNİTE: ALGORİTMA İLE PROBLEM ÇÖZME VE AKIŞ DİYAGRAMI", 11, 20),
                ("3. ÜNİTE: PROGRAMLAMANIN TEMEL KAVRAMLARI", 6, 14),
                ("4. ÜNİTE: ALGORİTMA VE AKIŞ DİYAGRAMINI TEST ETME", 4, 14),
                ("5. ÜNİTE: İLERİ DÜZEY ALGORİTMA UYGULAMALARI", 2, 16)]},
            {"ek": "m02", "etiket": "Robotik Kodlama", "uniteler": [
                ("1. ÜNİTE: ROBOTİK SİSTEMLER VE TARİHSEL GELİŞİMİ", 8, 18),
                ("2. ÜNİTE: ROBOTİK BİLEŞENLER", 11, 18),
                ("3. ÜNİTE: PROJE GELİŞTİRME", 5, 36)]},
            {"ek": "m03", "etiket": "Mobil Uygulama Geliştirme", "uniteler": [
                ("1. ÜNİTE: MOBİL PROGRAMLAMA OKURYAZARLIĞI", 9, 18),
                ("2. ÜNİTE: MOBİL UYGULAMA TASARIMI VE ARAYÜZÜ", 9, 18),
                ("3. ÜNİTE: PROGRAM BİLEŞENLERİ İLE ÇALIŞMA", 8, 36)]},
            {"ek": "m04", "etiket": "Programlama Dilleri (Java)", "uniteler": [
                ("1. ÜNİTE: JAVA PROGRAMLAMAYA GİRİŞ", 2, 9), ("2. ÜNİTE: İLKEL VERİ TİPLERİ", 4, 9),
                ("3. ÜNİTE: SINIFLAR VE NESNELER", 3, 9),
                ("4. ÜNİTE: KARŞILAŞTIRMA OPERATÖRLERİ, MANTIKSAL OPERATÖRLER VE KOŞULLU İFADELER", 2, 9),
                ("5. ÜNİTE: DÖNGÜLER", 3, 9), ("6. ÜNİTE: ARRAY VE ARRAYLİST SINIFI", 5, 9),
                ("7. ÜNİTE: KALITIM", 2, 9), ("8. ÜNİTE: RECURSIVE (ÖZYİNELEMELİ) FONKSİYON", 2, 9)]},
            {"ek": "m05", "etiket": "Programlama Dilleri (C++)", "uniteler": [
                ("1. ÜNİTE: C++ ÇALIŞMA ORTAMI", 3, 14), ("2. ÜNİTE: KARAR VE DÖNGÜ YAPILARI", 3, 14),
                ("3. ÜNİTE: FONKSİYONLAR VE DİZİLER", 4, 16), ("4. ÜNİTE: FORMLAR", 3, 14),
                ("5. ÜNİTE: VERİ TABANI İŞLEMLERİ", 6, 14)]},
            {"ek": "m06", "etiket": "Programlama Dilleri (C#)", "uniteler": [
                ("1. ÜNİTE: C# ÇALIŞMA ORTAMI", 5, 12), ("2. ÜNİTE: KARAR VE DÖNGÜ YAPILARI", 3, 12),
                ("3. ÜNİTE: SINIFLAR (CLASS)", 7, 12), ("4. ÜNİTE: DİZİLER VE KOLEKSİYONLAR", 3, 12),
                ("5. ÜNİTE: FORMLAR", 4, 12), ("6. ÜNİTE: VERİ TABANI İŞLEMLERİ", 6, 12)]},
            {"ek": "m07", "etiket": "Programlama Dilleri (Dart)", "uniteler": [
                ("1. ÜNİTE: DART PROGRAMLAMA DİLİ TEMELLERİ", 8, 18),
                ("2. ÜNİTE: NESNE TABANLI PROGRAMLAMA VE ASENKRON PROGRAMLAMA", 9, 18),
                ("3. ÜNİTE: DERİNLEMESİNE DART PROGRAMLAMA DİLİ", 6, 36)]},
            {"ek": "m08", "etiket": "Programlama Dilleri (PHP)", "uniteler": [
                ("1. ÜNİTE: PHP TEMEL KAVRAMLAR", 4, 18), ("2. ÜNİTE: PHP PROGRAMLAMA DİLİNİ TANIYALIM", 3, 18),
                ("3. ÜNİTE: PHP FONKSİYONLARI, ARİTMETİKSEL VE MANTIKSAL İŞLEMLER", 3, 18),
                ("4. ÜNİTE: PHP PROGRAMLAMA DİLİ İLE VERİ TABANI İŞLEMLERİ", 3, 18)]},
            {"ek": "m09", "etiket": "Programlama Dilleri (JavaScript)", "uniteler": [
                ("1. ÜNİTE: JAVASCRIPT PROGRAMLAMA DİLİ TEMELLERİ", 8, 18),
                ("2. ÜNİTE: JAVASCRIPT PROGRAMLAMA DİLİ FONKSİYONLARI VE NESNE TABANLI PROGRAMLAMA", 11, 18),
                ("3. ÜNİTE: JAVASCRIPT PROGRAMLAMA DİLİ İLE WEB GELİŞTİRME", 14, 36)]},
            {"ek": "m10", "etiket": "Programlama Dilleri (Python)", "uniteler": [
                ("1. ÜNİTE: PYTHON PROGRAMLAMAYA GİRİŞ", 7, 18),
                ("2. ÜNİTE: PYTHON PROGRAMLAMA DİLİ İLE YAZILIM GELİŞTİRME", 5, 18),
                ("3. ÜNİTE: NESNE YÖNELİMLİ PROJE GELİŞTİRME", 9, 36)]},
            {"ek": "m11", "etiket": "Yapay Zekâ Uygulamaları", "uniteler": [
                ("1. ÜNİTE: VERİ BİLİMİ TEMEL KAVRAMLARI", 16, 16), ("2. ÜNİTE: TEMEL İSTATİSTİK", 3, 7),
                ("3. ÜNİTE: DEĞİŞİM VE VERİ", 2, 7), ("4. ÜNİTE: VERİ GÖRSELLEŞTİRME", 5, 7),
                ("5. ÜNİTE: VERİLER ARASI İLİŞKİ", 3, 7), ("6. ÜNİTE: VERİ MANİPÜLASYONU", 7, 7),
                ("7. ÜNİTE: VERİ UYGULAMALARI", 2, 7), ("8. ÜNİTE: YAPAY ZEKÂ TEMEL KAVRAMLARI VE UYGULAMALARI", 4, 7),
                ("9. ÜNİTE: YAPAY ZEKÂ TABANLI OYUN GELİŞTİRME", 3, 7)]},
        ],
    },
    "spor-egitimi": {
        "ad": "Spor Eğitimi Dersi Öğretim Programı (TTKK 2023/110)",
        "url": MUFREDAT + "1404", "pdf": "spor_egitimi_dop.pdf",
        "bas": r"3\.2\. MODÜL, ÜNİTE, KAZANIM VE AÇIKLAMALAR",
        "spor": True,  # modül ve ünite tabloları PDF'ten okunur
    },
}

TR_UST = str.maketrans({"i": "İ", "ı": "I"})
HARF = "A-Za-zÇĞİÖŞÜçğıöşüÂÎÛâîû"


def tr_upper(s):
    return s.translate(TR_UST).upper()


def bosluk(s):
    return re.sub(r"\s+", " ", s or "").strip()


def birlestir(satirlar):
    """Satırları paragrafa birleştirir; satır sonu tirelemelerini (yumuşak tire ya da "kişi-\\nsel") onarır."""
    metin = ""
    for l in satirlar:
        l = bosluk(l)
        if not l:
            continue
        if metin.endswith("­"):
            metin = metin[:-1] + l
        elif metin.endswith("-") and re.search(r"[a-zçğıöşüâîû]-$", metin) and re.match(r"[a-zçğıöşüâîû]", l):
            metin = metin[:-1] + l
        elif metin:
            metin += " " + l
        else:
            metin = l
    return bosluk(metin.replace("­", ""))


def metin_oku(pdf):
    """PDF metni; sayfa üst bilgisi (sayfa no, program adı) satırları atılır."""
    satirlar = []
    for sayfa in fitz.open(os.path.join(KAYNAK, pdf)):
        for j, l in enumerate(unicodedata.normalize("NFC", sayfa.get_text()).split("\n")):
            s = l.replace("\t", " ").strip()
            if (j < 4 and re.fullmatch(r"\d{1,3}", s)) or re.fullmatch(r".*DERSİ (?:\([IV-]+\) )?ÖĞRETİM PROGRAMI", s) \
                    or re.fullmatch(r"Ahilik Kültürü ve Girişimcilik Dersi Öğretim Programı", s):
                continue
            satirlar.append(l.replace("\t", " ").rstrip())
    return "\n".join(satirlar)


DURDUR = re.compile(r"^(Değerler|Alan Becerileri|Kavramsal Bütünleşik Beceriler.*|Ünite Açıklaması|Kazanım ve Açıklamaları|"
                    r"Terimler ve Kavramlar.*|Amaçlar|ALAN BECERİLERİ|BİREYSEL SPORLAR|TAKIM SPORLARI|MODÜL \d+:.*)\s*$")
MADDE = re.compile(r"^(?:[a-zçğıöşü][\.\)]|•)\s*(.*)$")


def kazanimlari_ayir(bolum, kod_uzunlugu, onek=""):
    """Bölüm metninden kazanımlar, konu/ünite başlıkları ve açıklamaları.
    kod_uzunlugu: kazanım kodundaki sayı adedi (2: "1.3.", 3: "1.2.4."). Bir eksik uzunluktaki kodlu satırlar başlıktır.
    Dönüş: [("baslik", kod, metin) | ("kazanim", kod, metin, [açıklamalar])]"""
    ogeler = []
    gecerli = None  # açıklama toplanan kazanım
    madde = None
    durdu = False
    # "5. 1. Moğol …", "1.1.Robotiğin …" gibi boşluk farkları da kabul edilir
    kod_re = re.compile(r"^\s*" + re.escape(onek) + r"\s*((?:\d+\. ?){%d}\d+)\.?\s*(\S.*)$" % (kod_uzunlugu - 1))
    baslik_re = re.compile(r"^\s*" + re.escape(onek) + r"\s*((?:\d+\. ?){%d}\d+)\.?\s*(\S.*)$" % (kod_uzunlugu - 2)) if kod_uzunlugu > 2 else None

    def kapat():
        nonlocal madde
        if gecerli is not None and madde:
            gecerli["_ac"].append(madde)
        madde = None

    satirlar = bolum.split("\n")
    i = 0
    while i < len(satirlar):
        l = satirlar[i].strip()
        i += 1
        if not l or l.startswith("=====PAGE"):
            continue
        m = kod_re.match(l)
        # Kazanım cümlesi harfle (ya da ".NET" gibi) başlar ve büyük harfli bir bölüm başlığı değildir
        if m and re.match(rf"(?:[{HARF}“\"]|\.[A-Z])", m.group(2)) and tr_upper(m.group(2)) != m.group(2):
            kapat()
            metin = [m.group(2)]
            # kazanım cümlesi alt satıra taşabilir: nokta ile bitene kadar devam satırlarını ekle
            while not re.search(r"[\.\)]\s*$", metin[-1]) and i < len(satirlar):
                d = satirlar[i].strip()
                if not d or MADDE.match(d) or kod_re.match(d) or (baslik_re and baslik_re.match(d)) or DURDUR.match(d):
                    break
                metin.append(d)
                i += 1
            gecerli = {"tur": "kazanim", "kod": m.group(1).replace(" ", ""), "metin": birlestir(metin), "_ac": []}
            ogeler.append(gecerli)
            durdu = False
            continue
        if baslik_re:
            m = baslik_re.match(l)
            if m and re.match(rf"[{HARF}]", m.group(2)):
                kapat()
                metin = [m.group(2)]
                while i < len(satirlar) and satirlar[i].strip() and tr_upper(satirlar[i].strip()) == satirlar[i].strip() \
                        and not kod_re.match(satirlar[i].strip()) and tr_upper(m.group(2)) == m.group(2):
                    metin.append(satirlar[i].strip())  # büyük harfli başlığın ikinci satırı
                    i += 1
                ogeler.append({"tur": "baslik", "kod": m.group(1).replace(" ", ""), "metin": birlestir(metin)})
                gecerli = None
                durdu = False
                continue
        if re.match(r"^\d+\. ÜNİTE:|^ÜNİTE \d+:|^\d+\. [A-ZÇĞİÖŞÜ ]+$", l) or DURDUR.match(l):
            kapat()
            gecerli = None
            durdu = True
            continue
        if durdu or gecerli is None:
            continue
        m = MADDE.match(l)
        if m:
            kapat()
            madde = [m.group(1)] if m.group(1) else []
        else:
            if madde is None:
                madde = []
            madde.append(l)
    kapat()
    for o in ogeler:
        if o["tur"] == "kazanim":
            o["aciklamalar"] = [a for a in (birlestir(x) for x in o.pop("_ac")) if a and len(a) > 3]
    return ogeler


def plan_kur(ogeler, uniteler, konulu, ad):
    """Ayrıştırılan öğeleri tablodaki ünite/konu yapısına yerleştirir."""
    sonuc = []
    for ui, u in enumerate(uniteler):
        baslik, k_sayi, saat = u[0], u[1], u[2]
        konular = u[3] if len(u) > 3 else None
        kayit = {"baslik": baslik, "saat": saat if saat is not None else sum(k[2] for k in konular), "kazanimlar": []}
        if konular:
            kayit["konular"] = [{"ad": k[0], "saat": k[2]} for k in konular]
        sonuc.append(kayit)
    gorulen = set()
    for o in ogeler:
        if o["tur"] != "kazanim":
            continue
        parca = [int(x) for x in o["kod"].split(".")]
        ui = parca[0] - 1
        if not 0 <= ui < len(sonuc) or (o["kod"], o["metin"]) in gorulen:
            print(f"  ! {ad}: kazanım atlandı ({o['kod']} {o['metin'][:50]})")
            continue
        if any(k == o["kod"] for k, _ in gorulen):
            print(f"  ~ {ad}: kaynakta aynı numaralı ikinci kazanım korundu ({o['kod']} {o['metin'][:50]})")
        gorulen.add((o["kod"], o["metin"]))
        kz = {"kod": o["kod"], "metin": o["metin"], "aciklamalar": o["aciklamalar"]}
        if konulu:
            kz["konu"] = parca[1] - 1
        sonuc[ui]["kazanimlar"].append(kz)
    for ui, u in enumerate(uniteler):
        u_kz = sonuc[ui]["kazanimlar"]
        u_kz.sort(key=lambda k: [int(x) for x in k["kod"].split(".")])  # kararlı: aynı numaralılar kaynak sırasında kalır
        beklenen = u[1] if u[1] is not None else sum(k[1] for k in u[3])
        if len(u_kz) != beklenen:
            print(f"  ! {ad} / {u[0]}: {len(u_kz)} kazanım ayrıştırıldı, tabloda {beklenen}")
        if konulu:
            for ki, k in enumerate(u[3]):
                n = sum(1 for x in u_kz if x["konu"] == ki)
                if n != k[1]:
                    print(f"  ! {ad} / {k[0]}: {n} kazanım, tabloda {k[1]}")
    return sonuc


def bolum_al(metin, bas, son=None):
    m = None
    for m in re.finditer(bas, metin):
        pass  # son geçiş (içindekiler ve şema sayfalarındaki örnekler atlanır)
    if not m:
        sys.exit(f"Bölüm bulunamadı: {bas}")
    parca = metin[m.start():]
    if son:
        s = re.search(son, parca[len(m.group(0)):])
        if s:
            parca = parca[:len(m.group(0)) + s.start()]
    return parca


def spor_tablosu(metin):
    """Spor Eğitimi süre tablosu -> [(modül adı, [(ünite adı, kazanım, saat)])]"""
    tablo = bolum_al(metin, r"2\.4 ÜNİTE, KAZANIM SAYISI VE SÜRE TABLOSU", r"3\.1\. ÖĞRETİM PROGRAMININ YAPISI")
    duz = "|".join(bosluk(l) for l in tablo.split("\n") if bosluk(l))
    moduller = []
    for m in re.finditer(r"Ünite (\d+): ([^|]+)\|(\d+)\|(\d+)\|", duz):
        if m.group(1) == "1":
            moduller.append([])
        moduller[-1].append((f"{m.group(1)}. ÜNİTE: {m.group(2).strip()}", int(m.group(3)), int(m.group(4))))
    return moduller


def spor_ayristir(bilgi, metin):
    tablo = spor_tablosu(metin)
    bolum = bolum_al(metin, bilgi["bas"])
    basliklar = list(re.finditer(r"^MODÜL (\d+): (.+)$", bolum, re.M))
    if len(basliklar) != len(tablo):
        sys.exit(f"Spor Eğitimi: {len(basliklar)} modül, tabloda {len(tablo)}")
    planlar = []
    for i, m in enumerate(basliklar):
        parca = bolum[m.start():(basliklar[i + 1].start() if i + 1 < len(basliklar) else len(bolum))]
        onek = "(TS)" if "(TS)" in parca[:20000] and "(BS)" not in parca[:20000] else "(BS)"
        ad = m.group(2).strip()
        ogeler = kazanimlari_ayir(parca, 3, onek)
        # Kod "modül.ünite.kazanım": ünite sırasına göre yerleştirmek için modül numarasını at
        for o in ogeler:
            o["kod"] = ".".join(o["kod"].split(".")[1:])
        ad_sade = ad.title().replace("İ", "İ")
        planlar.append({
            "ek": ("bs" if onek == "(BS)" else "ts") + f"{int(m.group(1)):02d}",
            "etiket": f"{'Bireysel Sporlar' if onek == '(BS)' else 'Takım Sporları'} – {tr_baslik(ad)}",
            "uniteler": plan_kur(ogeler, tablo[i], False, f"Spor Eğitimi {ad}"),
        })
    return planlar


def tr_baslik(s):
    kucuk = {"ve", "ile"}
    return " ".join(w if w.lower() in kucuk else w[:1] + w[1:].translate(str.maketrans("İI", "iı")).lower() for w in s.split())


# Sosyal Medya (MTAL seçmeli meslek dersi, 11-12. sınıf, haftada 2 saat):
# kazanımlar 2026-2027'de 11. sınıfa uygulanan çerçeve öğretim programından (cop11, ör. Büro Yönetimi ve Yönetici
# Asistanlığı Alanı ÇÖP, "SOSYAL MEDYA DERSİ"), öğrenme birimi süreleri, konular ve kazanım açıklamaları ders bilgi
# formundan (meslek.meb.gov.tr/dbflistele.aspx?sinif_kodu=11 – Muhasebe ve Finansman Alanı, "SOSYAL MEDYA 11-12")
# aynen aktarılmıştır.
SOSYAL_MEDYA = {
    "ad": "Sosyal Medya Dersi – MTAL Çerçeve Öğretim Programı ve Ders Bilgi Formu (11-12. sınıf)",
    "url": "https://meslek.meb.gov.tr/upload/cop11/buro_11.pdf",
    "pdf": "buro_yonetimi_cop_11.pdf; sosyal_medya_dbf.pdf",
    "planlar": [{"uniteler": [
        {"baslik": "1. E-TİCARET", "saat": 18,
         "konular": [{"ad": "E-Ticaret"}, {"ad": "E-Ticaret Türleri"}, {"ad": "E-Ticarette Pazarlama"},
                     {"ad": "Alt Yapı ve Güvenlik"}, {"ad": "E-Ticarette Hukuki Düzenlemeler"}],
         "kazanimlar": [
             {"kod": "1.1", "konu": 0, "metin": "E-ticarete ilişkin temel kavramları açıklar.",
              "aciklamalar": ["E-ticarete ilişkin temel kavramlar açıklanır.", "Avantaj ve Dezavantajları açıklanır."]},
             {"kod": "1.2", "konu": 1, "metin": "E-ticaret türlerini açıklar.",
              "aciklamalar": ["E-ticaret türleri açıklanır.", "E-ticaret çalışma şekil ve örnekleri açıklanır."]},
             {"kod": "1.3", "konu": 2, "metin": "E-ticarette pazarlama aşamalarını sıralar.",
              "aciklamalar": ["E-ticaretle yapılacak işin planlaması açıklanır.", "Pazarlama için kullanılacak araçlar açıklanır.",
                              "Elektronik pazarlama yöntemleri açıklanır."]},
             {"kod": "1.4", "konu": 3, "metin": "E-ticaret için gereken teknik alt yapı ve güvenlik unsurlarını açıklar.",
              "aciklamalar": ["E-ticaret için kullanılacak teknik internet alt yapısı, yazılımı, hazır yazılım paketleri açıklanır.",
                              "Güvenlik sistemleri açıklanır.", "Güvenli ödeme yöntemleri açıklanır."]},
             {"kod": "1.5", "konu": 4, "metin": "E-ticaret ile ilgili hukuki düzenlemeleri takip eder.",
              "aciklamalar": ["E-ticaret Kanun ve uygulamaları açıklanır."]},
         ]},
        {"baslik": "2. SOSYAL MEDYA", "saat": 30,
         "konular": [{"ad": "Etik ve Bilişim Etiği"}, {"ad": "Bilgi Güvenliği ve Hukuki Kurallar"},
                     {"ad": "Siber Zorbalıktan Korunma Yöntemleri"}, {"ad": "Dijital Marka Yönetimi ve Dijital Dönüşüm"},
                     {"ad": "Sosyal Medya Araçları"}, {"ad": "Sosyal Medya İçerik Planı"},
                     {"ad": "Sosyal Medya Analiz ve Raporlama"}, {"ad": "Kriz İletişimi"}],
         "kazanimlar": [
             {"kod": "2.1", "konu": 0, "metin": "Sosyal medyayı kullanırken temel hak ve özgürlükler kapsamında etik kurallara uygun paylaşım yapar.",
              "aciklamalar": ["Etik kavramı açıklanır.", "Etik ilkeler açıklanır.", "Bilişim etiği ile ilgili bilgi verilir.",
                              "Bilişimde temel hak ve özgürlükler kavramları ile ilgili bilgi verilir.",
                              "Sosyal medya etiği kavramları ile ilgili bilgi verilir.", "İnternet etiği kavramları ile ilgili bilgi verilir."]},
             {"kod": "2.2", "konu": 1, "metin": "Kimlik gizlenmeden hukuki kuralların sorumluluklarını göze alarak sosyal medya kullanır.",
              "aciklamalar": ["Bilgi ve bilgi güvenliği kavramları ile ilgili bilgi verilir."]},
             {"kod": "2.3", "konu": 2, "metin": "Sosyal medyayı kullanırken siber şiddete karşı kendini korur.",
              "aciklamalar": ["Siber Zorbalık kapsamı açıklanır.", "Güvenlik yazılımları açıklanır.", "Siber zorbalıktan korunma yöntemleri açıklanır."]},
             {"kod": "2.4", "konu": 3, "metin": "Dijital marka yönetimini ve dijital dönüşüm gerekliliğini açıklar.",
              "aciklamalar": ["Dijital marka yönetimi ve dönüşüm açıklanır."]},
             {"kod": "2.5", "konu": 4, "metin": "Sosyal medya araçlarını açıklar.",
              "aciklamalar": ["Sosyal medyada kullanılan araçlar açıklanır."]},
             {"kod": "2.6", "konu": 5, "metin": "Sosyal medya platformları için içerik planı oluşturur.",
              "aciklamalar": ["Hedef Kitlenin tespiti açıklanır.", "Uygun kategorilerin oluşturulması açıklanır.",
                              "İçerik Planı takviminin hazırlanması açıklanır."]},
             {"kod": "2.7", "konu": 6, "metin": "Sosyal medya analizi ve raporlama yapar.",
              "aciklamalar": ["Hedef kitle ile iletişimin önemi açıklanır.", "Sosyal medya analizi açıklanır.",
                              "Analizde kullanılan bazı siteler açıklanır."]},
             {"kod": "2.8", "konu": 7, "metin": "Sosyal medyada kriz iletişimi kampanyası planlama ve uygulama yapar.",
              "aciklamalar": ["Sosyal medya politikasının oluşumu açıklanır.", "Örnek olaylar hakkında açıklamalar yapılır.",
                              "Kriz iletişim planının oluşturulması açıklanır.", "Deneyimler araştırılarak uygulamalar açıklanır."]},
         ]},
        {"baslik": "3. VERİ ANALİZİ VE GRAFİKLER", "saat": 24,
         "konular": [{"ad": "Veri ve Bilgi"}, {"ad": "Veri Türleri"}, {"ad": "Veri Toplama"}, {"ad": "Veri Hazırlama"},
                     {"ad": "Grafik Çeşitleri"}, {"ad": "Grafik Oluşturma"}],
         "kazanimlar": [
             {"kod": "3.1", "konu": 0, "metin": "Veri ve bilgi kavramlarını açıklar.",
              "aciklamalar": ["Veri kavramı açıklanır.", "Bilgi kavramı açıklanır."]},
             {"kod": "3.2", "konu": 1, "metin": "Veri türlerini ve çevresindeki veri kaynaklarını açıklar.",
              "aciklamalar": ["Veri türleri açıklanır.", "Veri kaynakları (birincil/ikincil) açıklanır."]},
             {"kod": "3.3", "konu": 2, "metin": "Veri toplama araçlarıyla veriyi toplar ve veri kümesi oluşturur.",
              "aciklamalar": ["Veri toplama yöntemleri açıklanır.", "Veri kümesi oluşturma açıklanır."]},
             {"kod": "3.4", "konu": 3, "metin": "Tablolar hâlinde veri hazırlar.",
              "aciklamalar": ["Elde edilen verilerin bir tabloya aktarılarak açıklanmasını sağlar."]},
             {"kod": "3.5", "konu": 4, "metin": "Grafik çeşitlerini tanır ve amaca uygun grafik seçimi yapar.",
              "aciklamalar": ["Grafik çeşitlerini açıklar.", "Amaca uygun grafik seçimini yaptırır."]},
             {"kod": "3.6", "konu": 5, "metin": "Veri görselleştirme araçlarını kullanarak veriye dayalı grafikler oluşturur.",
              "aciklamalar": ["Veri kaynaklarının grafikte kullanımını açıklar.", "Verilerle grafikler oluşturulmasını sağlar."]},
         ]},
    ]}],
}


def main():
    sonuc = {}
    for anahtar, bilgi in DERSLER.items():
        metin = metin_oku(bilgi["pdf"])
        if bilgi.get("spor"):
            planlar = spor_ayristir(bilgi, metin)
        elif bilgi.get("moduller"):
            bolum = bolum_al(metin, bilgi["bas"])
            bas = [m.start() for m in re.finditer(r"^1\. ÜNİTE:", bolum, re.M)]
            if len(bas) != len(bilgi["planlar"]):
                sys.exit(f"{anahtar}: {len(bas)} modül bulundu, beklenen {len(bilgi['planlar'])}")
            planlar = []
            for i, p in enumerate(bilgi["planlar"]):
                parca = bolum[bas[i]:(bas[i + 1] if i + 1 < len(bas) else len(bolum))]
                planlar.append({"ek": p["ek"], "etiket": p["etiket"],
                                "uniteler": plan_kur(kazanimlari_ayir(parca, 2), p["uniteler"], False, p["etiket"])})
        else:
            planlar = []
            for p in bilgi["planlar"]:
                bolum = bolum_al(metin, p.get("bas", bilgi.get("bas")), p.get("son"))
                konulu = bilgi.get("konulu", False)
                ogeler = kazanimlari_ayir(bolum, 3 if konulu else 2)
                planlar.append({"ek": p.get("ek", ""), "etiket": p.get("etiket", ""),
                                "uniteler": plan_kur(ogeler, p["uniteler"], konulu, p.get("etiket") or anahtar)})
        sonuc[anahtar] = {"ad": bilgi["ad"], "url": bilgi["url"], "pdf": bilgi["pdf"], "planlar": planlar}
    sonuc["sosyal-medya"] = SOSYAL_MEDYA
    for anahtar, k in sonuc.items():
        for p in k["planlar"]:
            n = sum(len(u["kazanimlar"]) for u in p["uniteler"])
            s = sum(u["saat"] for u in p["uniteler"])
            print(f"{anahtar:32} {p.get('ek', ''):5} {len(p['uniteler'])} ünite, {n:3} kazanım, {s} saat  {p.get('etiket', '')}")
    with open(CIKTI, "w", encoding="utf-8") as fh:
        json.dump(sonuc, fh, ensure_ascii=False, indent=1)
        fh.write("\n")


if __name__ == "__main__":
    main()
