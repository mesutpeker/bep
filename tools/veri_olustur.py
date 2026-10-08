#!/usr/bin/env python3
"""
BEP uygulamasının ders verilerini resmî kaynaklardan derler.

Girdi:
  tools/ara/planlar_ham.json              (plan_ayristir.py çıktısı)
  tools/kaynaklar/tymm/tymm_uniteler.json  (tymm.meb.gov.tr ünite sayfaları)
Çıktı:
  data/dersler.js   -> window.BEP_VERI = { meta, dersler: [...] }

Kaynaklar:
  * OGM / TYMM 2026-2027 Taslak Çerçeve Yıllık Planları (tymm.meb.gov.tr/taslak-cerceve-planlari/ortaogretim)
  * DÖGM 2026-2027 Çerçeve Yıllık Planları (dogm.meb.gov.tr/www/cerceve-yillik-planlar/icerik/2257)
  * TYMM Öğretim Programları ünite sayfaları (tymm.meb.gov.tr/ogretim-programlari)
"""
import collections
import datetime as dt
import json
import os
import re
import unicodedata

KOK = os.path.dirname(os.path.abspath(__file__))
PROJE = os.path.dirname(KOK)
ARA = os.path.join(KOK, "ara")
CIKTI = os.path.join(PROJE, "data")

HAFTA_SAYISI = 37  # 36 öğretim haftası + 37. hafta (sosyal etkinlik)

# MEB 2026-2027 çalışma takvimi (meb.gov.tr, haber/41057): ders yılı 14.09.2026 - 25.06.2027
DERS_BASI = dt.date(2026, 9, 14)
DERS_SONU = dt.date(2027, 6, 25)
TATIL_PAZARTESILERI = {dt.date(2026, 11, 16), dt.date(2027, 1, 25), dt.date(2027, 2, 1), dt.date(2027, 3, 8)}
RESMI_HAFTALAR = []  # 1..37 numaralı öğretim haftalarının pazartesi tarihleri
_g = DERS_BASI
while _g <= DERS_SONU:
    if _g not in TATIL_PAZARTESILERI:
        RESMI_HAFTALAR.append(_g)
    _g += dt.timedelta(days=7)
assert len(RESMI_HAFTALAR) == HAFTA_SAYISI, len(RESMI_HAFTALAR)
AYLAR = {"EYL": 9, "EKİ": 10, "EKI": 10, "KAS": 11, "ARA": 12, "OCA": 1, "ŞUB": 2, "SUB": 2, "MAR": 3, "NİS": 4, "NIS": 4, "MAY": 5, "HAZ": 6}


def resmi_hafta_no(tarih_metni, varsayilan):
    """Plan satırındaki tarih metnini resmî hafta numarasına (1..37) çevirir; tatil ise 0."""
    t = tr_upper(tarih_metni or "")
    if "TATİL" in t:
        return 0
    m = re.search(r"(\d{1,2})", t)
    ay = None
    for a in re.finditer(r"(EYL|EKİ|EKI|KAS|ARA|OCA|ŞUB|SUB|MAR|NİS|NIS|MAY|HAZ)", t):
        ay = AYLAR[a.group(1)]
        break
    if not m or not ay:
        return varsayilan
    gun = int(m.group(1))
    yil = 2026 if ay >= 9 else 2027
    try:
        tarih = dt.date(yil, ay, gun)
    except ValueError:
        return varsayilan
    pazartesi = tarih - dt.timedelta(days=tarih.weekday())
    if pazartesi in TATIL_PAZARTESILERI:
        return 0
    if pazartesi in RESMI_HAFTALAR:
        return RESMI_HAFTALAR.index(pazartesi) + 1
    return varsayilan


# --------------------------------------------------------------------------- yardımcılar
def nfc(s):
    return unicodedata.normalize("NFC", s or "")


def tr_upper(s):
    return s.replace("i", "İ").replace("ı", "I").upper()


def tr_lower(s):
    return s.replace("I", "ı").replace("İ", "i").lower()


def tr_title(s):
    """'SÖZÜN İNCELİĞİ' -> 'Sözün İnceliği' (bağlaçlar küçük)."""
    kucuk = {"ve", "ile", "ya", "veya", "da", "de", "ki", "mi"}
    out = []
    for i, w in enumerate(s.split(" ")):
        lw = tr_lower(w)
        if i > 0 and lw in kucuk:
            out.append(lw)
        elif w[:1] in "“\"'(":
            out.append(w[0] + tr_upper(w[1:2]) + tr_lower(w[2:]))
        else:
            out.append(tr_upper(w[:1]) + tr_lower(w[1:]))
    return " ".join(out)


def bosluk(s):
    return re.sub(r"\s+", " ", (s or "").replace("\xa0", " ")).strip()


def kisalt(s, n):
    s = bosluk(s)
    if len(s) <= n:
        return s
    kes = s[:n].rsplit(" ", 1)[0].rstrip(",;:-–")
    return kes + "…"


def nokta_duzelt(s):
    """'açıklar..' -> 'açıklar.' (üç nokta ve '…' korunur)."""
    return re.sub(r"(?<![.…])\.\.(?![.…])", ".", s)


def cumle(s, dil="tr"):
    s = bosluk(s).strip(" -–•*")
    # Sondaki ';', ':' ve ',' nokta eklenmeden silinir ("… experience;" -> "… experience."); "belirler ." -> "belirler."
    s = re.sub(r"\s*[;:,]+$", "", s)
    s = nokta_duzelt(re.sub(r"\s+(?=[.!?…]$)", "", s))
    if not s:
        return s
    # İngilizce cümlede ilk harf Türkçe kuralla büyütülmez ("identify" -> "Identify", "İdentify" değil)
    s = (s[0].upper() if dil == "en" else tr_upper(s[0])) + s[1:]
    if s[-1] not in ".!?…":
        s += "."
    return s


# Cümle sonu sayılmayan kısaltmalar ("Kültürümüzde Hz. Muhammed …", "… vb. Örnekler …")
KISALTMA_SONU = re.compile(r"(?:^|[\s(“\"'])(?:Hz|vb|vd|vs|sav|Dr|Doç|Prof|yy|bkz|Bkz|örn|Örn|M\.Ö|M\.S)\.$")


def ilk_cumle(s):
    """Metnin ilk cümlesi; kısaltmadan sonraki büyük harf yeni cümle sayılmaz."""
    for m in re.finditer(r"(?<=[a-zçğıöşü]\.)\s+(?=[A-ZÇĞİÖŞÜ])", s):
        if not KISALTMA_SONU.search(s[:m.start()]):
            return s[:m.start()]
    return s


def tirnak_dengele(s):
    """Kaynaktaki karışık tırnak çiftlerini “…” yapar ('"X\'\'', '“X"', "''X”") ve başta ya da sonda eşi olmayan
    tırnağı siler ('“Enfal Suresi ve Anlam' -> 'Enfal Suresi ve Anlam'; kısaltmada kapanışı kesilmiş alıntı)."""
    if s.count('"') % 2:
        s = re.sub(r"\"([^\"“”]+?)''", r"“\1”", s, count=1)
        s = re.sub(r"“([^\"“”]+?)\"", r"“\1”", s, count=1)
    if s.count("”") > s.count("“"):
        s = re.sub(r"''(?=\w)([^\"“”]+?)”", r"“\1”", s, count=1)
    if s[:1] == "“" and "”" not in s or s[:1] == '"' and s.count('"') == 1:
        s = s[1:].lstrip()
    if s[-1:] == "”" and "“" not in s or s[-1:] == '"' and s.count('"') == 1:
        s = s[:-1].rstrip()
    return s


# Yeterlilik ifadesini geniş zamana çevirme (src/js/kutuphane.js fiilCekimle ile aynı kurallar)
SESLI, KALIN = "aeıioöuüâîû", "aıouâû"
ISTISNA_IR = {"al", "bil", "bul", "dur", "gel", "gör", "kal", "ol", "öl", "san", "var", "ver", "vur"}


def fiil_cekimle(kelime):
    """'yönetebilme' -> 'yönetir', 'açıklayabilme' -> 'açıklar', 'edebilme' -> 'eder'"""
    m = re.match(rf"^([{HARF}]+?)(ebilme|abilme)$", kelime)
    if not m:
        return None
    kok = m.group(1)
    if re.search(r"[aeıioöuüâîû]y$", kok):
        kok = kok[:-1]  # kaynaştırma y'si
    if kok.endswith("ed") or kok in ("gid", "güd"):
        return kok + "er"  # et- > ed-er
    if kok == "tad":
        return "tadar"
    if kok[-1] in SESLI:
        return kok + "r"
    v = next((h for h in reversed(kok) if h in SESLI), "e")
    if sum(h in SESLI for h in kok) <= 1 and kok not in ISTISNA_IR:
        return kok + ("ar" if v in KALIN else "er")
    return kok + ("ır" if v in "aıâ" else "ir" if v in "eiî" else "ur" if v in "ouû" else "ür")


def yeterlilikten_genis_zamana(s):
    """'… sürecini değerlendirebilme' -> '… sürecini değerlendirir' (bağlaçla sıralanan fiiller de çekimlenir)."""
    s = bosluk(s).rstrip(".;:")
    if not re.search(r"(?:ebilme|abilme)$", s):
        return None
    return re.sub(rf"[{HARF}]+(?:ebilme|abilme)(?=$|,|\s+ve\s|\s+ya da\s|\s+veya\s)",
                  lambda m: fiil_cekimle(m.group(0)) or m.group(0), s)


# --------------------------------------------------------------------------- ham hücre onarımı
# Kaynak Excel ve TYMM metinlerindeki yazım artıkları, boşluk normalleştirmeden ÖNCE ham hücre düzeyinde onarılır:
#   * satır sonu tirelemesi: "kul-lanacağını", "ana-\nlitik"  -> "kullanacağını", "analitik"
#   * bitişik yazılmış sözcükler: "Gerçek SayılardaTanımlı"   -> "Gerçek Sayılarda Tanımlı"
#   * CSV kaçış tırnakları: '"Sub-themes: ""…""…"'            -> 'Sub-themes: "…"…'
HARF = "A-Za-zÇĞİÖŞÜçğıöşüâîûÂÎÛ"
KUCUK = "a-zçğıöşüâîû"
BUYUK = "A-ZÇĞİÖŞÜÂÎÛ"
SOZLUK = collections.Counter()  # derlemdeki bağımsız (tiresiz) sözcüklerin sıklığı (küçük harf)
TIRELI = collections.Counter()  # derlemdeki satır içi "a-b" yazımlarının sıklığı
ONARIM_KAYDI = collections.Counter()  # (tür, önce, sonra) -> adet; main() sonunda listelenir
# Büyük-küçük harf geçişi meşru olan yazımlar (marka, kısaltma, özel ad)
BITISIK_ISTISNA = {
    "GeoGebra", "PhET", "YouTube", "PowerPoint", "JavaScript", "iPad", "iPhone", "iOS", "HeLa",
    "ReactionDataExtractor", "DesJardins", "LaTeX", "WhatsApp", "LinkedIn", "TikTok", "ChatGPT", "OpenAI",
    "GitHub", "WordPress", "OneNote", "SketchUp", "AutoCAD", "NetLogo", "MacBook", "McDonald", "PhD",
    "DeepMind", "SolidWorks", "LibreOffice", "OpenOffice", "QuickTime", "PubMed", "BioRender", "LearningApps",
    "WordWall", "StoryJumper", "MindMeister", "TinkerCad", "eTwinning", "eKitap",
}
BITISIK_DUZELT = {"alFitr": "al-Fitr", "EnglishFrench": "English-French"}


def sozluk_kur(metinler):
    """Tireleme kararları için derlemdeki sözcük ve tireli yazım sıklıklarını çıkarır."""
    for s in metinler:
        for m in re.finditer(rf"(?<![\w’'-])[{HARF}]+(?![\w-])", s):
            SOZLUK[tr_lower(m.group(0))] += 1
        for m in re.finditer(rf"(?<![\w’'-])([{HARF}]+)-([{HARF}]+)(?![\w-])", s):
            TIRELI[(tr_lower(m.group(1)), tr_lower(m.group(2)))] += 1


def tire_onar(s):
    """Satır sonu tirelemesini birleştirir; "sosyo-kültürel", "e-posta", "neden-sonuç", "Ural-Altay" gibi
    gerçek tireli yazımları korur. Karar derlem sıklığına dayanır: bitişik biçim derlemde bağımsız sözcük
    olarak geçiyor ve tirenin sağındaki parça tek başına bir sözcük olarak daha seyrek görülüyorsa tireleme
    artığıdır."""
    def satir_sonu(m):  # "ana-\nlitik"
        a, b = m.group(1), m.group(2)
        bitisik = SOZLUK[tr_lower(a + b)]
        if bitisik and SOZLUK[tr_lower(b)] < bitisik:
            ONARIM_KAYDI[("satır sonu tirelemesi", a + "-⏎" + b, a + b)] += 1
            return a + b
        if m.group(0) != a + "-" + b:
            ONARIM_KAYDI[("tireli sözcükte satır kırılımı", a + "-⏎" + b, a + "-" + b)] += 1
        return a + "-" + b  # gerçek tireli sözcük: yalnız satır kırılımı kalkar

    def satir_ici(m):  # "kul-lanacağını"
        a, b = m.group(1), m.group(2)
        bitisik = SOZLUK[tr_lower(a + b)]
        # Sağ parça tek harfse Farsça tamlama ekidir ("Devlet-i Aliyye", "ilm-i", "Rasathâne-i"): korunur.
        if (len(a) >= 2 and len(b) >= 2 and bitisik >= max(5, 5 * TIRELI[(tr_lower(a), tr_lower(b))])
                and SOZLUK[tr_lower(b)] < bitisik):
            ONARIM_KAYDI[("satır içi tireleme artığı", a + "-" + b, a + b)] += 1
            return a + b
        return m.group(0)

    def bosluklu(m):  # "well- being", "Akıl- vahiy": tireden sonra yanlışlıkla boşluk
        a, b = m.group(1), m.group(2)
        if TIRELI[(tr_lower(a), tr_lower(b))]:
            ONARIM_KAYDI[("tireden sonra boşluk", a + "- " + b, a + "-" + b)] += 1
            return a + "-" + b
        return m.group(0)

    s = re.sub(rf"(?<![\w’'-])([{HARF}]*[{KUCUK}])-[ \t]*\n[ \t\n]*([{KUCUK}]+)(?![\w-])", satir_sonu, s)
    s = re.sub(rf"(?<![\w’'-])([{HARF}]*[{KUCUK}])-[ \t]+([{KUCUK}]+)(?![\w-])", bosluklu, s)
    return re.sub(rf"(?<![\w’'-])([{HARF}]*[{KUCUK}])-([{KUCUK}]+)(?![\w-])", satir_ici, s)


def bitisik_onar(s):
    """'SayılardaTanımlı' -> 'Sayılarda Tanımlı' (küçük harften hemen sonra büyük+küçük harf).
    İstisna listesindeki yazımlar ile rakam, URL ya da e-posta içindeki parçalar korunur."""
    def duzelt(m):
        w = m.group(0)
        if w in BITISIK_DUZELT:
            ONARIM_KAYDI[("bitişik yazım", w, BITISIK_DUZELT[w])] += 1
            return BITISIK_DUZELT[w]
        if w in BITISIK_ISTISNA or not re.search(rf"[{KUCUK}][{BUYUK}][{KUCUK}]", w):
            return w
        yeni = re.sub(rf"(?<=[{KUCUK}])(?=[{BUYUK}][{KUCUK}])", " ", w)
        ONARIM_KAYDI[("eksik boşluk", w, yeni)] += 1
        return yeni
    return re.sub(rf"(?<![\w/.@#:])[{HARF}]+(?![\w/@])", duzelt, s)


def tirnak_onar(s):
    """Hücre başında/sonunda kalmış CSV kaçış tırnaklarını kaldırır."""
    t = s.strip()
    kapanis = re.search(r'"(?=[ \t]*(?:\n|$))', t[1:]) if t[:1] == '"' else None
    if len(t) > 1 and t[0] == '"' and '""' in t:
        yeni = re.sub(r'"$', "", t[1:]).replace('""', '"')  # '"Sub-themes: ""…""…"'
    elif kapanis and '"' not in t[1:kapanis.start() + 1] and "\n" in t[1:kapanis.start() + 1]:
        yeni = t[1:kapanis.start() + 1] + t[kapanis.end() + 1:]  # '"ENG.9.1.L1.\n…theme."\nd) …'
    elif t.count('"') % 2 == 1 and t[:1] == '"':
        yeni = t[1:]
    elif t.count('"') % 2 == 1 and t[-1:] == '"':
        yeni = t[:-1]
    else:
        return s
    ONARIM_KAYDI[("CSV tırnağı", kisalt(t, 40), kisalt(yeni, 40))] += 1
    return yeni


def pua_onar(s):
    """Symbol yazı tipinin özel kullanım alanı (PUA, U+F020–U+F07E) karakterlerini ASCII karşılığına çevirir:
    '\\uf045\\uf031\\uf031\\uf02e\\uf033\\uf02eS2\\uf02e' -> 'E11.3.S2.'"""
    return re.sub("[\uf020-\uf07e]", lambda m: chr(ord(m.group(0)) - 0xF000), s)


def ham_onar(s):
    s = pua_onar(nfc(s)).replace("\xa0", " ")
    return bitisik_onar(tire_onar(tirnak_onar(s)))


# --------------------------------------------------------------------------- ünite adları
UNITE_DUZELT = [
    (r"HOME0STAZ", "HOMEOSTAZ"),
    (r"TEKNOLOJİLERİİ", "TEKNOLOJİLERİ"),
    (r"ZENGNİLEŞTİRME", "ZENGİNLEŞTİRME"),
]


def unite_normalize(s):
    s = bosluk(nfc(s))
    for a, b in UNITE_DUZELT:
        s = re.sub(a, b, s)
    s = tr_upper(s) if re.search(r"[a-zçğıöşü]", s) and s.isupper() is False and s[:1].isdigit() else s
    # "1.TEMA X" / "1. TEMA X" / "1. TEMA: X" -> "1. TEMA: X"
    m = re.match(r"^(\d+)\s*[\.\-]\s*(TEMA|ÜNİTE|Ünite|Tema)\s*[:\-]?\s*(.+)$", s)
    if m:
        s = f"{m.group(1)}. {tr_upper(m.group(2))}: {m.group(3).strip()}"
    m = re.match(r"^(TEMA|ÜNİTE)\s+(\d+)\s*[:\-]\s*(.+)$", s, re.I)
    if m:
        s = f"{m.group(2)}. {tr_upper(m.group(1))}: {m.group(3).strip()}"
    m = re.match(r"^(\d+)\s*[\.\-]\s*([^\d\s].+)$", s)
    if m and not re.match(r"^\d+\.\s*(TEMA|ÜNİTE):", s):
        s = f"{m.group(1)}. {m.group(2).strip()}"
    m = re.match(r"^(\d+\.\d+)\.\s*(.+)$", s)
    if m:
        s = f"{m.group(1)}. {m.group(2).strip()}"
    s = s.replace("CANLILARDA ENERJİ DÖNÜŞÜMLERi", "CANLILARDA ENERJİ DÖNÜŞÜMLERİ")
    return s.rstrip("*").strip()


def unite_anahtar(s):
    s = tr_upper(unite_normalize(s))
    s = re.sub(r"^\d+(\.\d+)?\.\s*(TEMA|ÜNİTE)?\s*:?\s*", "", s)
    return re.sub(r"[^A-ZÇĞİÖŞÜ0-9]", "", s)


UNITE_BASI = re.compile(r"^(\d+\s*[\.\-]|\d+\.\d+\.|THEME\s*\d|TEMA\s*\d|ÜNİTE\s*\d|UNIT\s*\d|OKUL TEMELLİ|SOSYAL ETKİNLİK|ZENGİNLEŞTİRME|ZENGNİLEŞTİRME|EVALUATION|REVISION|ORIENTATION)", re.I)


def unite_bol(hucre):
    """Bir hücredeki birden fazla ünite adını ayırır (geçiş haftaları)."""
    s = nfc(hucre).replace("\xa0", " ")
    # Satır kırılmalı tek ad ("5. KUR’AN’A GÖRE\nHZ. MUHAMMED") ile iki ayrı üniteyi ayırt et
    satirlar = []
    for satir in re.split(r"\n+", s):
        satir = satir.strip()
        if not satir:
            continue
        if satirlar and not UNITE_BASI.match(tr_upper(satir)):
            satirlar[-1] = satirlar[-1] + " " + satir
        else:
            satirlar.append(satir)
    parcalar = []
    for satir in satirlar:
        # "12.1. ÇEMBERSEL HAREKET 12.2. BASİT ..." -> iki ünite
        alt = re.split(r"\s+(?=\d+\.\d+\.\s)", satir)
        for a in alt:
            for b in re.split(r"\s{2,}", a):
                if b.strip():
                    parcalar.append(b.strip())
    # "1.TEMA" + "SÖZÜN İNCELİĞİ" gibi satır bölünmelerini birleştir
    birlesik = []
    for p in parcalar:
        if birlesik and re.match(r"^\d+\s*\.?\s*(TEMA|ÜNİTE)\s*:?$", birlesik[-1], re.I):
            birlesik[-1] = birlesik[-1] + " " + p
        else:
            birlesik.append(p)
    return birlesik


def ozel_hafta_turu(unite):
    u = tr_upper(unite)
    if "OKUL TEMELLİ PLANLAMA" in u:
        return "OTP"
    if u.startswith("ZENGİNLEŞTİRME") or u.startswith("ZENGNİLEŞTİRME"):
        return "ZEN"
    if "SOSYAL ETKİNLİK" in u:
        return "SE"
    if u in ("EVALUATION", "DEĞERLENDİRME"):
        return "DEG"
    return None


# --------------------------------------------------------------------------- konu
BECERI_BASLIK = {
    "OKUMA": "Okuma", "YAZMA": "Yazma", "KONUŞMA": "Konuşma", "DİNLEME/İZLEME": "Dinleme/İzleme",
    "DİNLEME": "Dinleme", "SÖZLÜ İLETİŞİM": "Sözlü İletişim", "DİL BİLGİSİ KONULARI": "Dil Bilgisi",
    "DİL BİLGİSİ": "Dil Bilgisi",
}
BASLIK_DESENI = re.compile(r"^(OKUMA|YAZMA|KONUŞMA|DİNLEME/İZLEME|DİNLEME|SÖZLÜ İLETİŞİM|DİL BİLGİSİ KONULARI|DİL BİLGİSİ)\b")
# Satır içi öğretmen notu: "… şiir örneği -1960 sonrası … şairlerden seçilir."
NOT_SONU = re.compile(r"(?:[ıiuü]l[ıiuü]r|[ıiuü]n[ıiuü]r|[ae]n[ıi]r|melidir|malıdır)\.?\s*$")
MADDE_NO = re.compile(r"^(?:(?:[A-ZÇĞİÖŞÜ]\.)?[A-ZÇĞİÖŞÜ]{2,6}\.(?=\d))?(?:\d{1,2}\.)+\d{0,2}\s*(?=\S)")  # "12.3.1.", "TD.12.3."


def baslik_ayir(satir):
    """'OKUMA', 'Dil Bilgisi Konuları', 'YAZMA: …' gibi beceri başlıklarını ayırır."""
    m = BASLIK_DESENI.match(tr_upper(satir))
    if not m:
        return None, satir
    h = m.group(1)
    kalan = satir[len(h):]
    if not kalan.strip(" :") or kalan.lstrip().startswith(":") or satir.startswith(h):
        return BECERI_BASLIK[h], kalan.strip(" :")
    return None, satir


def dil_bilgisi_ogesi(o):
    """'Metinler üzerinden imla ve noktalama çalışmaları yapılır.' -> 'imla ve noktalama'"""
    o = re.sub(r"^(?:Metinler|Metin)\s+üzerinde(?:n)?\s+", "", o, flags=re.I)
    o = re.sub(r"\s+(?:ile\s+ilgili\s+)?çalışma(?:lar|ları)?\s+yapılır\.?$", "", o)
    o = re.sub(r"\s+yapılır\.?$", "", o).strip(" .;")
    return tr_lower(o[:1]) + o[1:] if len(o) > 1 and o[1].islower() else o


def ogrencilerden(o):
    """'Öğrencilerden … yazmaları istenir.' -> '… yazma'"""
    o = re.sub(r"^Öğrencilerden\s+", "", o)
    o = re.sub(r"(ma|me)(ları|leri)(\s+ve\s)", r"\1\3", o)
    o = re.sub(r"(ma|me)(ları|leri)\s+istenir.*$", r"\1", o)
    return re.sub(r"\s+istenir.*$", "", o)


ETIKETLER = re.compile(
    r"^(?:Sub-themes:|Target Vocabulary in Use(?:\s*\(with revisional vocabulary\))?:|Target Grammatical Structures in Use:)\s*",
    re.I)


def konu_ogesi(o):
    o = MADDE_NO.sub("", o.strip()).strip()
    while ETIKETLER.match(o):
        o = ETIKETLER.sub("", o)
    parca = re.split(r"\s+[-–]\s*(?=\S)", o, maxsplit=1)
    if len(parca) == 2 and NOT_SONU.search(parca[1]):
        o = parca[0]
    o = re.split(r"\s[-–]\s?(?=[A-ZÇĞİÖŞÜ])", o)[0]
    return o.strip(" ;,.")


# Hücre içinde alt satıra kaydırılmış başlıkları (ör. "İdeal Gaz / Yasası") ayrı konu
# satırlarından (ör. "Felsefenin Anlamı / Felsefi Düşüncenin Özellikleri") ayırt etmek için:
DEVAM_EDEN_SON = re.compile(
    r"(?:[,:/(&+-]|\b(?:ve|ile|veya|ya da|ya|için|olarak|gibi|and|or|of|the|to|in|with|for)"
    # tamlayan (-nın, -ların, ’ın), vasıta (-yla), yönelme (-ına), -daki
    r"|\w*n[ıiuü]n|\w*l[ae]r[ıi]n|\w+l[ae]r[ıi]n[ıi]|\w+[’']n?[ıiuü]n|\w+(?:yla|yle)|\w+[^\Waeıioöuü](?:la|le)|\w{2,}[ıiuü]n[ae]"
    r"|\w+[dt][ae]ki|\w+m[ae]d[ae]"
    # son çekim edatları
    r"|Karşı|Göre|Kadar|Doğru|Rağmen|Dair|İlişkin|Yönelik|Ait|Bağlı|Üzerine|Hakkında|Açısından|Bakımından"
    # sıfat-fiil / zarf-fiil
    r"|\w+[dt][ıiuü]ğ[ıiuü]|\w+(?:yan|yen)|\w+(?:madan|meden|arak|erek)|[İi]çeren|[Ee]den|[Oo]lan|[Yy]apan"
    r"|[Gg]österen|[Kk]ullanılan|[Bb]ulunan|[Yy]er [Aa]lan)$")
# Tek başına konu olamayan birleşik isim başları ("Denge" + "Sabiti …", "İdeal Gaz" + "Yasası")
BIRLESIK_BAS = re.compile(
    r"^(?:Sabiti|Yasası|Kanunu|Teorisi|Modeli|Sistemi|Yöntemi|Süreci|Hızı|Dengesi|Enerjisi|Formülü|Tepkimesi"
    r"|Özellikleri|Çeşitleri|Türleri|Yapısı|Önemi|Etkileri|Uygulamaları|Farklılıkları|İlkesi|Kavramı|İletimi"
    r"|Dönüşümü|Akışı|Döngüsü|Mekanizması|Kontrolü|Sentezi|Analizi|Ölçümü)\b")


def satir_devami_mi(onceki, satir):
    """Konu hücresinde yeni satırın önceki maddenin devamı olup olmadığını tahmin eder."""
    if re.search(r"[.;!?]$", onceki):
        return False
    if onceki.count("(") > onceki.count(")") or onceki.count("[") > onceki.count("]"):
        return True
    if re.match(r"^[a-zçğıöşü(]", satir) or DEVAM_EDEN_SON.search(onceki) or BIRLESIK_BAS.match(satir):
        return True
    kelimeler, onceki_k = satir.split(" "), onceki.split(" ")
    ilk = kelimeler[0].strip(",;:")
    if re.search(r"(?:arak|erek)$", ilk):
        return True
    # "Kimyasal (Stokiyometrik)" + "Hesaplamalar"
    if len(kelimeler) == 1 and len(onceki_k) >= 2 and re.search(r"(?:[ıiuü]|l[ae]r)$", ilk):
        return True
    # "… Seçiminde Dikkat" + "Edilmesi Gerekenler"
    if len(onceki_k) >= 2 and re.search(r"m[ae]s[ıi]$", ilk):
        return True
    # "… / Ekosistemde" + "Madde ve Enerji Akışı", "İnsanda" + "Sindirim"
    son_parca = re.split(r"[,/;]\s*", onceki)[-1].split(" ")
    if re.search(r"[dt][ae]$", son_parca[-1]) and (len(son_parca) == 1 or len(kelimeler) == 1):
        return True
    return False


def kisa_konu(s, n=150):
    """Plan hücresindeki konu metnini satır yapısını koruyarak kısaltır.
    Numaralı maddeler ve beceri başlıkları (Okuma, Dil Bilgisi Konuları …) korunur;
    '-' ile başlayan öğretmen notları ayıklanır (Dil Bilgisi maddeleri hariç)."""
    s = nfc(s).replace("\xa0", " ").strip()
    if not s:
        return ""
    s = re.sub(r"Tema içeriğine\s+uygun\s+(bir\s+)?", "", s, flags=re.I)
    s = re.sub(r"(D(?:İNLEME|inleme))\s*/\s*((?:İ|i)(?:ZLEME|zleme))", r"\1/\2", s)
    bolumler = [[None, []]]  # [başlık, [[metin, tür], …]]  tür: ham | dil | ogr | sub
    notlar = []
    son = None  # son işlenen satır (madde ya da not): alt satıra taşan devamı buna eklenir
    for satir in (bosluk(l) for l in s.split("\n")):
        if not satir:
            continue
        bas, kalan = baslik_ayir(satir)
        if bas:
            bolumler.append([bas, []])
            son = None
            if not kalan:
                continue
            satir = kalan
        aktif = bolumler[-1]
        if re.match(r"^[-–]", satir):
            icerik = re.sub(r"^[-–]\s*", "", satir)
            if aktif[0] == "Dil Bilgisi":
                son = [icerik, "dil"]
            elif re.match(r"^Öğrencilerden\s", icerik):
                son = [icerik, "ogr"]
            elif re.match(r"^Sub-themes:", icerik, re.I):
                son = [icerik, "sub"]
            else:
                son = [icerik, "not"]  # öğretmene yönelik açıklama
                notlar.append(son)
                continue
            aktif[1].append(son)
            continue
        if re.match(r"^Öğrencilerden\s", satir):
            son = [satir, "ogr"]
            aktif[1].append(son)
            continue
        if son and not re.match(r"^(?:[•●▪]|\d{1,2}\.)", satir) and satir_devami_mi(son[0], satir):
            son[0] += " " + satir
            continue
        son = [satir, "ham"]
        aktif[1].append(son)
    parcalar = []
    for bas, hamlar in bolumler:
        ogeler = []
        for metin, tur in hamlar:
            if tur == "dil":
                ogeler.append(dil_bilgisi_ogesi(metin))
                continue
            if tur == "ogr":
                ogeler.append(ogrencilerden(metin))
                continue
            if tur == "sub":
                ogeler.append(re.sub(r"^Sub-themes:\s*", "", metin, flags=re.I).strip(" ;,."))
                continue
            # Madde imleri ve satır içindeki kod numaralı başlıklar ("KEPLER KANUNLARI 12.2.1 BASİT HARMONİK …",
            # "Bitki Biyolojisi 12.3.1. Bitkilerin Yapısı", "Kötülük Problemi 2.11.Sahte Peygamberlik") ayrı konu öğesidir.
            for o in re.split(r"\s*[•●▪]\s*|(?:(?<=[.;:!?)])|(?<=[A-ZÇĞİÖŞÜ]{3}))\s+(?=\d{1,2}(?:\.\d{1,2})*\.\s+[A-ZÇĞİÖŞÜ])"
                              r"|(?<=[A-ZÇĞİÖŞÜa-zçğıöşü])\s+(?=\d{1,2}(?:\.\d{1,2})+(?:\.?\s+|\.)[A-ZÇĞİÖŞÜ])", metin):
                o = konu_ogesi(o)
                ogeler.append(dil_bilgisi_ogesi(o) if bas == "Dil Bilgisi" else o)
        ogeler = list(dict.fromkeys(o for o in ogeler if o and not re.match(r"^Hedef (?:Kelimeler|Dil Yapıları)$", o)))
        latin = [o for o in ogeler if re.search(r"[A-Za-zÇĞİÖŞÜçğıöşü]", o)]
        if latin:
            ogeler = latin
        if not ogeler:
            continue
        if bas:
            govde = ", ".join(ogeler) if all(len(t) < 40 for t in ogeler) else "; ".join(ogeler)
            parcalar.append(f"{bas}: {govde}")
        else:
            parcalar.append("; ".join(ogeler))
    if not parcalar:
        basliklar = [b for b, _ in bolumler if b]
        parcalar = [n[0].strip(" ;,.") for n in notlar[:1]] or basliklar[:1]
    return kisalt(". ".join(parcalar), n)


# --------------------------------------------------------------------------- öğrenme çıktıları / kazanımlar
# Kod gövdeleri. Sayı bölümleri en çok iki basamaklıdır ve bölümler arasında boşluk yoktur; böylece
# "TAR.10.2.2. 1299-1453 yılları …", "ÇTDT.1.1. 1919-1945 …", "8.2.1990 sonrasında …" gibi metinlerde yıl koda
# yutulmaz. Harfli bölümler: "MAT.H.4.3", "MÜZ.HAZ.1.1", "SBÇ.III.1.1", "T.MAT.11.2.1", "ENG.PREP.1.L1".
SAYI = r"\d{1,2}(?!\d)"
HARFLI_KOD = (r"(?:[A-ZÇĞİÖŞÜ]\.)?[A-ZÇĞİÖŞÜ]{2,6}\d{0,2}(?:\s?\.\s?|\s)?(?:[A-ZÇĞİÖŞÜ]{1,4}\.)*"
              + SAYI + r"(?:\." + SAYI + r")*\.?(?:[A-Z]\d{1,2}\.?)?")
KOD_DESENLERI = [
    re.compile(r"^(?P<kod>E\d{1,2}\.\d{1,2}\.?[A-Z](?:\.?\d{1,2})?\.?)\s*(?P<metin>\S.*)$"),
    re.compile(r"^(?P<kod>" + HARFLI_KOD + r")\s*(?P<metin>\S.*)$"),
    re.compile(r"^(?P<kod>[A-Z]\.\s?" + SAYI + r"\.\s?" + SAYI + r"\.?)\s*(?P<metin>\S.*)$"),
    re.compile(r"^(?P<kod>" + SAYI + r"\.[A-ZÇĞİÖŞÜ]\." + SAYI + r"\.?)\s*(?P<metin>\S.*)$"),  # "11.A.1. İstiklâl …"
    re.compile(r"^(?P<kod>" + SAYI + r"(?:\." + SAYI + r")+\.?)\s*(?P<metin>(?:[^\d\s]|\d{4}(?!\d)).*)$"),
    re.compile(r"^(?P<kod>\d+\.)\s+(?P<metin>[^\d\s].*)$"),
    re.compile(r"^(?P<kod>\d{1,2}\.)(?=[A-ZÇĞİÖŞÜ][a-zçğıöşüâîû])(?P<metin>.*)$"),  # "1.Peygamberi sevmenin …"
]
# Metin içine gömülü (birleşmiş) kazanım kodları: "… açıklar. 12.4.2.1.. Büyük patlama …"
GOMULU_KOD = re.compile(
    r"\s+(?P<kod>(?:[A-ZÇĞİÖŞÜ]\.)?[A-ZÇĞİÖŞÜ]{2,6}\d{0,2}\.?(?:[A-ZÇĞİÖŞÜ]{1,4}\.)*" + SAYI
    + r"(?:\." + SAYI + r"|\.[A-Z]\d{1,2})+|" + SAYI + r"(?:\." + SAYI + r"){2,})\.*\s*(?=[A-ZÇĞİÖŞÜ“\"'])")
REFERANS = re.compile(r"(KAZANIMLARI|bkz\.|kazanım ve\s+açıklamaları|ünite tablosunda|EK\s?\d)", re.I)
# Kazanım / süreç bileşeni hücresine eklenmiş öğretmen notu başlığı ("… yürütebilme\n\nZenginleştirme: Öğrencilerden …")
NOT_BASLIGI = re.compile(r"(?:^|\s|\.)\s*(?:Zenginleştirme|ZENGİNLEŞTİRME|ZENGNİLEŞTİRME|Destekleme|DESTEKLEME)\s*\d*\s*:")
BECERI_BASLIGI = re.compile(
    r"^(?:Listening|Pronunciation|Speaking|Reading|Writing|Interaction|Production|Vocabulary|Grammar)"
    r"(?:\s*(?:and|&|/)\s*\w+)?:?$", re.I)


def kod_ayir(satir):
    for d in KOD_DESENLERI:
        m = d.match(satir)
        if m:
            kod = re.sub(r"\s+", "", m.group("kod")).rstrip(".")
            if "." not in kod and not kod[:1].isdigit():
                continue  # "COVID 19 …" gibi nokta içermeyen harfli eşleşmeler kod değildir
            metin = m.group("metin").strip().lstrip(".;:, ")
            if re.fullmatch(r"\d{1,2}\.?", metin):
                # Satır yalnız koddan oluşuyor ("İÇYÇ.3.1"): geri izleme son kod bölümünü metne kaydırmasın
                return re.sub(r"\s+", "", satir).rstrip("."), ""
            return kod, metin
    return None, satir


def kod_sil(s):
    """Satır başındaki kazanım kodunu siler ('BİY.10.1.7.b) …' -> 'b) …')."""
    m = re.match(r"^(" + HARFLI_KOD + r")\s*", s)
    if m and "." in m.group(1):
        return s[m.end():]
    return s


def _kod_ailesi(kod):
    """'TDE3.2' -> 'TDE', 'BİY.10.1.1' -> 'BİY', '12.4.1.3' -> '12'."""
    m = re.match(r"^(?:[A-ZÇĞİÖŞÜ]\.)?([A-ZÇĞİÖŞÜ]{2,6})", kod or "")
    return m.group(1) if m else (kod or "").split(".")[0]


def gomulu_bol(kod, metin):
    """Tek satırda birleşmiş kazanımları kendi kodlarıyla ayırır. Yalnız güvenilir durumlar bölünür:
    aynı kod ailesinden ('12.4.1.3' … '12.4.2.1', 'TDE3.2' … 'TDE3.3') ya da en az dört sayı bölümlü kodlar;
    tek numaralı DÖGM kazanımlarında ise cümle sonundan sonra gelen bir sonraki numara ('2. … 3. …')."""
    parcalar = [[kod, metin]]
    while True:
        k, t = parcalar[-1]
        bolundu = False
        for m in GOMULU_KOD.finditer(t):
            yeni = m.group("kod")
            ayni_aile = bool(k) and _kod_ailesi(yeni) == _kod_ailesi(k)
            if ayni_aile or len(re.findall(r"\d+", yeni)) >= 4 and not re.match(r"^[A-ZÇĞİÖŞÜ]", yeni):
                parcalar[-1][1] = t[:m.start()].strip()
                parcalar.append([yeni.rstrip("."), t[m.end():].strip()])
                bolundu = True
                break
        if not bolundu and k and re.fullmatch(r"\d{1,2}", k):
            m = re.search(r"(?<=[.!?])\s+(" + str(int(k) + 1) + r")\.\s*(?=[A-ZÇĞİÖŞÜ])", t)
            if m:
                parcalar[-1][1] = t[:m.start()].strip()
                parcalar.append([m.group(1), t[m.end():].strip()])
                bolundu = True
        if not bolundu:
            return parcalar


def buyuk_baslik_mi(s):
    """'DİNLEME/İZLEME-ANLAMLANDIRMA', 'PROCESS COMPONENTS FOR …' gibi tamamı büyük harfli başlık satırı."""
    return len(re.findall(r"[A-ZÇĞİÖŞÜ]", s)) >= 3 and not re.search(r"[a-zçğıöşüâîû]", s)


def ciktilar_ayristir(s):
    s = nfc(s).replace("\xa0", " ")
    # İngilizce eski program: "Listening E11.1.L1.Students ... Speaking E11.1.S1. ..." tek satırda
    s = re.sub(r"\s*(?:Listening|Pronunciation|Speaking|Reading|Writing|Interaction|Production)?\s*(?=\bE\d{1,2}\.\d+\.[A-Z]\d+\.)", "\n", s)
    girdiler = []
    not_modu = False  # "Zenginleştirme: …" öğretmen notu ve devam satırları kazanıma eklenmez
    for satir in s.split("\n"):
        satir = satir.strip()
        if not satir:
            continue
        if REFERANS.search(satir) and len(satir) < 160:
            continue
        kod, metin = kod_ayir(satir)
        if not kod and not_modu:
            continue
        not_modu = False
        m = NOT_BASLIGI.search(metin if kod else satir)
        if m:
            not_modu = True
            if kod:
                metin = metin[:m.start()].rstrip()
            else:
                satir = satir[:m.start()].rstrip()
                if not satir:
                    continue
        if kod:
            if buyuk_baslik_mi(metin):
                continue  # "ARP.10.1.1. DİNLEME/İZLEME-ANLAMLANDIRMA" gibi kodlu beceri başlıkları
            girdiler.append([kod, metin])
        elif (BECERI_BASLIGI.match(re.sub(r"^[•●▪]\s*", "", satir))
              or (satir.isupper() and len(re.findall(r"[A-ZÇĞİÖŞÜ]", satir)) >= 3)):
            continue  # "KONUŞMA", "Speaking" gibi beceri başlıkları önceki kazanıma eklenmez
        elif re.match(r"^[•●▪]\s*", satir) and len(satir) > 25:
            girdiler.append(["", re.sub(r"^[•●▪]\s*", "", satir)])  # madde imli her satır ayrı kazanım
        elif girdiler:
            girdiler[-1][1] = (girdiler[-1][1] + " " + satir).strip()
        elif len(satir) > 25 and not satir.isupper():
            girdiler.append(["", satir])
    sonuc = []
    for kod0, metin0 in girdiler:
        for kod, metin in gomulu_bol(kod0, bosluk(metin0)):
            metin = tirnak_dengele(nokta_duzelt(bosluk(metin).strip(" -–")))
            if len(metin) < 6 or not re.search(rf"[{HARF}]", metin):
                continue  # "….........." gibi harf içermeyen dolgu satırları
            if [kod, metin] not in sonuc:
                sonuc.append([kod, metin])
    return sonuc


def parantez_icinde(s, i):
    """s[i] konumu, aynı satırda açılıp kapanmamış bir parantezin içinde mi? ('(P, V, T, n)')"""
    return re.search(r"\([^)]*$", s[s.rfind("\n", 0, i) + 1:i]) is not None


def madde_bol(desen, s):
    """Metni desenin eşleştiği yerlerden böler; açık parantez içindeki eşleşmeler madde imi sayılmaz
    ('… değişkenler (P, V, T, n) arasındaki …' bölünmez)."""
    parcalar, bas = [], 0
    for m in re.finditer(desen, s):
        if not parantez_icinde(s, m.start()):
            parcalar.append(s[bas:m.start()])
            bas = m.end()
    parcalar.append(s[bas:])
    return parcalar


def davranislar_tymm(surec, dil="tr"):
    """Süreç bileşenlerinden öğrenci davranışı cümleleri (geniş zaman)."""
    s = nfc(surec).replace("\xa0", " ")
    # Aynı satırda birleşik gelen maddeleri ayır: "… yapar. d) …", "… seçer.b) …", "BİY.10.1.7.b) …",
    # "… BİY.10.1.2. a) …", "… • …"
    s = "\n".join(madde_bol(r"\s+(?=[a-zçğıöşü]\)\s)|(?:\s+|(?<=[.!?;]))(?=[a-zçğıöşü]\)\s?[A-ZÇĞİÖŞÜa-zçğıöşü])", s))
    s = re.sub(r"\s+(?=(?:[A-ZÇĞİÖŞÜ]\.)?[A-ZÇĞİÖŞÜ]{2,6}\.(?:[A-ZÇĞİÖŞÜ]{1,4}\.)*" + SAYI
               + r"\." + SAYI + r"(?:\." + SAYI + r")*\.?\s)", "\n", s)
    s = re.sub(r"(?<=\S)\s+(?=•)", "\n", s)
    # Kaynakta büyük harfle yazılmış madde imleri ("a) …\nB) …\nC)…"): küçük harfli "a)" ile başlayan hücrelerde
    if re.search(r"(?:^|\n)\s*a\)", s):
        s = re.sub(r"(?m)^(\s*)([A-ZÇĞİÖŞÜ])\)\s*", lambda m: m.group(1) + tr_lower(m.group(2)) + ") ", s)
    madde, baslik = [], []
    cur = None
    not_modu = False  # "Zenginleştirme: …" notu: yeni madde imine kadarki satırlar atılır
    for satir in s.split("\n"):
        satir = satir.strip()
        if not satir:
            continue
        yeni_madde = re.match(r"^(?:[•●▪\-–]|[a-zçğıöşü]\))", satir)
        if not_modu and not yeni_madde:
            continue
        not_modu = False
        m = NOT_BASLIGI.search(satir)
        if m:
            not_modu = True
            satir = satir[:m.start()].rstrip()
            if not satir:
                continue
        if re.match(r"^[•●▪\-–]\s*", satir):
            cur = ["m", re.sub(r"^[•●▪\-–]\s*", "", satir)]
            madde.append(cur)
        elif re.match(r"^[a-zçğıöşü]\)\s*", satir):
            t = re.sub(r"^[a-zçğıöşü]\)\s*", "", satir)
            kod, t = kod_ayir(t)
            cur = ["b", t]
            baslik.append(cur)
        elif cur is not None:
            cur[1] = cur[1] + " " + satir
        else:
            kod, t = kod_ayir(satir)
            cur = ["b", t]
            baslik.append(cur)
    adaylar = [x[1] for x in (madde or baslik)]
    sonuc = []
    for a in adaylar:
        a = bosluk(a)
        a = re.split(r"\s\*\s?|\s\(\*\)", a)[0]  # "*" ile başlayan zenginleştirme notlarını ayır
        a = ilk_cumle(a)  # yalnız ilk cümle ("Hz.", "vb." gibi kısaltmalarda kesilmez)
        a = re.sub(r"^[a-zçğıöşü]\)\s*", "", kod_sil(a))
        if len(a) < 8 or buyuk_baslik_mi(a):
            continue  # "PROCESS COMPONENTS FOR THE RELEVANT OUTCOMES …" gibi bölüm başlıkları
        if dil == "tr":
            a = yeterlilikten_genis_zamana(a) or a  # "… değerlendirebilme" -> "… değerlendirir"
        a = cumle(tirnak_dengele(a), dil)
        if a not in sonuc:
            sonuc.append(a)
    return sonuc


def davranislar_eski(ciktilar):
    sonuc = []
    for kod, metin in ciktilar:
        m = cumle(metin)
        if re.search(r"(r|r\)|z)\.$", m) and m not in sonuc:
            sonuc.append(m)
    return sonuc


# --------------------------------------------------------------------------- ölçme araçları
ARACLAR = [
    ("Çalışma kâğıdı", ["çalışma kâğıd", "çalışma kağıd", "çalışma yaprağ", "etkinlik kâğıd", "etkinlik kağıd", "worksheet"]),
    ("Kontrol listesi", ["kontrol liste", "checklist"]),
    ("Dereceli puanlama anahtarı", ["dereceli puanlama", "rubrik", "rubric"]),
    ("Gözlem formu", ["gözlem form", "observation"]),
    ("Kısa cevaplı sorular", ["kısa cevaplı", "short answer"]),
    ("Açık uçlu sorular", ["açık uçlu", "open-ended"]),
    ("Eşleştirme", ["eşleştirme", "matching"]),
    ("Doğru-yanlış", ["doğru-yanlış", "doğru yanlış", "evet-hayır", "evet/hayır", "true/false"]),
    ("Boşluk doldurma", ["boşluk doldurma", "gap filling", "fill in"]),
    ("Çoktan seçmeli test", ["çoktan seçmeli", "multiple choice"]),
    ("Kavram haritası", ["kavram harita"]),
    ("Zihin haritası", ["zihin harita"]),
    ("Çıkış kartı", ["çıkış kart", "exit card", "exit ticket"]),
    ("Öz değerlendirme formu", ["öz değerlendirme", "self-assessment", "self assessment"]),
    ("Akran değerlendirme formu", ["akran değerlendirme", "peer assessment"]),
    ("Performans görevi", ["performans görev", "performance assignment", "performance task"]),
    ("Proje", ["proje", "project"]),
    ("Sunum", ["sunum", "sunu ", "presentation"]),
    ("Poster/afiş", ["poster", "afiş"]),
    ("Deney/uygulama", ["deney"]),
    ("Dereceleme ölçeği", ["dereceleme ölçeği"]),
    ("Ürün dosyası", ["ürün dosya", "portfolyo", "portfolio"]),
    ("Hikâye haritası", ["hikâye harita", "hikaye harita"]),
    ("Öğrenme günlüğü", ["öğrenme günlüğ"]),
    ("Karşılaştırma tablosu", ["karşılaştırma tablo"]),
    ("Bilgi görseli", ["bilgi görsel", "infografik"]),
    ("Tanılayıcı dallanmış ağaç", ["dallanmış ağaç"]),
    ("Yapılandırılmış grid", ["yapılandırılmış grid"]),
]


def olcme_araclari(s):
    t = tr_lower(nfc(s))
    out = []
    for ad, kelimeler in ARACLAR:
        if any(k in t for k in kelimeler):
            out.append(ad)
    return out


# --------------------------------------------------------------------------- belirli gün ve haftalar
# Belirli gün/hafta adı ya da tarihi: "ETKİNLİK" sütununa yazılmış etkinlik listeleri ("Kısa videolar Diyaloglar/soru
# cevap …", "Özdeğerlendirme (öğrenci için)") ve imza satırları ("OKUL MÜDÜRÜ") belirli gün sayılmaz
BELIRLI_GUN = re.compile(r"Gün[üu]\b|Haftası|Bayram|Kandili|Zaferi|Fethi|Gecesi|Yılbaşı|Başlangıcı|Anma\b|Kabulü"
                         r"|\b\d{1,2}\s*(?:-\s*\d{1,2}\s*)?(?:Ocak|Şubat|Mart|Nisan|Mayıs|Haziran|Temmuz|Ağustos|Eylül|Ekim|Kasım|Aralık)\b")


def gunler_ayristir(s):
    t = bosluk(nfc(s).replace("\n", " "))
    if not t:
        return []
    t = re.sub(r"\(\s*", "(", t)
    t = re.sub(r"\s*\)", ")", t)
    parcalar = re.split(r"(?<=\))\s+(?=[A-ZÇĞİÖŞÜ0-9])", t)
    out = []
    for p in parcalar:
        p = p.strip(" ,;/")
        if len(p) < 6 or not re.search(r"[A-Za-zÇĞİÖŞÜçğıöşü]{3}", p) or not BELIRLI_GUN.search(p):
            continue
        p = p.replace("Milli ", "Millî ").replace("Istiklal", "İstiklal")
        if "“" not in p:
            p = re.sub(r"(?<=\w)”[ıiuü](?=\s|$)", "", p)  # "Spor Bayramı”ı (19 Mayıs)" -> "Spor Bayramı (19 Mayıs)"
        if p not in out:
            out.append(p)
    return out


# --------------------------------------------------------------------------- katalog
DERSLER = {
    # id: (ad, grup, tymm_slug)
    "turk-dili-ve-edebiyati": ("Türk Dili ve Edebiyatı", "Türk Dili ve Edebiyatı", "turk-dili-ve-edebiyati-dersi"),
    "matematik": ("Matematik", "Matematik", "matematik-dersi"),
    "temel-matematik": ("Temel Matematik / Temel Düzey Matematik", "Matematik", "temel-matematik-dersi"),
    "matematik-uygulamalari": ("Matematik Uygulamaları", "Matematik", "matematik-uygulamalari-dersi"),
    "fizik": ("Fizik", "Fen Bilimleri", "fizik-dersi"),
    "kimya": ("Kimya", "Fen Bilimleri", "kimya-dersi"),
    "biyoloji": ("Biyoloji", "Fen Bilimleri", "biyoloji-dersi"),
    "tarih": ("Tarih", "Sosyal Bilimler", "tarih-dersi"),
    "inkilap-tarihi": ("T.C. İnkılap Tarihi ve Atatürkçülük", "Sosyal Bilimler", "tc-inkilap-tarihi-ve-ataturkculuk-dersi-2"),
    "cografya": ("Coğrafya", "Sosyal Bilimler", "cografya-dersi"),
    "felsefe": ("Felsefe", "Felsefe Grubu", "felsefe-dersi"),
    "psikoloji": ("Psikoloji", "Felsefe Grubu", "psikoloji-dersi"),
    "sosyoloji": ("Sosyoloji", "Felsefe Grubu", "sosyoloji-dersi"),
    "mantik": ("Mantık", "Felsefe Grubu", "mantik-dersi"),
    "sosyal-bilim-calismalari": ("Sosyal Bilim Çalışmaları", "Felsefe Grubu", "sosyal-bilim-calismalari-dersi"),
    "ingilizce": ("İngilizce", "Yabancı Dil", "ingilizce-dersi-9-12"),
    "din-kulturu": ("Din Kültürü ve Ahlak Bilgisi", "Din Kültürü ve Değerler", "din-kulturu-ve-ahlak-bilgisi-dersi-ortaogretim"),
    "peygamberimizin-hayati": ("Peygamberimizin Hayatı (Seçmeli)", "Din Kültürü ve Değerler", "peygamberimizin-hayati-dersi-2-ortaogretim"),
    "kuran-i-kerim": ("Kur'an-ı Kerim (Seçmeli)", "Din Kültürü ve Değerler", None),
    "temel-dini-bilgiler": ("Temel Dinî Bilgiler (Seçmeli)", "Din Kültürü ve Değerler", None),
    "beden-egitimi-ve-spor": ("Beden Eğitimi ve Spor", "Sanat ve Spor", "beden-egitimi-ve-spor-dersi"),
    "gorsel-sanatlar": ("Görsel Sanatlar", "Sanat ve Spor", "gorsel-sanatlar-dersi"),
    "muzik": ("Müzik", "Sanat ve Spor", "muzik-dersi"),
    "astronomi": ("Astronomi ve Uzay Bilimleri (Seçmeli)", "Seçmeli Dersler", "astronomi-ve-uzay-bilimleri-dersi"),
    "cagdas-turk-dunya-tarihi": ("Çağdaş Türk ve Dünya Tarihi (Seçmeli)", "Seçmeli Dersler", "cagdas-turk-ve-dunya-tarihi-dersi"),
    "demokrasi-insan-haklari": ("Demokrasi ve İnsan Hakları (Seçmeli)", "Seçmeli Dersler", "demokrasi-ve-insan-haklari-dersi"),
    "iklim-cevre": ("İklim, Çevre ve Yenilikçi Çözümler (Seçmeli)", "Seçmeli Dersler", "iklim-cevre-ve-yenilikci-cozumler-dersi"),
    "islam-bilim-tarihi": ("İslam Bilim Tarihi (Seçmeli)", "Seçmeli Dersler", "islam-bilim-tarihi-dersi"),
    "turk-kultur-medeniyet-tarihi": ("Türk Kültür ve Medeniyet Tarihi (Seçmeli)", "Seçmeli Dersler", "turk-kultur-ve-medeniyet-tarihi-dersi"),
    "aihl-kuran": ("Kur'an-ı Kerim (AİHL)", "Anadolu İmam Hatip Lisesi Meslek Dersleri", None),
    "aihl-temel-dini-bilgiler": ("Temel Dinî Bilgiler (AİHL)", "Anadolu İmam Hatip Lisesi Meslek Dersleri", None),
    "aihl-arapca": ("Arapça (AİHL)", "Anadolu İmam Hatip Lisesi Meslek Dersleri", None),
    "aihl-mesleki-arapca": ("Mesleki Arapça (AİHL)", "Anadolu İmam Hatip Lisesi Meslek Dersleri", None),
    "aihl-fikih": ("Fıkıh (AİHL)", "Anadolu İmam Hatip Lisesi Meslek Dersleri", None),
    "aihl-hadis": ("Hadis (AİHL)", "Anadolu İmam Hatip Lisesi Meslek Dersleri", None),
    "aihl-siyer": ("Siyer (AİHL)", "Anadolu İmam Hatip Lisesi Meslek Dersleri", None),
    "aihl-akaid": ("Akaid (AİHL)", "Anadolu İmam Hatip Lisesi Meslek Dersleri", None),
    "aihl-tefsir": ("Tefsir (AİHL)", "Anadolu İmam Hatip Lisesi Meslek Dersleri", None),
    "aihl-hitabet": ("Hitabet ve Mesleki Uygulama (AİHL)", "Anadolu İmam Hatip Lisesi Meslek Dersleri", None),
    "aihl-dinler-tarihi": ("Dinler Tarihi (AİHL)", "Anadolu İmam Hatip Lisesi Meslek Dersleri", None),
    "aihl-kelam": ("Kelam (AİHL)", "Anadolu İmam Hatip Lisesi Meslek Dersleri", None),
    "aihl-islam-kultur": ("İslam Kültür ve Medeniyeti (AİHL)", "Anadolu İmam Hatip Lisesi Meslek Dersleri", None),
}

OKUL_ETIKET = {
    "anadolu": "Anadolu Lisesi",
    "fen": "Fen Lisesi",
    "sosyal": "Sosyal Bilimler Lisesi",
    "genel": "Tüm lise türleri",
    "hazirlikli": "Hazırlık sınıfı bulunan liseler",
    "hazirliksiz": "Hazırlık sınıfı bulunmayan liseler",
    "aihl": "Anadolu İmam Hatip Lisesi",
}


def sinif_bul(*metinler):
    for m in metinler:
        u = tr_upper(m or "")
        if "HAZIRLIK" in u and "BULUN" not in u:
            return "H"
        r = re.search(r"\b(9|10|11|12)\s*\.?\s*SINIF", u)
        if r:
            return r.group(1)
        r = re.search(r"\(\s*(9|10|11|12)\s*\.?\s*SINIF", u)
        if r:
            return r.group(1)
    return None


def kimlik(p):
    """Ham plan sayfası -> (ders_id, sinif, okul, ek_etiket) ya da None."""
    k, dosya, sayfa, baslik = p["klasor"], p["dosya"], p["sayfa"], p["baslik"]
    U = tr_upper(dosya + " " + baslik)
    US = tr_upper(sayfa)
    okul = "fen" if ("FEN LİSE" in U or "FEN BİLİMLER" in U or "(FL)" in US or "F.L." in US) else ("sosyal" if "SOSYAL BİLİMLER" in U else "anadolu")
    sinif = sinif_bul(sayfa, baslik)
    ek = ""
    if p["kaynak"] == "ogm":
        if k in ("beden-egitimi-ve-spor", "gorsel-sanatlar", "muzik"):
            return k, sinif, "genel", ""
        if k == "ingilizce":
            hz = "hazirlikli" if "BULUNAN" in tr_upper(dosya) else "hazirliksiz"
            return "ingilizce", sinif, hz, ""
        if k == "tarih":
            return ("inkilap-tarihi" if sinif == "12" else "tarih"), sinif, okul, ""
        if k == "cografya":
            m = re.search(r"(\d)\s*SAAT", US)
            if m:
                ek = f"{m.group(1)}s"
            return "cografya", sinif, okul, ek
        if k == "temel-matematik":
            return "temel-matematik", sinif, "genel", ""
        if k == "felsefe":
            if "SOSYOLOJİ" in U:
                return "sosyoloji", "S", okul, ""
            if "MANTIK" in U:
                return "mantik", "S", okul, ""
            if "PSİKOLOJİ" in U or "PSİOKOLOJİ" in U:
                return "psikoloji", "S", okul, ""
            if "SBÇ" in US or "SÇB" in US or "SOSYAL BİLİM ÇALIŞ" in U:
                m = re.search(r"(\d)", US)
                return "sosyal-bilim-calismalari", "S", "sosyal", f"sbc{m.group(1) if m else ''}"
            return "felsefe", sinif, okul, ""
        return k, sinif, okul, ""
    # DÖGM
    d = tr_upper(dosya)
    if "DKAB" in d:
        return "din-kulturu", sinif_bul(baslik, dosya), "genel", ""
    if "PEYGAMBERIMIZINHAYATI" in d.replace("İ", "I"):
        return "peygamberimizin-hayati", sinif_bul(baslik, dosya), "genel", ""
    if "AIHL" in d.replace("İ", "I") or "AİHL" in d:
        dd = d.replace("İ", "I")
        g = sinif_bul(baslik, dosya)
        if "KURAN_HAZIRLIK" in dd:
            return "aihl-kuran", "H", "aihl", ""
        if "KURAN" in dd:
            m = re.search(r"KURAN(\d+)", dd)
            return "aihl-kuran", m.group(1) if m else g, "aihl", ""
        if "TEMELDINIBILGILER" in dd:
            return "aihl-temel-dini-bilgiler", "9", "aihl", ""
        if "MESLEKI_ARAPCA" in dd:
            m = re.search(r"ARAPCA_(\d+)", dd)
            return "aihl-mesleki-arapca", m.group(1) if m else g, "aihl", ""
        if "ARAPCA" in dd:
            m = re.search(r"ARAPCA_(\d+)", dd)
            return "aihl-arapca", m.group(1) if m else g, "aihl", ""
        for anahtar, did in (("FIKIH", "aihl-fikih"), ("HADIS", "aihl-hadis"), ("SIYER", "aihl-siyer"), ("AKAID", "aihl-akaid"),
                             ("HITABET", "aihl-hitabet"), ("TEFSIR", "aihl-tefsir"), ("KELAM", "aihl-kelam"),
                             ("DINLERTARIHI", "aihl-dinler-tarihi"), ("ISLAMKULTUR", "aihl-islam-kultur")):
            if anahtar in dd:
                m = re.search(anahtar + r"[A-Z]*?(\d+)", dd)
                return did, (m.group(1) if m else g), "aihl", ""
    if "KURAN" in d.replace("'", ""):
        m = re.search(r"KURAN(\d+)", d)
        return "kuran-i-kerim", m.group(1) if m else sinif_bul(baslik), "genel", ""
    if "TEMELDINIBILGILER" in d.replace("İ", "I"):
        seviye = "2" if "2" in d.split("ORTAO")[-1] else "1"
        return "temel-dini-bilgiler", "S", "genel", f"islam{seviye}"
    return None


# --------------------------------------------------------------------------- plan derleme
ESKI_PROGRAM_DERSLERI = {"aihl-kelam", "aihl-dinler-tarihi", "aihl-islam-kultur"}


def program_turu(p, did, sinif, ek):
    """'TYMM' (öğrenme çıktıları) ya da '2018' (kazanımlar; 2026-2027'de 12. sınıf ve bazı dersler)."""
    sutunlar = p["sutunlar"]
    if "yontem" in sutunlar:  # eski program şablonunda "Yöntem ve Teknikler" sütunu bulunur
        return "2018"
    if sinif == "12" or "ESKİ PROGRAM" in tr_upper(p["sayfa"]):
        return "2018"
    if did in ESKI_PROGRAM_DERSLERI or (did == "aihl-kuran" and sinif == "10"):
        return "2018"
    if did == "temel-dini-bilgiler" and ek == "islam2":
        return "2018"
    if did == "aihl-arapca" or (did == "aihl-mesleki-arapca" and sinif == "11"):
        return "TYMM"  # DÖGM: "Maarif Modeli" etiketli planlar (süreç sütunu yok)
    if "surec" not in sutunlar:
        return "2018"
    return "TYMM"


def tipik_saat(saatler):
    sayac = collections.Counter([s for s in saatler if s > 0])
    if not sayac:
        return 2
    return sayac.most_common(1)[0][0]


# Plan sonundaki imza / onay bloğu satırları ("ARAPÇA ÖĞRETMENİ", "U Y G U N D U R", "... / 09 / 2026", "OKUL MÜDÜRÜ",
# "…........" dolgu): hiçbir alana (konu, kazanım, belirli gün …) alınmaz
IMZA_SATIRI = re.compile(r"^(?:[….\s/0-9]*|.*\bÖĞRETMEN(?:İ|LERİ)|.*\bMÜDÜRÜ|ZÜMRE\b.*|U\s?Y\s?G\s?U\s?N\s?D\s?U\s?R|TASDİK OLUNUR)$")


def imza_satiri_mi(r):
    degerler = [v for k, v in r.items() if k in ("unite", "konu", "cikti", "surec", "olcme", "gunler")]
    return bool(degerler) and all(IMZA_SATIRI.match(tr_upper(bosluk(v))) for v in degerler)


def plan_derle(p, program, dil="tr"):
    uniteler, unite_idx = [], {}
    haftalar = []
    son_unite = None
    # Satırları tarihlerine göre resmî 37 haftaya yerleştir (dosyalardaki numaralandırma farklarına karşı)
    gruplar = collections.OrderedDict((i, []) for i in range(1, HAFTA_SAYISI + 1))
    for w in p["haftalar"]:
        no = resmi_hafta_no(w["tarih"], w["hafta"])
        if 1 <= no <= HAFTA_SAYISI:
            gruplar[no].extend(w["satirlar"])
    for no, satirlar in gruplar.items():
        w = {"hafta": no}
        saat = 0
        u_list, konular, ciktilar, davranis, olcme, gunler = [], [], [], [], [], []
        ozel = None
        for r in satirlar:
            if imza_satiri_mi(r):
                continue
            devam = set(r.get("_devam", []))
            sv = (r.get("saat") or "").strip()
            if re.fullmatch(r"[\d\s+]+", sv):
                if "saat" not in devam:
                    saat += sum(int(x) for x in re.findall(r"\d+", sv))
            elif ozel_hafta_turu(sv.rstrip("* ")) in ("OTP", "SE", "ZEN"):
                ozel = ozel or ozel_hafta_turu(sv.rstrip("* "))  # SAAT sütununda "OKUL TEMELLİ PLANLAMA*"
            elif "SOSYAL" in tr_upper(sv):
                ozel = "SE"
            # Hafta türü işareti ünite dışındaki bir sütuna yazılmış olabilir (ör. coğrafya 10. sınıf 18. hafta
            # süreç sütununda "OKUL TEMELLİ PLANLAMA*"): konu, kazanım ya da davranış olarak alınmaz.
            for alan in ("konu", "cikti", "surec"):
                v = (r.get(alan) or "").strip().rstrip("* ")
                if v and len(v) < 60 and ozel_hafta_turu(v) in ("OTP", "SE", "ZEN"):
                    ozel = ozel or ozel_hafta_turu(v)
                    r = {a: b for a, b in r.items() if a != alan}
            for un in unite_bol(r.get("unite", "")):
                tur = ozel_hafta_turu(un)
                if tur in ("OTP", "SE"):
                    ozel = ozel or tur
                    continue
                if tur == "ZEN":
                    ozel = ozel or "ZEN"
                    continue
                if tur == "DEG":
                    ozel = ozel or "DEG"
                un_n = unite_normalize(un)
                if r.get("unite_no") and not re.match(r"^\d", un_n):
                    un_n = f"Unit {r['unite_no'].strip()}: {un_n}"
                key = unite_anahtar(un_n)
                if not key or len(un_n) > 90:  # içerik metni yanlışlıkla ünite sütununa düşmüş
                    continue
                if key not in unite_idx:
                    unite_idx[key] = len(uniteler)
                    uniteler.append({"ad": un_n})
                if unite_idx[key] not in u_list:
                    u_list.append(unite_idx[key])
            if r.get("konu"):
                # Konu hücresindeki "ZENGİNLEŞTİRME:* …" öğretmen notu konu sayılmaz
                konu = r["konu"]
                m = NOT_BASLIGI.search(konu)
                kk = tirnak_dengele(kisa_konu(konu[:m.start()] if m else konu))
                if re.search(r"\bSuresi ve Anlam$", kk):  # kaynakta kesik: "“Enfal Suresi ve Anlam"
                    ONARIM_KAYDI[("kesik konu", kk, kk + "ı")] += 1
                    kk += "ı"
                if kk and kk not in konular:
                    konular.append(kk)
            if r.get("cikti"):
                for c in ciktilar_ayristir(r["cikti"]):
                    if c not in ciktilar:
                        ciktilar.append(c)
            if program == "TYMM" and r.get("surec"):
                for d in davranislar_tymm(r["surec"], dil):
                    if d not in davranis:
                        davranis.append(d)
            if r.get("olcme") and "olcme" not in devam:
                for a in olcme_araclari(r["olcme"]):
                    if a not in olcme:
                        olcme.append(a)
            if r.get("gunler") and "gunler" not in devam:
                for g in gunler_ayristir(r["gunler"]):
                    if g not in gunler:
                        gunler.append(g)
        if program != "TYMM":
            # davranislar_eski Türkçe "-r." sezgisine dayanır; İngilizce kazanımlara uygulanmaz
            davranis = davranislar_eski(ciktilar) if dil == "tr" else []
        bos = not satirlar
        if not u_list and son_unite is not None and ozel in (None, "ZEN", "DEG"):
            u_list = [son_unite]
        if u_list:
            son_unite = u_list[-1]
        if w["hafta"] == HAFTA_SAYISI and not (ciktilar or konular) and ozel != "OTP":
            ozel = "SE"  # kaynakta açıkça OTP yazılmamışsa 37. hafta sosyal etkinlik haftasıdır
        if bos and not ozel:
            ozel = "DEVAM"  # kaynak planda bu hafta için satır yok: önceki haftanın devamı
        hf = {"h": w["hafta"], "s": saat}
        if u_list:
            hf["u"] = u_list
        if konular:
            hf["k"] = " | ".join(konular[:2])
        if ciktilar:
            # İngilizce planlarda beceri başına madde imli kazanımların tümü tutulur (Listening … Writing);
            # uygulama ilk kazanımı gösterip "(+N … daha)" yazar
            hf["c"] = ciktilar if dil == "en" else ciktilar[:4]
        if davranis:
            hf["b"] = [kisalt(d, 190) for d in davranis[:5]]
        if olcme:
            hf["o"] = olcme[:6]
        if gunler:
            hf["g"] = gunler[:4]
        if ozel:
            hf["x"] = ozel
        haftalar.append(hf)
    return kesik_uniteleri_birlestir(*birlesik_uniteleri_ayir(uniteler, haftalar))


def birlesik_uniteleri_ayir(uniteler, haftalar):
    """Geçiş haftasında iki ünite adı aynı hücrede satır kırılımıyla yazıldığında ("TEPKİ\\n\\nHOME0STAZİ")
    unite_bol bunları tek ad sanıp yapay bir ünite ("TEPKİ HOMEOSTAZİ") oluşturur. Aynı plandaki iki başka
    ünitenin adlarının birleşimi olan üniteler kaldırılır; o haftalar iki üniteye birlikte bağlanır."""
    anahtarlar = [unite_anahtar(u["ad"]) for u in uniteler]
    eslem = {}
    for i, k in enumerate(anahtarlar):
        for a, ka in enumerate(anahtarlar):
            for b, kb in enumerate(anahtarlar):
                if len({i, a, b}) == 3 and ka and kb and k == ka + kb:
                    eslem[i] = [a, b]
    eslem = {i: ab for i, ab in eslem.items() if not set(ab) & set(eslem)}
    if not eslem:
        return uniteler, haftalar
    yeni_idx, yeni_uniteler = {}, []
    for i, u in enumerate(uniteler):
        if i not in eslem:
            yeni_idx[i] = len(yeni_uniteler)
            yeni_uniteler.append(u)
    for hf in haftalar:
        if "u" in hf:
            ul = []
            for i in hf["u"]:
                for j in eslem.get(i, [i]):
                    if yeni_idx[j] not in ul:
                        ul.append(yeni_idx[j])
            hf["u"] = ul
    for i, (a, b) in eslem.items():
        ONARIM_KAYDI[("birleşik ünite adı", uniteler[i]["ad"], uniteler[a]["ad"] + " + " + uniteler[b]["ad"])] += 1
    return yeni_uniteler, haftalar


def _unite_no(ad):
    """'2. ÜNİTE: …' -> '2', 'KK.10.3. …' -> '3' (kod önekinin son bölümü)."""
    m = re.match(r"^(\d+)\.", ad) or re.match(r"^(?:[A-ZÇĞİÖŞÜ]{1,6}\.)+(?:\d+\.)*(\d+)\.?\s", ad)
    return m.group(1) if m else None


def _kod_onekini_sil(ad):
    return re.sub(r"^(?:[A-ZÇĞİÖŞÜ]{1,6}\.)+(?:\d+\.)+\s*", "", ad)


def kesik_uniteleri_birlestir(uniteler, haftalar):
    """Kaynakta aynı ünitenin kesik ("… VE SOSYOLOJ", "… ÇÖZÜLM", "GÖÇ OLGUSUNU ANLAMA") ya da kod önekli
    ("KK.10.3. YÜZÜNDEN …") yazılmış kopyaları ayrı ünite olmasın: aynı numaralı asıl üniteye eşlenir. Asıl ünite
    adı, kod öneki atılınca kopyanın adıyla aynı olan ya da kopyanın adı kendisinin (son sözcükte en çok 3 harf
    eksik) öneki olan ünitedir. Birleşen ünite ilk göründüğü sırada, asıl adıyla kalır."""
    anahtarlar = [unite_anahtar(_kod_onekini_sil(u["ad"])) for u in uniteler]
    eslem = {}  # kopya -> asıl
    for i, ki in enumerate(anahtarlar):
        for j, kj in enumerate(anahtarlar):
            if i == j or i in eslem or j in eslem or not ki or not kj:
                continue
            no_i, no_j = _unite_no(uniteler[i]["ad"]), _unite_no(uniteler[j]["ad"])
            if not no_i or no_i != no_j:
                continue
            kodlu = ki == kj and _kod_onekini_sil(uniteler[i]["ad"]) != uniteler[i]["ad"]
            kesik = kj.startswith(ki) and 0 < len(kj) - len(ki) <= 3
            if kodlu or kesik:
                eslem[i] = j
    if not eslem:
        return uniteler, haftalar
    hedef = {}  # her ünitenin kalacağı eski indeks (çiftin küçük indeksi)
    for i, j in eslem.items():
        k = min(i, j)
        ONARIM_KAYDI[("kesik/kodlu ünite kopyası", uniteler[i]["ad"], uniteler[j]["ad"])] += 1
        uniteler[k] = dict(uniteler[k], ad=uniteler[j]["ad"])
        hedef[i], hedef[j] = k, k
    yeni_idx, yeni_uniteler = {}, []
    for i, u in enumerate(uniteler):
        if hedef.get(i, i) == i:
            yeni_idx[i] = len(yeni_uniteler)
            yeni_uniteler.append(u)
    for hf in haftalar:
        if "u" in hf:
            ul = []
            for i in hf["u"]:
                j = yeni_idx[hedef.get(i, i)]
                if j not in ul:
                    ul.append(j)
            hf["u"] = ul
    return yeni_uniteler, haftalar


def tymm_destek_ekle(uniteler, tymm, slug, sinif):
    if not slug:
        return
    kayit = tymm.get(f"{slug}|{sinif}")
    if not kayit:
        return
    tu = kayit["uniteler"]
    for i, u in enumerate(uniteler):
        k = unite_anahtar(u["ad"])
        eslesen = None
        for t in tu:
            tk = unite_anahtar(t["baslik"])
            if tk and (tk in k or k in tk):
                eslesen = t
                break
        if eslesen is None and len(tu) == len(uniteler):
            eslesen = tu[i]
        if eslesen:
            if eslesen.get("destekleme"):
                u["destek"] = kisalt(eslesen["destekleme"], 600)
            saat = re.sub(r"\D", "", eslesen.get("Ders Saati", "") or "")
            if saat:
                u["saat"] = int(saat)


# --------------------------------------------------------------------------- yalnız TYMM ünite verisi olan dersler
def kanonik_gunler(planlar_ham):
    sayac = collections.defaultdict(collections.Counter)
    for p in planlar_ham:
        if p["kaynak"] != "ogm":
            continue
        for w in p["haftalar"]:
            for r in w["satirlar"]:
                if r.get("gunler") and "gunler" not in r.get("_devam", []):
                    for g in gunler_ayristir(r["gunler"]):
                        sayac[w["hafta"]][g] += 1
    sonuc = {}
    for h, c in sayac.items():
        if not c:
            continue
        esik = max(3, c.most_common(1)[0][1] * 0.35)
        sonuc[h] = [g for g, n in c.most_common() if n >= esik][:3]
    return sonuc


def icerik_basliklari(metin, hedef):
    """TYMM "İçerik Çerçevesi" metnini konu başlıklarına (isim öbeklerine) ayırır. Kaynakta başlıklar kimi zaman
    alt satıra kaydırılmış ("Bilimsel Düşüncenin\nGelişiminde Astronominin Rolü"), kimi zaman da aynı satıra bitişik
    yazılmıştır ("… Empati Kurma Çevre Sorunlarına …", "… Uzaklıklar Gezegenlerin Çekim Kuvveti"). Başlık sayısı
    ünitenin öğrenme çıktısı sayısına (hedef) eşit olmalıdır; sırasıyla ham satırlar, kaydırılmış satırları
    birleştirilmiş hâli ve bunların bitişik başlıkları ayrılmış hâlleri denenir, hedefi tutan ilk biçim alınır."""
    ham = [bosluk(l) for l in nfc(metin).split("\n") if bosluk(l)]
    birlesik = []
    for l in ham:
        if birlesik and satir_devami_mi(birlesik[-1], l):
            birlesik[-1] += " " + l
        else:
            birlesik.append(l)

    def ayir(satirlar):
        # Satırın ilk sözcüğüyle aynı kökle (ilk 5 harf) başlayan büyük harfli sözcük yeni bir başlıktır.
        yeni = []
        for l in satirlar:
            kelimeler = l.split(" ")
            kok = tr_lower(re.sub(r"\W", "", kelimeler[0]))[:5]
            parca = [kelimeler[0]]
            for onceki, w in zip(kelimeler, kelimeler[1:]):
                if (len(kok) == 5 and tr_lower(re.sub(r"\W", "", w))[:5] == kok and w[:1].isupper()
                        and not DEVAM_EDEN_SON.search(onceki)):
                    yeni.append(" ".join(parca))
                    parca = [w]
                else:
                    parca.append(w)
            yeni.append(" ".join(parca))
        return yeni

    secilen = birlesik
    if hedef:
        for aday in (ham, birlesik, ayir(birlesik), ayir(ham)):
            if len(aday) == hedef:
                secilen = aday
                break
    return [l.strip(" ;,.") for l in secilen if l.strip(" ;,.")]


def tymm_dagit(kayit, gun_haritasi):
    uniteler = []
    toplam = 0
    for t in kayit["uniteler"]:
        saat = int(re.sub(r"\D", "", t.get("Ders Saati", "") or "0") or 0)
        toplam += saat
        u = {"ad": t["baslik"]}
        if t.get("destekleme"):
            u["destek"] = kisalt(t["destekleme"], 600)
        if saat:
            u["saat"] = saat
        uniteler.append((u, t, saat))
    n = len(uniteler)
    if n == 0:
        return None
    if toplam == 0:
        toplam = n
        uniteler = [(u, t, 1) for u, t, _ in uniteler]
    haftalik = max(1, round(toplam / 34))
    # 36 öğretim haftasını ünite saatleriyle orantılı paylaştır
    paylar = [s / toplam * 36 for _, _, s in uniteler]
    tam = [max(1, int(x)) for x in paylar]
    while sum(tam) < 36:
        i = max(range(n), key=lambda j: paylar[j] - tam[j])
        tam[i] += 1
    while sum(tam) > 36:
        i = max(range(n), key=lambda j: (tam[j] - paylar[j]) if tam[j] > 1 else -99)
        tam[i] -= 1
    haftalar = []
    h = 1
    for ui, ((u, t, _), adet) in enumerate(zip(uniteler, tam)):
        oc = t.get("Öğrenme Çıktıları ve Süreç Bileşenleri") or []
        icerik = icerik_basliklari(t.get("İçerik Çerçevesi") or "", len(oc))
        araclar = olcme_araclari(t.get("olcme", ""))
        for j in range(adet):
            hf = {"h": h, "s": haftalik, "u": [ui]}
            if oc:
                a = j * len(oc) // adet
                b = max(a + 1, (j + 1) * len(oc) // adet)
                secilen = oc[a:b]
                hf["c"] = []
                davr = []
                for o in secilen:
                    kod, metin = kod_ayir(o["cikti"])
                    surec = list(o.get("surec", []))
                    if len(metin.strip(" .")) < 4 and surec and not re.match(r"^[a-zçğıöşü]\)", surec[0]):
                        metin = surec.pop(0)  # çıktı metni <strong> dışında kalmış
                    hf["c"].append([(kod or "").rstrip("."), bosluk(metin).strip(" .;:,")])
                    # Kaynakta tek maddede birleşmiş süreç bileşenleri: "… dönüştürür. c) Bilim insanları …"
                    surec = [p for s in surec for p in madde_bol(r"\s+(?=[a-zçğıöşü]\)\s)", s) if p.strip()]
                    for s in surec:
                        s2 = re.sub(r"^[a-zçğıöşü]\)\s*", "", s)
                        s2 = cumle(s2)
                        if s2 not in davr:
                            davr.append(s2)
                if davr:
                    hf["b"] = [kisalt(d, 190) for d in davr[:5]]
            # Hafta konusu (k) uygulamada "X konusundaki …" şablonlarında isim öbeği olarak kullanılır; bu yüzden
            # öğrenme çıktısı cümlesinden değil, TYMM "İçerik Çerçevesi" başlıklarından alınır. Başlık sayısı öğrenme
            # çıktısı sayısına eşitse haftanın ilk çıktısına karşılık gelen başlık, değilse orantılı başlık seçilir.
            if icerik:
                if oc and len(icerik) == len(oc):
                    a = j * len(oc) // adet
                else:
                    a = min(j * len(icerik) // adet, len(icerik) - 1)
                hf["k"] = icerik[a]
            else:
                hf["k"] = ""
            if araclar:
                hf["o"] = araclar[:6]
            if gun_haritasi.get(h):
                hf["g"] = gun_haritasi[h]
            haftalar.append(hf)
            h += 1
    haftalar.append({"h": HAFTA_SAYISI, "s": 0, "x": "SE", **({"g": gun_haritasi[HAFTA_SAYISI]} if gun_haritasi.get(HAFTA_SAYISI) else {})})
    return uniteler, haftalar, haftalik


# --------------------------------------------------------------------------- ana akış
def main():
    ham = json.load(open(os.path.join(ARA, "planlar_ham.json"), encoding="utf-8"))
    tymm = json.load(open(os.path.join(KOK, "kaynaklar", "tymm", "tymm_uniteler.json"), encoding="utf-8"))
    # Ham hücre onarımı (tireleme, bitişik yazım, CSV tırnakları): önce derlem sözlüğü, sonra tüm metin hücreleri
    hucreler = [v for p in ham for w in p["haftalar"] for r in w["satirlar"] for k, v in r.items() if k != "_devam"]

    def tymm_metinleri(o):
        if isinstance(o, dict):
            return [x for v in o.values() for x in tymm_metinleri(v)]
        if isinstance(o, list):
            return [x for v in o for x in tymm_metinleri(v)]
        return [o] if isinstance(o, str) else []

    def tymm_onar(o):
        if isinstance(o, dict):
            return {k: tymm_onar(v) for k, v in o.items()}
        if isinstance(o, list):
            return [tymm_onar(v) for v in o]
        return ham_onar(o) if isinstance(o, str) else o

    sozluk_kur(pua_onar(nfc(s)) for s in hucreler + tymm_metinleri(tymm))
    for p in ham:
        for w in p["haftalar"]:
            w["satirlar"] = [{k: (v if k == "_devam" else ham_onar(v)) for k, v in r.items()} for r in w["satirlar"]]
    tymm = {k: dict(v, uniteler=tymm_onar(v["uniteler"])) for k, v in tymm.items()}
    dersler = {}
    atlanan = []
    for p in ham:
        kim = kimlik(p)
        if not kim:
            atlanan.append((p["dosya"], p["sayfa"]))
            continue
        did, sinif, okul, ek = kim
        if did not in DERSLER or not sinif:
            atlanan.append((p["dosya"], p["sayfa"], did, sinif))
            continue
        if not p["haftalar"]:
            atlanan.append((p["dosya"], p["sayfa"], "hafta yok"))
            continue
        program = program_turu(p, did, sinif, ek)
        uniteler, haftalar = plan_derle(p, program, "en" if did == "ingilizce" else "tr")
        ad, grup, slug = DERSLER[did]
        if did == "ingilizce" and okul == "hazirlikli":
            slug = "ingilizce-dersi-hazirlik-12"
        if program == "TYMM":
            tymm_destek_ekle(uniteler, tymm, slug, sinif if sinif != "S" else "S")
        saat = tipik_saat([h["s"] for h in haftalar if h["h"] < HAFTA_SAYISI])
        plan_id = "-".join(x for x in (okul, sinif, ek) if x)
        kaynak = ("MEB OGM 2026-2027 Taslak Çerçeve Yıllık Planı" if p["kaynak"] == "ogm" else "MEB DÖGM 2026-2027 Çerçeve Yıllık Planı")
        etiket_ek = ""
        if ek.endswith("s") and ek[:-1].isdigit():
            etiket_ek = f" – haftalık {ek[:-1]} saatlik plan"
        elif ek.startswith("sbc"):
            etiket_ek = f" – Sosyal Bilim Çalışmaları {ek[3:]}"
        elif ek.startswith("islam"):
            etiket_ek = f" – İslam {ek[5:]}"
        plan = {
            "id": plan_id, "sinif": sinif, "okul": okul,
            "etiket": OKUL_ETIKET[okul] + etiket_ek,
            "program": program, "saat": saat,
            "kaynak": f"{kaynak} ({'tymm.meb.gov.tr' if p['kaynak'] == 'ogm' else 'dogm.meb.gov.tr'} – {p['dosya']}{' / ' + p['sayfa'] if p['sayfa'] else ''})",
            "uniteler": uniteler, "haftalar": haftalar,
        }
        d = dersler.setdefault(did, {"id": did, "ad": ad, "grup": grup, "planlar": []})
        if any(x["id"] == plan_id for x in d["planlar"]):
            plan_id += "-b"
            plan["id"] = plan_id
        d["planlar"].append(plan)

    # Yalnız TYMM ünite verisi olan dersler (haftalık plan yayımlanmamış seçmeli dersler)
    gun_haritasi = kanonik_gunler(ham)
    ekler = [
        ("astronomi", "astronomi-ve-uzay-bilimleri-dersi|S", "S"),
        ("cagdas-turk-dunya-tarihi", "cagdas-turk-ve-dunya-tarihi-dersi|S", "S"),
        ("demokrasi-insan-haklari", "demokrasi-ve-insan-haklari-dersi|S", "S"),
        ("iklim-cevre", "iklim-cevre-ve-yenilikci-cozumler-dersi|S", "S"),
        ("islam-bilim-tarihi", "islam-bilim-tarihi-dersi|S", "S"),
        ("turk-kultur-medeniyet-tarihi", "turk-kultur-ve-medeniyet-tarihi-dersi|S", "S"),
        ("matematik-uygulamalari", "matematik-uygulamalari-dersi|11", "11"),
    ]
    for did, anahtar, sinif in ekler:
        kayit = tymm.get(anahtar)
        if not kayit:
            print("TYMM kaydı yok:", anahtar)
            continue
        sonuc = tymm_dagit(kayit, gun_haritasi)
        if not sonuc:
            continue
        uniteler, haftalar, haftalik = sonuc
        ad, grup, slug = DERSLER[did]
        plan = {
            "id": f"genel-{sinif}", "sinif": sinif, "okul": "genel", "etiket": OKUL_ETIKET["genel"],
            "program": "TYMM", "saat": haftalik, "dagitim": "otomatik",
            "kaynak": f"MEB TYMM Öğretim Programı (tymm.meb.gov.tr/ogretim-programlari/ders/{slug} – haftalık dağılım ünite ders saatlerine göre orantılı yapılmıştır)",
            "uniteler": [u for u, _, _ in uniteler], "haftalar": haftalar,
        }
        dersler.setdefault(did, {"id": did, "ad": ad, "grup": grup, "planlar": []})["planlar"].append(plan)

    # sıralama
    sira = list(DERSLER.keys())
    sinif_sira = {"H": 0, "9": 1, "10": 2, "11": 3, "12": 4, "S": 5}
    okul_sira = {"genel": 0, "anadolu": 1, "hazirliksiz": 1, "fen": 2, "sosyal": 3, "hazirlikli": 4, "aihl": 5}
    liste = []
    for did in sira:
        if did not in dersler:
            continue
        d = dersler[did]
        d["planlar"].sort(key=lambda p: (sinif_sira.get(p["sinif"], 9), okul_sira.get(p["okul"], 9), p["id"]))
        # Okul türleri arasında birebir aynı olan planları tekrar saklama (uygulama "ayni" alanını çözer)
        imzalar = {}
        for p in d["planlar"]:
            imza = json.dumps([p["uniteler"], p["haftalar"]], ensure_ascii=False, sort_keys=True)
            if imza in imzalar:
                p["ayni"] = imzalar[imza]
                del p["uniteler"], p["haftalar"]
            else:
                imzalar[imza] = p["id"]
        liste.append(d)

    meta = {
        "egitimYili": "2026-2027",
        "olusturma": "2026-10-04",
        "kaynaklar": [
            {"ad": "MEB OGM – TYMM 2026-2027 Ortaöğretim Taslak Çerçeve Yıllık Planları", "url": "https://tymm.meb.gov.tr/taslak-cerceve-planlari/ortaogretim"},
            {"ad": "MEB DÖGM – 2026-2027 Çerçeve Yıllık Planlar", "url": "https://dogm.meb.gov.tr/www/cerceve-yillik-planlar/icerik/2257"},
            {"ad": "MEB TYMM Öğretim Programları (ünite sayfaları)", "url": "https://tymm.meb.gov.tr/ogretim-programlari"},
        ],
    }
    os.makedirs(CIKTI, exist_ok=True)
    veri = {"meta": meta, "dersler": liste}
    js = "/* Otomatik üretilmiştir: tools/veri_olustur.py — elle düzenlemeyin. */\nwindow.BEP_VERI = " + json.dumps(veri, ensure_ascii=False, separators=(",", ":")) + ";\n"
    with open(os.path.join(CIKTI, "dersler.js"), "w", encoding="utf-8") as fh:
        fh.write(js)
    toplam_plan = sum(len(d["planlar"]) for d in liste)
    print(f"Ders: {len(liste)}  Plan: {toplam_plan}  Boyut: {len(js.encode('utf-8'))/1e6:.2f} MB")
    for d in liste:
        print(f"  {d['ad'][:44]:44} " + ", ".join(f"{p['sinif']}/{p['okul']}{'(' + p['id'] + ')' if p['id'].count('-') > 1 else ''}:{p['program'][0]}{p['saat']}" for p in d["planlar"]))
    if atlanan:
        print("Atlanan:", atlanan)
    if ONARIM_KAYDI:
        print("Ham metin onarımları (tür: önce -> sonra ×adet):")
        for (tur, once, sonra), n in sorted(ONARIM_KAYDI.items()):
            print(f"  {tur}: {once} -> {sonra} ×{n}")


if __name__ == "__main__":
    main()
