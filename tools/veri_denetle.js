#!/usr/bin/env node
/* Ders verisindeki (data/dersler.js) ayrıştırma artıklarını denetler (geliştirici aracı, bağımlılıksız).
 *
 * Çalıştırma:  node tools/veri_denetle.js [dersler.js yolu]      (ORNEK=20 ile sınıf başına daha çok örnek)
 * Her artık sınıfı için sayı ve ilk birkaç örnek yazılır; herhangi bir ihlal varsa çıkış kodu 1'dir.
 *
 * Denetlenen artık sınıfları (bkz. tools/veri_olustur.py):
 *   yil-kod-yutma      "TAR.10.2.2. 1299-1453 …" -> kod "TAR.10.2.2.1299" (kod bölümünde 3+ basamak)
 *   numara-oneki       "1.Peygamberi sevmenin …" (metin başında / içinde boşluksuz madde numarası)
 *   gomulu-kod         metin içinde kazanım kodu ("… açıklar. 12.4.2.1.. Büyük patlama …", "MAT.U.1.5.1.Türk …")
 *   eksik-bosluk       "SayılardaTanımlı" (istisnalar: GeoGebra, PhET, YouTube, iPad …)
 *   tireleme           satır sonu tirelemesi artığı ("kul-lanacağını", "ana- litik")
 *   birlesik-unite     iki ünite adının birleşiminden oluşmuş yapay ünite ("TEPKİ HOMEOSTAZİ")
 *   oto-konu           otomatik dağıtılan planlarda konu (k) yerine yeterlilik cümlesi / kesik ("…") konu
 *   bas-tire           "-1945 yılları …" gibi tireyle başlayan kazanım/davranış
 *   iki-nokta          "açıklar.." (üç nokta hariç)
 *   cift-bosluk        metinde iki ya da daha çok ardışık boşluk
 *   dolgu              harf içermeyen kazanım ("….........")
 *   baslik-sizintisi   kazanım sonuna eklenmiş beceri başlığı ("… tanır. KONUŞMA")
 *   hafta-turu-artigi  davranış/kazanım olarak alınmış hafta türü ("OKUL TEMELLİ PLANLAMA.")
 *   csv-tirnak         hücre başında kalmış CSV kaçış tırnağı ('"ENG.9.2.L1…', '""…""')
 *   birlesik-madde     tek davranışta birleşmiş süreç bileşenleri ("… yapar. c) …", "… seçer.b) …")
 */
"use strict";
var path = require("path");
global.window = globalThis;
var yol = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, "..", "data", "dersler.js");
require(yol);
var VERI = globalThis.BEP_VERI;
if (!VERI || !VERI.dersler) { console.error("BEP_VERI yüklenemedi: " + yol); process.exit(2); }

var ORNEK_SAYISI = +process.env.ORNEK || 4;
var SINIFLAR = [
  "yil-kod-yutma", "numara-oneki", "gomulu-kod", "eksik-bosluk", "tireleme", "birlesik-unite", "oto-konu",
  "bas-tire", "iki-nokta", "cift-bosluk", "dolgu", "baslik-sizintisi", "hafta-turu-artigi", "csv-tirnak", "birlesik-madde"
];
var bulgular = {};
SINIFLAR.forEach(function (s) { bulgular[s] = []; });
function ekle(sinif, yer, metin) { bulgular[sinif].push(yer + "  " + JSON.stringify(String(metin).slice(0, 140))); }

var BUYUK = "A-ZÇĞİÖŞÜÂÎÛ", KUCUK = "a-zçğıöşüâîû", HARF = "A-Za-zÇĞİÖŞÜçğıöşüâîûÂÎÛ";
function trKucuk(s) { return String(s).replace(/I/g, "ı").replace(/İ/g, "i").toLowerCase(); }
function trBuyuk(s) { return String(s).replace(/i/g, "İ").replace(/ı/g, "I").toUpperCase(); }

// Büyük-küçük harf geçişi meşru olan yazımlar
var BITISIK_ISTISNA = ["GeoGebra", "PhET", "YouTube", "PowerPoint", "JavaScript", "iPad", "iPhone", "iOS", "HeLa",
  "ReactionDataExtractor", "DesJardins", "LaTeX", "WhatsApp", "LinkedIn", "TikTok", "ChatGPT", "OpenAI", "GitHub",
  "WordPress", "OneNote", "SketchUp", "AutoCAD", "NetLogo", "MacBook", "McDonald", "PhD", "DeepMind", "SolidWorks",
  "LibreOffice", "OpenOffice", "QuickTime", "PubMed", "BioRender", "LearningApps", "WordWall", "StoryJumper",
  "MindMeister", "TinkerCad", "eTwinning", "eKitap"];

// Kazanım kodu biçimleri (metin içinde aranır)
var HARFLI_KOD = new RegExp("(?:^|[\\s\"“(])((?:[" + BUYUK + "]\\.)?[" + BUYUK + "]{2,6}(?:\\d{1,2}(?:\\.\\d{1,2})+|\\d{0,2}\\.(?:[" + BUYUK + "]{1,4}\\.)*\\d{1,2}(?:\\.(?:\\d{1,2}|[A-Z]\\d{1,2}))+))\\.?(?=[\\s" + HARF + "]|$)");
var SAYISAL_KOD = /(?:^|\s)(\d{1,2}(?:\.\d{1,2}){2,})\.*(?=\s|$)/;
var SAYI_HARF_KOD = new RegExp("^\\d{1,2}\\.[" + BUYUK + "]\\.\\d{1,2}\\.?\\s");

// Derlem sözlüğü (tireleme denetimi için): verideki bağımsız sözcüklerin ve tireli yazımların sıklığı
var sozluk = {}, tireli = {};
function sozlugeEkle(s) {
  (String(s).match(new RegExp("(?:^|[^\\w’'\\-" + HARF + "])([" + HARF + "]+)(?=$|[^\\w\\-" + HARF + "])", "g")) || []).forEach(function (m) {
    var w = trKucuk(m.replace(new RegExp("^[^" + HARF + "]+"), ""));
    sozluk[w] = (sozluk[w] || 0) + 1;
  });
  (String(s).match(new RegExp("[" + HARF + "]+-[" + HARF + "]+", "g")) || []).forEach(function (m) {
    tireli[trKucuk(m)] = (tireli[trKucuk(m)] || 0) + 1;
  });
}

function planlar(cb) {
  VERI.dersler.forEach(function (d) { d.planlar.forEach(function (p) { if (p.haftalar) cb(d, p); }); });
}
function metinler(h) {
  var out = [];
  (h.c || []).forEach(function (c) { out.push(["c", c[1]]); });
  (h.b || []).forEach(function (b) { out.push(["b", b]); });
  if (h.k) out.push(["k", h.k]);
  return out;
}

// 1. geçiş: sözlük
planlar(function (d, p) {
  p.uniteler.forEach(function (u) { sozlugeEkle(u.ad); if (u.destek) sozlugeEkle(u.destek); });
  p.haftalar.forEach(function (h) { metinler(h).forEach(function (m) { sozlugeEkle(m[1]); }); });
});

function uniteAnahtar(ad) {
  var s = trBuyuk(ad).replace(/^\d+(\.\d+)?\.\s*(TEMA|ÜNİTE)?\s*:?\s*/, "");
  return s.replace(/[^A-ZÇĞİÖŞÜ0-9]/g, "");
}
function baslikDuzeniMi(s) {
  var k = String(s).split(/\s+/).filter(function (w) { return new RegExp("^[" + HARF + "]").test(w) && w.length > 3; });
  var b = k.filter(function (w) { return new RegExp("^[" + BUYUK + "]").test(w); }).length;
  return k.length > 0 && b / k.length >= 0.6;
}

// 2. geçiş: denetimler
planlar(function (d, p) {
  var pyer = d.id + "/" + p.id;

  // birleşik ünite adı
  var anahtarlar = p.uniteler.map(function (u) { return uniteAnahtar(u.ad); });
  anahtarlar.forEach(function (k, i) {
    anahtarlar.forEach(function (ka, a) {
      anahtarlar.forEach(function (kb, b) {
        if (i !== a && i !== b && a !== b && ka && kb && k === ka + kb) ekle("birlesik-unite", pyer, p.uniteler[i].ad + " = " + p.uniteler[a].ad + " + " + p.uniteler[b].ad);
      });
    });
  });

  var alanlar = p.uniteler.map(function (u) { return ["ünite", u.ad]; });
  p.uniteler.forEach(function (u) { if (u.destek) alanlar.push(["destek", u.destek]); });
  alanlar.forEach(function (m) {
    eksikBosluk(pyer + " " + m[0], m[1]);
    if (/ {2,}/.test(m[1])) ekle("cift-bosluk", pyer + " " + m[0], m[1]);
  });

  p.haftalar.forEach(function (h) {
    var yer = pyer + " h" + h.h;
    (h.c || []).forEach(function (c) {
      if (/\d{3,}/.test(c[0])) ekle("yil-kod-yutma", yer, c[0] + " | " + c[1]);
      if (!new RegExp("[" + HARF + "]").test(c[1])) ekle("dolgu", yer, c[1]);
    });
    metinler(h).forEach(function (m) {
      var alan = m[0], t = String(m[1]), y = yer + " " + alan;
      // Boşluksuz madde/kod numarası her alanda artıktır: "1.Peygamberi …", "Kötülük Problemi 2.11.Sahte …"
      var bitisikNumara = /(?:^|\s)\d{1,2}(?:\.\d{1,2})*\.[A-ZÇĞİÖŞÜ][a-zçğıöşü]/.test(t);
      if (alan === "k" && bitisikNumara) ekle("numara-oneki", y, t);
      if (alan !== "k") {
        if (bitisikNumara || (/^\d{1,2}\.\s*(?=[A-ZÇĞİÖŞÜa-zçğıöşü])/.test(t) && !/^\d{1,2}\.\s+[a-zçğıöşü]/.test(t))) ekle("numara-oneki", y, t);
        else if (/(?:[.!?])\s+\d{1,2}\.(?=[A-ZÇĞİÖŞÜ])/.test(t)) ekle("numara-oneki", y, t);
        if (/^\s*[-–]/.test(t)) ekle("bas-tire", y, t);
        if (new RegExp("[.!?]\\s+[" + BUYUK + "][" + BUYUK + "/\\- ]{3,}\\.?$").test(t)) ekle("baslik-sizintisi", y, t);
        if (/OKUL TEMELLİ PLANLAMA|SOSYAL ETKİNLİK/.test(trBuyuk(t)) && !h.x) ekle("hafta-turu-artigi", y, t);
        if (/[.!?;][a-zçğıöşü]\)\s?[A-ZÇĞİÖŞÜa-zçğıöşü]|\s[a-zçğıöşü]\)\s+[A-ZÇĞİÖŞÜ]/.test(t)) ekle("birlesik-madde", y, t);
      }
      if (HARFLI_KOD.test(t) || SAYISAL_KOD.test(t) || SAYI_HARF_KOD.test(t)) ekle("gomulu-kod", y, t);
      eksikBosluk(y, t);
      tireleme(y, t);
      if (/(^|[^.…])\.\.(?![.…])/.test(t)) ekle("iki-nokta", y, t);
      if (/ {2,}/.test(t)) ekle("cift-bosluk", y, t);
      // CSV kaçışı: çift tırnak kaçışı, kod önünde kalmış tırnak ya da kazanım/davranış başında eşi olmayan tırnak.
      // Konu (k) alanındaki, kaynakta açılışı " kapanışı '' olan alt tema tırnakları bu sınıfa girmez.
      if (/""/.test(t) || new RegExp("^\"(?:[" + BUYUK + "]{2,6}[.\\d]|\\s)").test(t) ||
          (alan !== "k" && /^"/.test(t) && (t.match(/"/g) || []).length % 2 === 1)) ekle("csv-tirnak", y, t);
    });

    // otomatik dağıtılan planlarda hafta konusu bir isim öbeği olmalı
    if (p.dagitim === "otomatik" && h.k) {
      var k = String(h.k);
      var cumle = (h.c || []).some(function (c) { return c[1] && (k === c[1] || (/…$/.test(k) && c[1].indexOf(k.replace(/…$/, "")) === 0)); });
      if (/…$/.test(k)) ekle("oto-konu", yer + " k", k + "  [kesik]");
      else if (cumle) ekle("oto-konu", yer + " k", k + "  [öğrenme çıktısı cümlesi]");
      else if (/(?:ebilme|abilme)\.?$/.test(k) && !baslikDuzeniMi(k)) ekle("oto-konu", yer + " k", k + "  [yeterlilik ifadesi]");
      else if (HARFLI_KOD.test(k)) ekle("oto-konu", yer + " k", k + "  [kod]");
    }
  });
});

function eksikBosluk(yer, t) {
  (String(t).match(new RegExp("(?:^|[^\\w/.@#:" + HARF + "])[" + HARF + "]+(?![\\w/@" + HARF + "])", "g")) || []).forEach(function (m) {
    var w = m.replace(new RegExp("^[^" + HARF + "]+"), "");
    if (BITISIK_ISTISNA.indexOf(w) >= 0) return;
    if (new RegExp("[" + KUCUK + "][" + BUYUK + "][" + KUCUK + "]").test(w)) ekle("eksik-bosluk", yer, w);
  });
}

function tireleme(yer, t) {
  var re = new RegExp("(?:^|[^\\w’'\\-" + HARF + "])([" + HARF + "]*[" + KUCUK + "])-(\\s*)([" + KUCUK + "]+)(?=$|[^\\w\\-" + HARF + "])", "g"), m;
  while ((m = re.exec(t))) {
    var a = m[1], bosluklu = m[2].length > 0, b = m[3];
    var bitisik = sozluk[trKucuk(a + b)] || 0, sag = sozluk[trKucuk(b)] || 0;
    if (!bosluklu) {
      // "kul-lanacağını": sağ parça veride hiç tek başına geçmiyor, bitişik biçim ise bağımsız sözcük olarak geçiyor
      if (a.length >= 2 && b.length >= 2 && sag === 0 && bitisik > 0) ekle("tireleme", yer, a + "-" + b + "  ->  " + a + b);
    } else if (bitisik > 0 || tireli[trKucuk(a + "-" + b)]) {
      // "ana- litik", "well- being": tireden sonra boşluk (satır sonu kırılımı / yazım hatası)
      ekle("tireleme", yer, a + "-" + m[2] + b);
    }
  }
}

// Rapor
var toplam = 0;
console.log("Denetlenen veri: " + yol);
SINIFLAR.forEach(function (s) {
  var l = bulgular[s];
  toplam += l.length;
  console.log((l.length ? "✗ " : "✓ ") + s + ": " + l.length);
  l.slice(0, ORNEK_SAYISI).forEach(function (x) { console.log("     " + x); });
});
console.log("Toplam ihlal: " + toplam);
process.exit(toplam ? 1 : 0);
