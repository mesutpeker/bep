#!/usr/bin/env node
/* Tüm ders planlarını farklı yetersizlik türleriyle üretip hata/eksik veri arar (geliştirici testi).
   Ayrıca UDA/KDA yapısı, çoklu tanı uyarlamaları, zenginleştirme, BEP dönemi, düzenleme koruma,
   elle girilen ders ve sınav haftası kurallarını denetler. Hata varsa çıkış kodu 1. */
"use strict";
var path = require("path");
var KOK = path.join(__dirname, "..");
global.window = globalThis;
require(path.join(KOK, "data", "dersler.js"));
["kutuphane", "takvim", "uretici", "zip", "yazitipi", "belge", "docx", "onizleme"].forEach(function (m) { require(path.join(KOK, "src", "js", m + ".js")); });
var BEP = globalThis.BEP, tr = BEP.tr;
var yetler = BEP.YETERSIZLIKLER.map(function (y) { return y.id; });
var hata = 0, toplam = 0, sayfaDagilimi = {}, uzunKda = 0, enUzun = "";
var ETIKET = /^UDA (\d+) \/ KDA (\d+)\.(\d+): /;
var GOZLENEMEZ_SON = /\s(kavrar|fark eder|bilir|anlar|algılar|inceler|benimser|önemser|takdir eder|değer verir|hisseder|istekli olur|merak eder)\.\s*(\(Ölçüt|$)/;

function yeniBep(ders, p, yet, ek) {
  var b = {
    egitimYili: "2026-2027", okul: { il: "Ankara", ilce: "Çankaya", ad: "Örnek Anadolu Lisesi", tur: "anadolu" },
    ogrenci: { ad: "Ece Deneme", no: "1", sinif: p.sinif === "S" ? "11" : p.sinif, sube: "B", yetersizlik: yet,
      hizmet: "Tam Zamanlı Kaynaştırma / Bütünleştirme" },
    ders: { id: ders.id, planId: p.id, saat: "" }, ayarlar: { destek: "", duzen: "mufredat", olcut: "80", ozne: "ad", sinavHaftalari: [8, 16, 25, 33] }, kurul: {}
  };
  if (ek) ek(b);
  return b;
}
function dene(ad, fn) {
  toplam++;
  try { fn(); } catch (e) { hata++; console.log("HATA", ad, "->", e.message); }
}
function beklenen(kosul, mesaj) { if (!kosul) throw new Error(mesaj); }

/* Bir planın UDA/KDA yapısını denetler */
function planiDenetle(bep, sonuc) {
  var haftalar = bep.plan.satirlar.filter(function (r) { return r.tur === "hafta"; });
  beklenen(haftalar.length === 37, "hafta sayısı 37 değil");
  var gorulen = {}, kdaSayisi = {}, sonKda = {};
  haftalar.forEach(function (r) {
    String(r.kda || "").split("\n").forEach(function (l) {
      var m = l.match(ETIKET);
      if (!m) return;
      beklenen(m[1] === m[2], "UDA/KDA numarası uyuşmuyor: " + l.slice(0, 60));
      var u = +m[1], k = +m[3];
      beklenen(k === (sonKda[u] || 0) + 1, "KDA numaraları sıralı değil (UDA " + u + "): " + l.slice(0, 60));
      sonKda[u] = k;
      kdaSayisi[u] = (kdaSayisi[u] || 0) + 1;
      var govde = tr.low(l.replace(ETIKET, "").replace(/\s*\(Ölçüt.*$/, ""));
      beklenen(!gorulen[govde], "aynı KDA iki kez: " + l.slice(0, 120));
      gorulen[govde] = 1;
      beklenen(!GOZLENEMEZ_SON.test(l), "gözlemlenemeyen fiille biten KDA: " + l.slice(0, 120));
      beklenen(!/\{konu\}|\{unite\}|\{tur\}|undefined|null|“”|““|””|\sHz\.\s*\(Ölçüt|Zenginleştirme:/.test(l), "şablon/veri artığı: " + l.slice(0, 120));
    });
  });
  sonuc.udalar.forEach(function (u) {
    beklenen((kdaSayisi[u.no] || 0) >= 2, "UDA " + u.no + " için 2'den az KDA (" + (kdaSayisi[u.no] || 0) + ")");
    var bas = haftalar.filter(function (r) { return (r.udaBasi || []).indexOf(u.no) >= 0; });
    beklenen(bas.length === 1, "UDA " + u.no + " cümlesinin yazılacağı ilk hafta bulunamadı");
  });
  var metinler = {};
  sonuc.udalar.forEach(function (u) { beklenen(!metinler[u.metin], "aynı UDA metni iki kez: " + u.metin.slice(0, 80)); metinler[u.metin] = 1; });
}

BEP.dersListesi().forEach(function (ders) {
  ders.planlar.forEach(function (p, pi) {
    // Arayüzle aynı otomatik ayarlar (müfredat düzeni); tek tanılı ve iki tanılı (destek eğitim odalı) senaryolar
    [[yetler[pi % yetler.length]], [yetler[(pi + 5) % yetler.length], yetler[(pi + 3) % yetler.length]]].forEach(function (yet, si) {
      dene(ders.id + " " + p.id + " " + (si ? "iki-tani" : "tek-tani") + "/" + yet.join("+"), function () {
        var bep = yeniBep(ders, p, yet, function (b) { if (si) b.ogrenci.hizmet = "Tam Zamanlı Kaynaştırma / Bütünleştirme + Destek Eğitim Odası"; });
        var s = BEP.planiHazirla(bep);
        if (s.hata) throw new Error(s.hata);
        bep.performans = BEP.varsayilanPerformans(bep);
        ["gelisim", "ders", "guclu", "destek", "davranis"].forEach(function (a) { if (!bep.performans[a]) throw new Error("performans boş: " + a); });
        planiDenetle(bep, s);
        var model = BEP.belgeModeli(bep);
        var json = JSON.stringify(model);
        if (/undefined|NaN|\[object/.test(json)) throw new Error("model içinde undefined/NaN: " + json.match(/.{60}(undefined|NaN|\[object).{40}/)[0]);
        if (/T\.C\. Kimlik|Doğum Tarihi|RAM \(ÖEDK\)|Okul Dışı Destek/.test(json)) throw new Error("kaldırılan alan belgede duruyor");
        if (!/Tablo 4\.3/.test(json) || !/Davranış Desteği/.test(json)) throw new Error("Tablo 4.3 kararları eksik");
        s.udalar.forEach(function (u) { beklenen(json.indexOf("UDA " + u.no + ": ") >= 0, "UDA " + u.no + " cümlesi plan tablosunda yok"); });
        // Çoklu tanıda her tanının uyarlamaları belgede (Tablo 4.1-4.2); yalnız daha geniş bir ek süre hükmüyle örtüşen dar süre hükmü yazılmayabilir
        var genisSure = yet.some(function (id) { return (BEP.yetersizlikBul(id).sinav || []).some(function (u) { return /%25-%50|esnek/.test(u.aciklama); }); });
        yet.forEach(function (id) {
          var pr = BEP.yetersizlikBul(id);
          (pr.sinif || []).concat(pr.sinav || []).forEach(function (u) {
            if (genisSure && /ek süre/.test(u.aciklama) && !/%25-%50|esnek|mola|ortam/i.test(u.aciklama)) return;
            beklenen(json.indexOf(JSON.stringify(u.aciklama).slice(1, -1)) >= 0, "uyarlama eksik (" + id + "): " + u.baslik);
          });
        });
        // Üst bilgi ilçe idaresini yazar (Çankaya → kaymakamlık)
        beklenen(JSON.stringify(model.ust).indexOf("ÇANKAYA KAYMAKAMLIĞI") >= 0, "üst bilgide kaymakamlık yok");
        var bayt = BEP.docxOlustur(model);
        beklenen(bayt.length > 5000, "docx çok küçük");
        BEP.onizlemeHtml(model);
        var plan = model.govde.filter(function (g) { return g.sayfaBasi; })[0];
        var n = Object.keys(plan.sayfaBasi).length + 1;
        sayfaDagilimi[n] = (sayfaDagilimi[n] || 0) + 1;
        bep.plan.satirlar.forEach(function (r) { String(r.kda || "").split("\n").forEach(function (l) { if (l.length > 260) { uzunKda++; if (l.length > enUzun.length) enUzun = l; } }); });
      });
    });
  });
});

// Okul türüne özgü resmî haftalık saat (MTAL'de Türk Dili ve Edebiyatı 10-12. sınıflarda 4 saat)
[["mtal", "9", "", 5], ["mtal", "10", "", 4], ["mtal", "11", "", 4], ["mtal", "12", "", 4], ["anadolu", "10", "", 5], ["fen", "12", "", 5], ["mtal", "11", "3", 3]].forEach(function (k) {
  dene("okul türü saati " + k.join("/"), function () {
    var tde = BEP.dersBul("turk-dili-ve-edebiyati");
    var bep = {
      egitimYili: "2026-2027", okul: { il: "Ankara", ad: "Örnek Lisesi", tur: k[0] },
      ogrenci: { ad: "Ece Deneme", sinif: k[1], yetersizlik: ["oog"], hizmet: "Tam Zamanlı Kaynaştırma / Bütünleştirme" },
      ders: { id: tde.id, planId: BEP.planOner(tde, k[1], k[0]), saat: k[2] }, ayarlar: { duzen: "mufredat", olcut: "80", ozne: "ad", sinavHaftalari: [8, 16, 25, 33] }, kurul: {}
    };
    var s = BEP.planiHazirla(bep);
    if (s.hata) throw new Error(s.hata);
    bep.performans = BEP.varsayilanPerformans(bep);
    var saatler = bep.plan.satirlar.filter(function (r) { return r.tur === "hafta" && r.saat !== "—"; }).map(function (r) { return +r.saat; });
    if (BEP.baglam(bep).saat !== k[3] || saatler.some(function (x) { return x !== k[3]; })) throw new Error("haftalık saat " + k[3] + " bekleniyordu: " + BEP.baglam(bep).saat);
    if (JSON.stringify(BEP.belgeModeli(bep)).indexOf("(" + k[3] + " Saat)") < 0) throw new Error("belgede ders saati " + k[3] + " değil");
  });
});

/* ---- Özel senaryolar ---- */
function tekBep(dersId, planId, yet, ek) { return yeniBep(BEP.dersBul(dersId) || { id: dersId }, BEP.planBul(BEP.dersBul(dersId), planId) || { id: planId, sinif: "11" }, yet, ek); }

dene("çoklu tanı: aynı başlıklı uyarlamalar birleşir, ikinci tanının içeriği kaybolmaz", function () {
  var b = tekBep("matematik", "anadolu-9", ["zihinsel_hafif", "isitme"]);
  var u = BEP.varsayilanUyarlamalar(b);
  var fiziksel = u.sinif.filter(function (x) { return x.baslik === "Fiziksel Düzen ve Oturma Yeri"; })[0];
  beklenen(fiziksel && /ışık kaynağı/.test(fiziksel.aciklama) && /ön-orta sıraya/.test(fiziksel.aciklama), "işitme yetersizliğine özgü oturma düzeni kayboldu");
  beklenen(u.sinif.some(function (x) { return x.baslik === "Cihaz ve Teknoloji"; }), "işitme cihazı uyarlaması eksik");
  beklenen(u.sinif.concat(u.sinav).every(function (x) { return x.secili; }), "seçili olmayan uyarlama var");
});

dene("yabancı dil muafiyeti yalnız öğrencinin tanısını yazar", function () {
  var b = tekBep("ingilizce", "hazirliksiz-9", ["otizm"]);
  var m = BEP.muafiyetNotu(b);
  beklenen(/otizm spektrum bozukluğu tanısı/.test(m) && !/işitme/.test(m) && !/zihinsel/.test(m), "muafiyet notu: " + m);
  beklenen(BEP.muafiyetNotu(tekBep("ingilizce", "hazirliksiz-9", ["oog"])) === "", "ÖÖG için muafiyet notu olmamalı");
});

dene("özel yetenekli öğrencide plan zenginleştirme odaklı", function () {
  var b = tekBep("matematik", "fen-9", ["ozel_yetenek"]);
  var s = BEP.planiHazirla(b);
  b.performans = BEP.varsayilanPerformans(b);
  beklenen(s.udalar.every(function (u) { return /derinleştirir/.test(u.metin) && !/bireysel düzeyine uygun destekle/.test(u.metin); }), "UDA metni zenginleştirme değil");
  beklenen(b.performans.ders.indexOf(BEP.ZENGIN_PERFORMANS) >= 0, "ders performansı zenginleştirme ifadesi değil");
  var olcme = b.plan.satirlar.map(function (r) { return r.olcme || ""; }).join(" ");
  beklenen(!/3 seçenekli kısa test|Yönlendirmeli kısa cevaplı/.test(olcme), "ölçme araçları sadeleştirilmiş");
  beklenen(BEP.otomatikKararlar(b).some(function (k) { return /Zenginleştirme/.test(k.baslik); }), "zenginleştirme kararı yok");
});

dene("yıl içinde başlayan BEP: önceki haftalara BEP amacı yazılmaz", function () {
  var b = tekBep("matematik", "anadolu-9", ["oog"], function (x) { x.ogrenci.bepBaslangic = "2026-11-23"; x.ogrenci.bepBitis = "2027-06-25"; });
  var s = BEP.planiHazirla(b);
  var haftalar = b.plan.satirlar.filter(function (r) { return r.tur === "hafta"; });
  var once = haftalar.filter(function (r) { return r.bepDisi === "once"; });
  beklenen(once.length === 9, "BEP öncesi hafta sayısı 9 değil: " + once.length);
  beklenen(once.every(function (r) { return !ETIKET.test(r.kda); }), "BEP öncesi haftada KDA var");
  beklenen(ETIKET.test(haftalar[9].kda) && /^UDA 1 \/ KDA 1\.1:/.test(haftalar[9].kda), "UDA 1 BEP başlangıç haftasında başlamıyor");
  beklenen(!b.plan.satirlar.some(function (r) { return r.bepDisi && r.sinav; }), "BEP dışı haftada BEP sınavı işaretli");
  planiDenetle(b, s);
});

dene("ders değişince elle düzenlemeler yeni plana taşınmaz", function () {
  var b = tekBep("matematik", "anadolu-12", ["oog"]);
  BEP.planiHazirla(b);
  var r5 = b.plan.satirlar.filter(function (r) { return r.no === 5; })[0];
  r5.kda = "UDA 1 / KDA 1.5: Ece, logaritma tablosunu kullanır."; r5.duzenlendi = { kda: true };
  b.ders = { id: "biyoloji", planId: "anadolu-12" };
  var s = BEP.planiHazirla(b, { duzenlemeleriKoru: true });
  beklenen(s.duzenlemelerAtildi, "düzenlemelerin atıldığı bildirilmedi");
  beklenen(!/logaritma/.test(b.plan.satirlar.filter(function (r) { return r.no === 5; })[0].kda), "eski dersin KDA'sı yeni planda kaldı");
  // Aynı derste koru: düzenleme kalır, etiket güncellenir
  var r6 = b.plan.satirlar.filter(function (r) { return r.no === 6; })[0];
  r6.kda = r6.kda.replace(/: .*$/, ": Ece, hücre modelini çizer."); r6.duzenlendi = { kda: true };
  b.ayarlar.olcut = "70";
  BEP.planiHazirla(b, { duzenlemeleriKoru: true });
  beklenen(/hücre modelini çizer/.test(b.plan.satirlar.filter(function (r) { return r.no === 6; })[0].kda), "aynı derste düzenleme korunmadı");
});

dene("36'dan fazla öğrenme birimi: 36 hafta + sosyal etkinlik", function () {
  var oz = { ad: "Atölye", sinif: "11", saat: 4, uniteler: [] };
  for (var i = 0; i < 45; i++) oz.uniteler.push({ ad: "Birim " + (i + 1), saat: "", kazanimlar: "Birim " + (i + 1) + " araçlarını tanır.\nBirim " + (i + 1) + " uygulamasını yapar." });
  var p = BEP.ozelPlanOlustur(oz);
  var no = p.haftalar.map(function (h) { return h.h; });
  beklenen(no.length === 37 && Math.max.apply(null, no) === 37 && no.filter(function (h) { return h === 37; }).length === 1, "hafta numaraları bozuk: " + no.join(","));
  var kullanilan = {};
  p.haftalar.forEach(function (h) { (h.u || []).forEach(function (u) { kullanilan[u] = 1; }); });
  beklenen(Object.keys(kullanilan).length === 45, "her birim bir haftaya atanmadı");
  var b = { egitimYili: "2026-2027", okul: { tur: "mtal" }, ogrenci: { ad: "Ece Deneme", sinif: "11", yetersizlik: ["zihinsel_orta"] }, ders: { id: "__ozel__", ozel: oz }, ayarlar: { olcut: "80", ozne: "ad", sinavHaftalari: [8, 16, 25, 33] } };
  var s = BEP.planiHazirla(b);
  planiDenetle(b, s);
});

dene("tek üniteli kazanımsız elle girilen ders (özel yetenek, tüm destek düzeyleri): KDA tekrarı yok, ünite dönem sonundan bölünür", function () {
  var donemSonu = BEP.takvimBilgi("2026-2027").donemSonHaftasi;
  ["", "hafif", "orta", "yogun"].forEach(function (d) {
    // Koşul havuzu en dar olan genel profil (diğer) ve tek kazanımlı ünite de denenir
    [["ozel_yetenek"], ["diger"]].forEach(function (yet) {
      [0, 1].forEach(function (kazSay) {
        var oz = { ad: "Atölye", sinif: "11", saat: 4, uniteler: [{ ad: "Birim 1", saat: "", kazanimlar: kazSay ? "Birim 1 kapsamında temel işlemi yapar." : "" }] };
        var b = { egitimYili: "2026-2027", okul: { tur: "mtal" }, ogrenci: { ad: "Ece Deneme", sinif: "11", yetersizlik: yet }, ders: { id: "__ozel__", ozel: oz, saat: "" }, ayarlar: { destek: d, olcut: "80", ozne: "ad", sinavHaftalari: [8, 16, 25, 33] }, kurul: {} };
        var s = BEP.planiHazirla(b), ad = yet[0] + "/" + (d || "otomatik") + "/" + kazSay + " kazanım: ";
        try { planiDenetle(b, s); } catch (e) { throw new Error(ad + e.message); }
        beklenen(s.udalar.length === 2 && s.udalar[0].sonHafta === donemSonu && s.udalar[1].ilkHafta === donemSonu + 1, ad + "ünite dönem sonundan bölünmedi");
        beklenen(/1\. dönemde/.test(s.udalar[0].metin) && /2\. dönemde/.test(s.udalar[1].metin), ad + "UDA metninde dönem yok");
        var kda = b.plan.satirlar.map(function (r) { return r.kda || ""; }).join("\n");
        beklenen(!/ uygulamada /.test(kda), ad + "son çare sıra eki kullanıldı (koşul havuzu yetmedi)");
        if (yet[0] === "ozel_yetenek") beklenen(!/ipucu|model olduğunda|yardımla|desteklendiğinde|sadeleştirilmiş/.test(kda), ad + "zenginleştirme planında destek dili");
      });
    });
  });
});

dene("yalnız numaradan oluşan ünite adı (“1. Ünite”) boş tırnak üretmez", function () {
  var oz = { ad: "Atölye", sinif: "11", saat: 4, uniteler: [{ ad: "1. Ünite", saat: "", kazanimlar: "" }, { ad: "2. Ünite", saat: "", kazanimlar: "" }] };
  var b = { egitimYili: "2026-2027", okul: { tur: "mtal" }, ogrenci: { ad: "Ece Deneme", sinif: "11", yetersizlik: ["zihinsel_orta"] }, ders: { id: "__ozel__", ozel: oz, saat: "" }, ayarlar: { olcut: "80", ozne: "ad", sinavHaftalari: [8, 16, 25, 33] }, kurul: {} };
  var s = BEP.planiHazirla(b);
  planiDenetle(b, s);
  var metin = s.udalar.map(function (u) { return u.metin; }).concat(b.plan.satirlar.map(function (r) { return r.kda || ""; })).join("\n");
  beklenen(metin.indexOf("“”") < 0, "boş tırnak var");
});

dene("karma tanı (özel yetenek + DEHB): DEHB koşulları plana girer, zenginleştirme koşulu destek planına karışmaz", function () {
  var b = tekBep("fizik", "anadolu-9", ["ozel_yetenek", "dehb"]);
  var s = BEP.planiHazirla(b), c = BEP.baglam(b);
  planiDenetle(b, s);
  var tum = b.plan.satirlar.map(function (r) { return r.kda || ""; }).join("\n");
  var dk = BEP.yetersizlikBul("dehb").kosul[c.destek];
  beklenen(!c.zengin && dk.every(function (k) { return tum.indexOf(k) >= 0; }), "DEHB koşulları planda yok");
  beklenen(!/ileri düzey kaynaklardan|disiplinler arası bir bakışla/.test(tum), "destek planında zenginleştirme koşulu");
});

dene("haftalık 6 saatlik derste dönem başına 3. BEP sınavı", function () {
  var b = tekBep("matematik", "anadolu-9", ["oog"], function (x) { x.ayarlar.sinavHaftalari = [6, 12, 17, 24, 30, 35]; });
  beklenen(BEP.baglam(b).saat >= 6, "matematik 9 haftalık 6 saat değil");
  BEP.planiHazirla(b);
  var olcme = b.plan.satirlar.map(function (r) { return r.olcme || ""; }).join("\n");
  beklenen(/1\. DÖNEM 3\. BEP YAZILI SINAVI/.test(olcme) && /2\. DÖNEM 3\. BEP YAZILI SINAVI/.test(olcme), "3. sınav etiketi yok");
  beklenen(BEP.sinavHaftalariTemiz([8, 8, 37, 40, 0, 16], 36).join(",") === "8,16", "sınav haftası temizleme hatalı");
});

dene("İngilizce: hazırlık sınıfı olan okulda hazırlıklı plan önerilir", function () {
  var ing = BEP.dersBul("ingilizce");
  beklenen(BEP.planOner(ing, "10", "anadolu", { hazirlik: true }) === "hazirlikli-10", "hazırlıklı plan önerilmedi");
  beklenen(BEP.planOner(ing, "10", "anadolu") === "hazirliksiz-10", "varsayılan hazırlıksız plan değil");
});

dene("gözlemlenemeyen fiiller gözlemlenebilir karşılıklarına çevrilir", function () {
  beklenen(BEP.gozlenebilirYap("Peygamberi sevmenin dinî bir sorumluluk olduğunu kavrar.") === "Peygamberi sevmenin dinî bir sorumluluk olduğunu açıklar", "kavrar çevrilmedi");
  beklenen(BEP.gozlenebilirYap("verilen ritmi algılar") === "verilen ritmi ayırt eder", "algılar çevrilmedi");
});

dene("takvim: dönem sonu ve son öğretim haftası", function () {
  var T = BEP.takvimBilgi("2026-2027");
  beklenen(T.donemSonHaftasi === 18 && T.sonOgretimHaftasi === 36 && T.tatiller.length === 3, "takvim bilgisi hatalı");
  beklenen(BEP.takvimBilgi("1999-2000").egitimYili === BEP.VARSAYILAN_YIL, "bilinmeyen yıl varsayılana düşmüyor");
});

console.log("Toplam senaryo:", toplam, "| Hata:", hata, "| Plan sayfa sayısı dağılımı:", JSON.stringify(sayfaDagilimi), "| 260+ karakter KDA:", uzunKda);
if (enUzun) console.log("En uzun KDA (" + enUzun.length + "):", enUzun);
process.exit(hata ? 1 : 0);
