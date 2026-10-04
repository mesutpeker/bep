#!/usr/bin/env python3
"""
Uygulamayı tek bir HTML dosyasında paketler (internet ve kurulum gerektirmez).

Girdi : index.html + src/css/*.css + src/js/*.js + data/dersler.js
Çıktı : BEP_Hazirlama_Uygulamasi.html
"""
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


def main():
    html = oku("index.html")

    def css_yerlestir(m):
        return "<style>\n" + oku(m.group(1)) + "\n</style>"

    def js_yerlestir(m):
        return "<script>\n/* " + m.group(1) + " */\n" + guvenli_script(oku(m.group(1))) + "\n</script>"

    html = re.sub(r'<link rel="stylesheet" href="([^"]+)">', css_yerlestir, html)
    html = re.sub(r'<script src="([^"]+)"></script>', js_yerlestir, html)
    html = html.replace("<!--GOVDE-BASI-->", "").replace("<!--GOVDE-SONU-->", "")
    with open(CIKTI, "w", encoding="utf-8") as f:
        f.write(html)
    print("Paket oluşturuldu:", CIKTI, f"({os.path.getsize(CIKTI) / 1e6:.2f} MB)")


if __name__ == "__main__":
    main()
