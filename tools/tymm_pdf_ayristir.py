#!/usr/bin/env python3
"""
TYMM portalında ünite/tema sayfası henüz yayımlanmamış derslerin resmî öğretim programı PDF'lerini ayrıştırır ve
tymm_uniteler.json ile aynı biçimde kayıt üretir (veri_olustur.py bu kayıtları "yalnız TYMM ünite verisi olan dersler"
gibi ünite ders saatlerine göre haftalara dağıtır).

Girdi:
  tools/kaynaklar/tymm/<ders>_<tarih>.pdf   (tymm.meb.gov.tr/ogretim-programlari/ders/<ders> sayfasındaki program PDF'i)
Çıktı:
  tools/kaynaklar/tymm/tymm_pdf_uniteler.json

Ders listesi aşağıdaki PDF_DERSLER sözlüğündedir. Tema adları ve ders saatleri programın
"Tema, Öğrenme Çıktısı Sayısı ve Süre Tablosu"ndan alınır; tema sayfasındaki saat tabloyla çelişirse uyarı verilir.

Gereksinim: PyMuPDF (pip install pymupdf). CI bu aracı çalıştırmaz; çıktı JSON depoda tutulur.
"""
import json
import os
import re
import sys
import unicodedata

import fitz  # PyMuPDF

KOK = os.path.dirname(os.path.abspath(__file__))
TYMM = os.path.join(KOK, "kaynaklar", "tymm")
CIKTI = os.path.join(TYMM, "tymm_pdf_uniteler.json")

# anahtar ("<slug>|<sınıf>") -> PDF bilgisi. Sınıf, TYMM portalındaki sınıflandırmadır (17 = "S": ortaöğretim seçmeli
# dersler listesi); uygulamadaki sınıf düzeyi veri_olustur.py'de haftalık ders çizelgesine göre verilir.
PDF_DERSLER = {
    "saglik-bilgisi-ve-trafik-kulturu-dersi|S": {
        "ders": "Sağlık Bilgisi ve Trafik Kültürü Dersi",
        "slug": "saglik-bilgisi-ve-trafik-kulturu-dersi",
        "sinif": "S",
        "kademe": 3,
        "pdf": "saglik-bilgisi-ve-trafik-kulturu-dersi_20260908_183434_364.pdf",
        "kod": "SBTK",
    },
}

TR_UST = str.maketrans({"i": "İ", "ı": "I"})


def tr_upper(s):
    return s.translate(TR_UST).upper()


def bosluk(s):
    return re.sub(r"\s+", " ", s or "").strip()


def satirlari_birlestir(satirlar):
    """PDF satırlarını tek paragrafa birleştirir; satır sonunda tirelenmiş sözcükleri ("kişi-\\nsel") onarır."""
    metin = ""
    for l in satirlar:
        l = bosluk(l)
        if not l:
            continue
        if metin.endswith("-") and re.search(r"[a-zçğıöşüâîû]-$", metin) and re.match(r"[a-zçğıöşüâîû]", l):
            metin = metin[:-1] + l
        elif metin:
            metin += " " + l
        else:
            metin = l
    return bosluk(metin)


def sayfa_metinleri(yol, baslik_deseni):
    """Sayfa üst bilgisini (sayfa no + program adı) ve tema sayfalarının altındaki bölüm başlığını atar."""
    sayfalar = []
    for p in fitz.open(yol):
        satirlar = unicodedata.normalize("NFC", p.get_text()).split("\n")
        temiz = []
        for i, l in enumerate(satirlar):
            s = l.strip()
            if i < 3 and (re.fullmatch(r"\d{1,3}", s) or re.fullmatch(baslik_deseni, s)):
                continue
            temiz.append(l)
        sayfalar.append("\n".join(temiz))
    return sayfalar


def sure_tablosu(metin):
    """"TEMA / Öğrenme Çıktısı Sayısı / Süre" tablosu -> [(no, ad, cikti_sayisi, saat)]"""
    return [(int(m.group(1)), bosluk(m.group(2)), int(m.group(3)), int(m.group(4)))
            for m in re.finditer(r"^(\d)\. ([^\n]+)\n(\d+)\n(\d+)\n\d+\s*$", metin, re.M)]


def bolum(metin, bas, son):
    m = re.search(bas + r"(.*?)" + son, metin, re.S)
    return m.group(1) if m else ""


def ciktilar_ayristir(metin, kod):
    """"SBTK.1.1. ... a) ... b) ..." -> [{"cikti": "SBTK.1.1. ...", "surec": ["a) ...", ...]}]"""
    sonuc = []
    gecerli = None
    madde = None
    for l in metin.split("\n"):
        s = l.replace("\t", " ").strip()
        if not s:
            continue
        m = re.match(rf"^({re.escape(kod)}\.\d+\.\d+\.?)\s*(.*)$", s)
        if m:
            gecerli = {"_cikti": [m.group(1).rstrip(".") + ". " + m.group(2)], "_surec": []}
            sonuc.append(gecerli)
            madde = None
            continue
        if gecerli is None:
            continue
        m = re.match(r"^([a-zçğıöşü])\)\s*(.*)$", s)
        if m:
            madde = [f"{m.group(1)}) {m.group(2)}"]
            gecerli["_surec"].append(madde)
        elif madde is not None:
            madde.append(s)
        else:
            gecerli["_cikti"].append(s)
    return [{"cikti": satirlari_birlestir(c["_cikti"]).rstrip(" ."),
             "surec": [satirlari_birlestir(m) for m in c["_surec"]]} for c in sonuc]


def ders_ayristir(anahtar, bilgi):
    yol = os.path.join(TYMM, bilgi["pdf"])
    program_adi = tr_upper(bilgi["ders"]) + r"\s+ÖĞRETİM PROGRAMI"
    sayfalar = sayfa_metinleri(yol, program_adi)
    tum = "\n".join(sayfalar)
    tablo = sure_tablosu(tum)
    if not tablo:
        sys.exit(f"{anahtar}: süre tablosu bulunamadı")
    # Tema sayfalarının altındaki "2. … ÖĞRETİM PROGRAMI’NA AİT TEMALAR" bölüm başlığı metne karışmasın
    tum = re.sub(r"\n\d\.\s+" + program_adi + r"’NA AİT\s*\n\s*TEMALAR\s*\n", "\n", tum)
    # Program yapısı şemasında da örnek tema başlığı geçer; her tema numarasının son geçtiği yer asıl tema bölümüdür
    son_gecis = {}
    for m in re.finditer(r"^(\d)\. TEMA: [^\n]*$", tum, re.M):
        son_gecis[m.group(1)] = m
    basliklar = sorted(son_gecis.values(), key=lambda m: m.start())
    uniteler = []
    for i, m in enumerate(basliklar):
        no = int(m.group(1))
        parca = tum[m.end():(basliklar[i + 1].start() if i + 1 < len(basliklar) else len(tum))]
        satir = next((t for t in tablo if t[0] == no), None)
        if satir is None:
            sys.exit(f"{anahtar}: {no}. tema süre tablosunda yok")
        _, ad, cikti_sayisi, saat = satir
        aciklama = satirlari_birlestir(bolum(parca, r"^", r"\nDERS SAATİ").split("\n"))
        sayfa_saat = re.search(r"DERS SAATİ\s+(\d+)", parca)
        if sayfa_saat and int(sayfa_saat.group(1)) != saat:
            print(f"UYARI {anahtar} {no}. tema: tema sayfasında {sayfa_saat.group(1)} saat, süre tablosunda {saat} saat; "
                  f"tablo esas alındı (tablo toplamı programın toplam süresiyle tutarlıdır).")
        ciktilar = ciktilar_ayristir(bolum(parca, r"VE SÜREÇ BİLEŞENLERİ", r"İÇERİK ÇERÇEVESİ"), bilgi["kod"])
        if len(ciktilar) != cikti_sayisi:
            sys.exit(f"{anahtar} {no}. tema: {len(ciktilar)} öğrenme çıktısı ayrıştırıldı, tabloda {cikti_sayisi}")
        icerik = [bosluk(l) for l in bolum(parca, r"İÇERİK ÇERÇEVESİ", r"\nAnahtar Kavramlar").split("\n") if bosluk(l)]
        kavramlar = satirlari_birlestir(bolum(parca, r"\nAnahtar Kavramlar", r"(?:\n\s*ÖĞRENME\s*\n\s*KANITLARI|$)").split("\n"))
        olcme = satirlari_birlestir(bolum(parca, r"\(Ölçme ve\s*\n\s*Değerlendirme\)", r"\nÖĞRENME-ÖĞRETME\s*\n").split("\n"))
        destek = satirlari_birlestir(bolum(parca, r"\nDestekleme", r"\nÖĞRETMEN\s*\n\s*YANSITMALARI").split("\n"))
        uniteler.append({
            "id": None,
            # Başlıktaki büyük harfler PDF yazı tipinde noktasız (ERGENLIK) çıktığından ad süre tablosundan alınır
            "baslik": f"{no}. TEMA: {tr_upper(ad)}",
            "aciklama": aciklama,
            "olcme": olcme,
            "destekleme": destek,
            "duzey": None,
            "Ders Saati": str(saat),
            "Öğrenme Çıktıları ve Süreç Bileşenleri": ciktilar,
            "İçerik Çerçevesi": "\n".join(icerik),
            "Anahtar Kavramlar": kavramlar,
        })
    if len(uniteler) != len(tablo):
        sys.exit(f"{anahtar}: {len(uniteler)} tema ayrıştırıldı, tabloda {len(tablo)}")
    kayit = {k: bilgi[k] for k in ("ders", "slug", "sinif", "kademe", "pdf")}
    kayit["ders_id"] = None
    kayit["uniteler"] = uniteler
    return kayit


def main():
    sonuc = {}
    for anahtar, bilgi in PDF_DERSLER.items():
        kayit = ders_ayristir(anahtar, bilgi)
        sonuc[anahtar] = kayit
        print(f"{anahtar}: {len(kayit['uniteler'])} tema, "
              f"{sum(len(u['Öğrenme Çıktıları ve Süreç Bileşenleri']) for u in kayit['uniteler'])} öğrenme çıktısı, "
              f"{sum(int(u['Ders Saati']) for u in kayit['uniteler'])} ders saati")
    with open(CIKTI, "w", encoding="utf-8") as fh:
        json.dump(sonuc, fh, ensure_ascii=False, indent=1)
        fh.write("\n")


if __name__ == "__main__":
    main()
