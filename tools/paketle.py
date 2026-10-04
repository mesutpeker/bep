#!/usr/bin/env python3
"""
Uygulamayı tek bir HTML dosyasında paketler (internet ve kurulum gerektirmez).

Girdi : index.html + src/css/*.css + src/js/*.js + data/dersler.js
Çıktı : BEP_Hazirlama_Uygulamasi.html

Ayrıca index.html'deki ?v=... sürüm eklerini dosya içeriklerinin özetiyle
günceller; böylece web sürümünde tarayıcılar eski önbellekli JS/CSS
dosyalarını yeni sayfayla karıştırmaz.
"""
import hashlib
import os
import re

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CIKTI = os.path.join(KOK, "BEP_Hazirlama_Uygulamasi.html")


def oku(yol):
    with open(os.path.join(KOK, yol), encoding="utf-8") as f:
        return f.read()


def guvenli_script(metin):
    # Gömülü içerikte "</script" dizisi HTML ayrıştırıcıyı erken kapatmasın
    return metin.replace("</script", "<\\/script").replace("<!--", "<\\!--")


VARLIK = r'(<link rel="stylesheet" href="|<script src=")([^"?]+)(?:\?v=[^"]*)?"'


def surum_guncelle():
    """index.html'deki yerel CSS/JS bağlantılarına içerik özetinden ?v= ekler."""
    html = oku("index.html")
    ozet = hashlib.sha1()
    for m in re.finditer(VARLIK, html):
        ozet.update(oku(m.group(2)).encode("utf-8"))
    surum = ozet.hexdigest()[:10]
    yeni = re.sub(VARLIK, lambda m: m.group(1) + m.group(2) + "?v=" + surum + '"', html)
    if yeni != html:
        with open(os.path.join(KOK, "index.html"), "w", encoding="utf-8") as f:
            f.write(yeni)
    return surum


def main():
    print("Web sürümü önbellek anahtarı:", surum_guncelle())
    html = oku("index.html")

    def css_yerlestir(m):
        return "<style>\n" + oku(m.group(1)) + "\n</style>"

    def js_yerlestir(m):
        return "<script>\n/* " + m.group(1) + " */\n" + guvenli_script(oku(m.group(1))) + "\n</script>"

    html = re.sub(r'<link rel="stylesheet" href="([^"?]+)(?:\?v=[^"]*)?">', css_yerlestir, html)
    html = re.sub(r'<script src="([^"?]+)(?:\?v=[^"]*)?"></script>', js_yerlestir, html)
    html = html.replace("<!--GOVDE-BASI-->", "").replace("<!--GOVDE-SONU-->", "")
    with open(CIKTI, "w", encoding="utf-8") as f:
        f.write(html)
    print("Paket oluşturuldu:", CIKTI, f"({os.path.getsize(CIKTI) / 1e6:.2f} MB)")


if __name__ == "__main__":
    main()
