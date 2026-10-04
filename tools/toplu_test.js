#!/usr/bin/env node
/* Tüm ders planlarını farklı yetersizlik türleriyle üretip hata/eksik veri arar (geliştirici testi). */
"use strict";
var path = require("path");
var KOK = path.join(__dirname, "..");
global.window = globalThis;
require(path.join(KOK, "data", "dersler.js"));
["kutuphane", "takvim", "uretici", "zip", "yazitipi", "belge", "docx", "onizleme"].forEach(function (m) { require(path.join(KOK, "src", "js", m + ".js")); });
var BEP = globalThis.BEP;
var yetler = BEP.YETERSIZLIKLER.map(function (y) { return y.id; });
var hata = 0, toplam = 0, sayfaDagilimi = {}, uzunKda = 0, enUzun = "";
BEP.dersListesi().forEach(function (ders) {
  ders.planlar.forEach(function (p, pi) {
    // Arayüzle aynı otomatik ayarlar (müfredat düzeni); tek tanılı ve iki tanılı (destek eğitim odalı) senaryolar
    [[yetler[pi % yetler.length]], [yetler[(pi + 5) % yetler.length], yetler[(pi + 3) % yetler.length]]].forEach(function (yet, si) {
      var c = [si ? "iki-tani" : "tek-tani", yet.join("+")];
      toplam++;
      var bep = {
        egitimYili: "2026-2027", okul: { il: "Ankara", ilce: "Çankaya", ad: "Örnek Anadolu Lisesi", tur: "anadolu" },
        ogrenci: { ad: "Ece Deneme", no: "1", sinif: p.sinif === "S" ? "11" : p.sinif, sube: "B", yetersizlik: yet,
          hizmet: si ? "Tam Zamanlı Kaynaştırma / Bütünleştirme + Destek Eğitim Odası" : "Tam Zamanlı Kaynaştırma / Bütünleştirme" },
        ders: { id: ders.id, planId: p.id, saat: "" }, ayarlar: { destek: "", duzen: "mufredat", olcut: "80", ozne: "ad", sinavHaftalari: [8, 16, 25, 33] }, kurul: {}
      };
      try {
        var s = BEP.planiHazirla(bep);
        if (s.hata) throw new Error(s.hata);
        bep.performans = BEP.varsayilanPerformans(bep);
        ["gelisim", "ders", "guclu", "destek", "davranis"].forEach(function (a) { if (!bep.performans[a]) throw new Error("performans boş: " + a); });
        var model = BEP.belgeModeli(bep);
        var json = JSON.stringify(model);
        if (/undefined|NaN|\[object/.test(json)) throw new Error("model içinde undefined/NaN: " + json.match(/.{60}(undefined|NaN|\[object).{40}/)[0]);
        if (/T\.C\. Kimlik|Doğum Tarihi|RAM \(ÖEDK\)|Okul Dışı Destek/.test(json)) throw new Error("kaldırılan alan belgede duruyor");
        if (!/Tablo 4\.3/.test(json) || !/Davranış Desteği/.test(json)) throw new Error("Tablo 4.3 kararları eksik");
        var bayt = BEP.docxOlustur(model);
        BEP.onizlemeHtml(model);
        var plan = model.govde.filter(function (g) { return g.sayfaBasi; })[0];
        var n = Object.keys(plan.sayfaBasi).length + 1;
        sayfaDagilimi[n] = (sayfaDagilimi[n] || 0) + 1;
        bep.plan.satirlar.forEach(function (r) { if (r.kda && r.kda.length > 260) { uzunKda++; if (r.kda.length > enUzun.length) enUzun = r.kda; } });
        if (bep.plan.satirlar.filter(function (r) { return r.tur === "hafta"; }).length !== 37) throw new Error("hafta sayısı 37 değil");
      } catch (e) {
        hata++;
        console.log("HATA", ders.id, p.id, c.join("/"), "->", e.message);
      }
    });
  });
});
console.log("Toplam senaryo:", toplam, "| Hata:", hata, "| Plan sayfa sayısı dağılımı:", JSON.stringify(sayfaDagilimi), "| 260+ karakter KDA:", uzunKda);
if (enUzun) console.log("En uzun KDA (" + enUzun.length + "):", enUzun);
process.exit(hata ? 1 : 0);
