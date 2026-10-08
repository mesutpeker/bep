#!/usr/bin/env node
/*
 * Komut satırından örnek BEP belgesi üretir (geliştirici testi).
 * Kullanım:  node tools/ornek_uret.js [ders-id] [sinif] [cikti.docx] [yetersizlik,...]
 * Örnek:     node tools/ornek_uret.js turk-dili-ve-edebiyati 12 ornek.docx
 * Not: Örnek öğrenci bilgileri kurgusaldır.
 */
"use strict";
var path = require("path");
var fs = require("fs");
var KOK = path.join(__dirname, "..");
global.window = globalThis;
require(path.join(KOK, "data", "dersler.js"));
["kutuphane", "takvim", "uretici", "zip", "yazitipi", "belge", "docx"].forEach(function (m) { require(path.join(KOK, "src", "js", m + ".js")); });
var BEP = globalThis.BEP;

var dersId = process.argv[2] || "turk-dili-ve-edebiyati";
var sinif = process.argv[3] || "12";
var cikti = process.argv[4] || path.join(KOK, "tools", "ara", "ornek_" + dersId + "_" + sinif + ".docx");
var yet = (process.argv[5] || "zihinsel_hafif").split(",");

var ders = BEP.dersBul(dersId);
if (!ders) { console.error("Ders bulunamadı:", dersId); process.exit(1); }
var planId = BEP.planOner(ders, sinif, "mtal");
// Arayüzle aynı yapı: kişisel alanlar en aza indirilmiş, ayarlar tanıya göre otomatik
var bep = {
  egitimYili: BEP.VARSAYILAN_YIL,
  okul: { il: "Karaman", ilce: "Merkez", ad: "Karaman Mesleki ve Teknik Anadolu Lisesi", tur: "mtal", mudur: "Ayşe Örnek" },
  ogrenci: { ad: "Deniz Örnekoğlu", no: "123", sinif: sinif, sube: "A", yetersizlik: yet,
    hizmet: "Tam Zamanlı Kaynaştırma / Bütünleştirme", bepBaslangic: "2026-09-14", bepBitis: "2027-06-25", cihaz: "" },
  ders: { id: dersId, planId: planId, saat: "", ogretmen: "Elif Örnekçi" },
  ayarlar: { destek: "", olcut: "80", ozne: "ad", sinavHaftalari: [8, 16, 25, 33], duzen: "mufredat", kvkkNotu: true },
  kurul: { baskan: "Ali Örnek", baskanUnvan: "Müdür Yardımcısı", rehberOgretmen: "Zeynep Örnekli", sinifRehber: "", veli: "", tarih: "2026-10-02" },
  tasdik: { tarih: "", uygulamaTarihi: "" }
};
var sonuc = BEP.planiHazirla(bep);
if (sonuc.hata) { console.error(sonuc.hata); process.exit(1); }
bep.performans = BEP.varsayilanPerformans(bep);
var model = BEP.belgeModeli(bep);
var bayt = BEP.docxOlustur(model);
fs.mkdirSync(path.dirname(cikti), { recursive: true });
fs.writeFileSync(cikti, Buffer.from(bayt));
var plan = model.govde.filter(function (g) { return g.tip === "tablo" && g.sayfaBasi; })[0];
console.log("Oluşturuldu:", cikti, (bayt.length / 1024).toFixed(0) + " KB", "| plan:", planId, "| sayfa kesmeleri (satır):", Object.keys(plan.sayfaBasi).join(", "));
