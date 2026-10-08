#!/usr/bin/env node
/*
 * Gerçek tarayıcı testi (Playwright + Chromium): arayüz akışı, Word indirme, önizleme ve Yazdır/PDF.
 * Kullanım:  node tools/tarayici_test.js [index.html|BEP_Hazirlama_Uygulamasi.html]
 * Gereksinimler: playwright (npm), Chromium; PDF metin denetimi için pdfinfo/pdftotext (poppler-utils).
 * Hata varsa çıkış kodu 1.
 */
"use strict";
var path = require("path"), fs = require("fs"), os = require("os"), cp = require("child_process");
var KOK = path.join(__dirname, "..");
var pw;
try { pw = require("playwright"); } catch (e) {
  try { pw = require("/opt/node22/lib/node_modules/playwright"); } catch (e2) { console.error("playwright bulunamadı (npm install playwright)"); process.exit(2); }
}
var GECICI = fs.mkdtempSync(path.join(os.tmpdir(), "bep-tarayici-"));
var hata = 0, toplam = 0;
function arac(ad) { try { cp.execFileSync("which", [ad], { stdio: "ignore" }); return true; } catch (e) { return false; } }
var PDF_ARACI = arac("pdftotext") && arac("pdfinfo");
function beklenen(kosul, mesaj) { if (!kosul) throw new Error(mesaj); }

/* .docx (STORE ZIP) içinden dosya okur */
function zipOku(bayt, ad) {
  var i = 0;
  while (i + 30 <= bayt.length && bayt.readUInt32LE(i) === 0x04034b50) {
    var boyut = bayt.readUInt32LE(i + 18), adUz = bayt.readUInt16LE(i + 26), ekUz = bayt.readUInt16LE(i + 28);
    var dosya = bayt.slice(i + 30, i + 30 + adUz).toString("utf8");
    var bas = i + 30 + adUz + ekUz;
    if (dosya === ad) return bayt.slice(bas, bas + boyut).toString("utf8");
    i = bas + boyut;
  }
  return null;
}

async function senaryo(browser, ad, hedef, ayar) {
  toplam++;
  var ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true });
  var page = await ctx.newPage();
  var sayfaHatalari = [];
  page.on("pageerror", function (e) { sayfaHatalari.push(e.message); });
  page.on("console", function (m) { if (m.type() === "error") sayfaHatalari.push(m.text()); });
  page.on("dialog", function (d) { d.accept(); });
  try {
    await page.goto("file://" + hedef);
    await page.fill('[data-alan="ogrenci.ad"]', "Ece Deneme Örnekoğlu");
    await page.fill('[data-alan="ogrenci.no"]', "123");
    await page.selectOption('[data-alan="ogrenci.sinif"]', ayar.sinif);
    await page.fill('[data-alan="ogrenci.sube"]', "B");
    for (var y of ayar.yet) await page.check('[data-yet="' + y + '"]');
    await page.click("#btnIleri");
    await page.selectOption('[data-alan="okul.tur"]', ayar.okulTur || "anadolu");
    await page.selectOption("#dersSec", ayar.ders);
    if (ayar.ozel) {
      await page.fill('[data-alan="ders.ozel.ad"]', "Mesleki Gelişim Atölyesi");
      for (var i = 0; i < ayar.ozel; i++) {
        if (i > 0) await page.click("#btnOzelUniteEkle");
        await page.fill('[data-alan="ders.ozel.uniteler.' + i + '.ad"]', "Öğrenme Birimi " + (i + 1));
        await page.fill('[data-alan="ders.ozel.uniteler.' + i + '.kazanimlar"]', "Birim " + (i + 1) + " kavramlarını açıklar.\nBirim " + (i + 1) + " uygulamasını yapar.");
      }
    }
    if (ayar.plan) await page.selectOption("#planSec", ayar.plan);
    await page.click("#btnIleri");
    await page.waitForSelector("#planTablosu table");
    var udaKutusu = await page.$$eval("#planTablosu textarea[data-uda]", function (l) { return l.length; });
    beklenen(udaKutusu >= 2, "plan tablosunda UDA cümlesi kutusu yok");
    if (ayar.udaDuzenle) {
      await page.locator('#planTablosu textarea[data-uda="1"]').fill("Ece, elle yazılan uzun dönemli amacı gerçekleştirir.");
      await page.waitForTimeout(500);
      await page.reload();
      await page.click('[data-adim="3"]');
      var kalici = await page.locator('#planTablosu textarea[data-uda="1"]').inputValue();
      beklenen(/elle yazılan uzun dönemli amacı/.test(kalici), "UDA düzenlemesi sayfa yenilenince kayboldu");
    }
    if (ayar.donemSayfa) await page.check('[data-alan="ayarlar.donemSayfa"]');
    await page.click("#btnIleri");
    var alanlar = { "okul.il": "Karaman", "okul.ilce": "Ermenek", "okul.ad": "Örnek Anadolu Lisesi", "okul.mudur": "Ayşe Yılmaz", "kurul.baskan": "Ali Veli", "ders.ogretmen": "Elif Kaya", "kurul.rehberOgretmen": "Zeynep Ak", "kurul.sinifRehber": "Can Er", "kurul.veli": "Fatma Deneme", "kurul.tarih": "2026-10-02", "tasdik.tarih": "2026-10-05", "tasdik.uygulamaTarihi": "2026-10-05" };
    for (var k in alanlar) await page.fill('[data-alan="' + k + '"]', alanlar[k]);
    await page.click("#btnIleri");
    await page.waitForSelector("#onizleme .sayfa");
    var kontrol = await page.$$eval("#kontrolListesi .kontrol", function (l) { return l.map(function (x) { return x.className.split(" ")[1] + ": " + x.querySelector("span").textContent; }); });
    beklenen(kontrol.some(function (x) { return /^tamam/.test(x); }), "kontrol listesi hazır değil: " + kontrol.join(" | "));
    // Önizleme: hiçbir sayfa A4 yatay yüksekliğini (210 mm) aşmamalı
    await page.fill("#olcekAyar", "100");
    await page.dispatchEvent("#olcekAyar", "input");
    await page.waitForTimeout(200);
    var olcum = await page.evaluate(function () {
      var mm = 96 / 25.4;
      return Array.prototype.map.call(document.querySelectorAll("#onizleme .sayfa"), function (s) { return Math.round(s.scrollHeight / mm); });
    });
    beklenen(olcum.every(function (h) { return h <= 211; }), "önizlemede A4'ü aşan sayfa: " + olcum.join(","));
    if (ayar.donemSayfa) {
      // "2. dönemi yeni sayfada başlat": 2. dönemin ilk haftası (19. Hf) sayfanın ilk veri satırı olmalı
      var donem = await page.evaluate(function () {
        var satir = Array.prototype.filter.call(document.querySelectorAll("#onizleme tr"), function (tr) { return /^\s*19\. Hf/.test((tr.cells[1] || tr.cells[0] || {}).textContent || "") || /19\. Hf/.test(tr.textContent.slice(0, 40)); })[0];
        if (!satir) return "bulunamadı";
        var veri = Array.prototype.filter.call(satir.closest(".sayfa").querySelectorAll("tr"), function (tr) { return !tr.classList.contains("bas"); });
        return veri[0] === satir ? "ilk" : "ilk değil";
      });
      beklenen(donem === "ilk", "2. dönem yeni sayfada başlamıyor (" + donem + ")");
    }
    // Word
    var indirme = await Promise.all([page.waitForEvent("download"), page.click("#btnWord")]);
    var docx = path.join(GECICI, ad + ".docx");
    await indirme[0].saveAs(docx);
    var bayt = fs.readFileSync(docx);
    var xml = zipOku(bayt, "word/document.xml");
    beklenen(xml && xml.length > 10000, "docx içinde word/document.xml yok");
    beklenen((xml.match(/<w:tbl>/g) || []).length === (xml.match(/<\/w:tbl>/g) || []).length, "docx tablo etiketleri dengesiz");
    beklenen(/UDA 1: /.test(xml) && /KDA 1\.1: /.test(xml), "docx'te UDA cümlesi/KDA yok");
    beklenen(!/undefined|NaN/.test(xml), "docx içinde undefined/NaN");
    beklenen(/ERMENEK KAYMAKAMLIĞI/.test(zipOku(bayt, "word/header1.xml") || ""), "üst bilgide kaymakamlık yok");
    if (ayar.udaDuzenle) beklenen(/elle yazılan uzun dönemli amacı/.test(xml), "elle yazılan UDA cümlesi Word'e geçmedi");
    // Yazdır / PDF
    await page.evaluate(function () { window.__yazdirildi = false; window.print = function () { window.__yazdirildi = true; }; });
    await page.click("#btnYazdir");
    await page.waitForFunction(function () { return window.__yazdirildi; }, null, { timeout: 15000 });
    var sayfaSayisi = await page.$$eval("#yazdirma-alani .sayfa", function (l) { return l.length; });
    await page.emulateMedia({ media: "print" });
    var pdf = path.join(GECICI, ad + ".pdf");
    await page.pdf({ path: pdf, preferCSSPageSize: true, printBackground: true });
    if (PDF_ARACI) {
      var bilgi = cp.execFileSync("pdfinfo", [pdf]).toString();
      var pdfSayfa = +(bilgi.match(/Pages:\s+(\d+)/) || [])[1];
      beklenen(pdfSayfa === sayfaSayisi, "PDF sayfa sayısı (" + pdfSayfa + ") yazdırma alanındaki sayfa sayısından (" + sayfaSayisi + ") farklı");
      var metin = cp.execFileSync("pdftotext", ["-layout", pdf, "-"]).toString();
      ["[BÖLÜM 1]", "[BÖLÜM 3]", "[BÖLÜM 5]", "[BÖLÜM 6]", "UYGUNDUR", "Sayfa " + pdfSayfa + " / " + pdfSayfa].forEach(function (aranan) {
        beklenen(metin.indexOf(aranan) >= 0, "PDF'te bulunamadı: " + aranan);
      });
      if (ayar.sonUda) beklenen(new RegExp("UDA " + ayar.sonUda + "\\b").test(metin), "PDF'te son UDA (" + ayar.sonUda + ") yok");
    } else console.log("  (pdftotext yok: PDF metin denetimi atlandı)");
    beklenen(!sayfaHatalari.length, "sayfa hataları: " + sayfaHatalari.join(" | "));
    console.log("TAMAM", ad, "| önizleme sayfaları (mm):", olcum.join(","), "| PDF sayfa:", sayfaSayisi);
  } catch (e) {
    hata++;
    console.log("HATA", ad, "->", e.message);
  }
  await ctx.close();
}

async function mobil(browser, hedef) {
  toplam++;
  var page = await browser.newPage({ viewport: { width: 360, height: 780 } });
  try {
    await page.goto("file://" + hedef);
    await page.fill('[data-alan="ogrenci.ad"]', "Deniz Kaya");
    await page.check('[data-yet="oog"]');
    await page.click('[data-adim="2"]');
    await page.selectOption("#dersSec", "turk-dili-ve-edebiyati");
    var tasan = [];
    for (var a = 1; a <= 5; a++) {
      await page.click('[data-adim="' + a + '"]');
      await page.waitForTimeout(150);
      var t = await page.evaluate(function () { return document.documentElement.scrollWidth - window.innerWidth; });
      if (t > 0) tasan.push(a + ". adım " + t + "px");
    }
    beklenen(!tasan.length, "telefon görünümünde yatay taşma: " + tasan.join(", "));
    console.log("TAMAM telefon görünümü (360 px)");
  } catch (e) { hata++; console.log("HATA telefon görünümü ->", e.message); }
  await page.close();
}

(async function () {
  var hedefler = process.argv[2] ? [path.resolve(process.argv[2])] : [path.join(KOK, "index.html"), path.join(KOK, "BEP_Hazirlama_Uygulamasi.html")];
  var browser = await pw.chromium.launch();
  for (var h of hedefler) {
    console.log("== " + path.basename(h));
    await senaryo(browser, "matematik9", h, { sinif: "9", yet: ["oog", "dehb"], ders: "matematik", udaDuzenle: true, donemSayfa: true });
    await senaryo(browser, "ingilizce-hazirlik", h, { sinif: "H", yet: ["zihinsel_hafif", "isitme", "otizm"], ders: "ingilizce", sonUda: 12 });
    await senaryo(browser, "tde12-mtal", h, { sinif: "12", yet: ["gorme"], ders: "turk-dili-ve-edebiyati", okulTur: "mtal" });
    await senaryo(browser, "ozel-ders", h, { sinif: "11", yet: ["zihinsel_orta"], ders: "__ozel__", ozel: 12, okulTur: "mtal" });
    await mobil(browser, h);
  }
  await browser.close();
  console.log("Toplam:", toplam, "| Hata:", hata);
  process.exit(hata ? 1 : 0);
})().catch(function (e) { console.error(e); process.exit(1); });
