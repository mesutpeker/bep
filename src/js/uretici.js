/*
 * BEP Hazırlama Aracı — İçerik üretici
 * Resmî çerçeve yıllık plan verisi + resmî takvim + öğrenci profili => BEP yıllık planı
 *
 * KDA yazımı ORGM (2022) kılavuzuna göre: birey (öğrencinin adı) + koşul + davranış (geniş zaman) + ölçüt.
 */
(function (kok) {
  "use strict";
  var BEP = (kok.BEP = kok.BEP || {});
  var tr = BEP.tr;

  function sec(liste, i) { return liste && liste.length ? liste[((i % liste.length) + liste.length) % liste.length] : ""; }
  function benzersiz(a) { var o = []; a.forEach(function (x) { if (x && o.indexOf(x) < 0) o.push(x); }); return o; }

  /* ----------------------------------------------------------------- veri erişimi */
  BEP.dersListesi = function () { return (kok.BEP_VERI && kok.BEP_VERI.dersler) || []; };
  BEP.dersBul = function (id) {
    var l = BEP.dersListesi();
    for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i];
    return null;
  };
  BEP.planBul = function (ders, planId) {
    if (!ders) return null;
    var p = null;
    for (var i = 0; i < ders.planlar.length; i++) if (ders.planlar[i].id === planId) p = ders.planlar[i];
    if (!p) return null;
    if (p.ayni) {
      var kaynak = BEP.planBul(ders, p.ayni);
      if (kaynak) {
        var k = {};
        for (var a in kaynak) k[a] = kaynak[a];
        for (var b in p) if (b !== "ayni") k[b] = p[b];
        return k;
      }
    }
    return p;
  };
  var SINIF_AD = { H: "Hazırlık", "9": "9. Sınıf", "10": "10. Sınıf", "11": "11. Sınıf", "12": "12. Sınıf", S: "Seçmeli" };
  BEP.sinifAdi = function (s) { return SINIF_AD[s] || s; };

  /* Okul türüne göre en uygun plan varyantı */
  BEP.planOner = function (ders, sinif, okulTuru) {
    if (!ders) return null;
    var adaylar = ders.planlar.filter(function (p) { return p.sinif === sinif; });
    if (!adaylar.length) return null;
    var tercih = { fen: ["fen", "anadolu", "genel"], sosyal: ["sosyal", "anadolu", "genel"], aihl: ["aihl", "anadolu", "genel"] }[okulTuru] || ["anadolu", "genel", "hazirliksiz"];
    if (ders.id === "ingilizce") tercih = okulTuru === "hazirlikli" ? ["hazirlikli", "hazirliksiz"] : ["hazirliksiz", "hazirlikli"];
    for (var i = 0; i < tercih.length; i++) {
      for (var j = 0; j < adaylar.length; j++) if (adaylar[j].okul === tercih[i]) return adaylar[j].id;
    }
    return adaylar[0].id;
  };

  /* Resmî çerçeve planları Anadolu/Fen/Sosyal Bilimler liselerinin saatine göredir.
     Haftalık ders çizelgesinde saati farklı olan okul türleri için resmî haftalık saat. */
  var OKUL_TURU_SAATLERI = {
    // Mesleki ve Teknik Anadolu Lisesi haftalık ders çizelgesi (ortak dersler)
    mtal: { "turk-dili-ve-edebiyati": { "10": 4, "11": 4, "12": 4 } }
  };
  BEP.okulTuruSaati = function (bep) {
    var d = bep.ders || {};
    if (!d.id || d.id === "__ozel__") return null;
    var plan = BEP.planBul(BEP.dersBul(d.id), d.planId);
    var t = OKUL_TURU_SAATLERI[bep.okul && bep.okul.tur];
    return (plan && t && t[d.id] && t[d.id][plan.sinif]) || null;
  };

  /* Elle girilen (meslek dersi vb.) ders için sentetik plan */
  BEP.ozelPlanOlustur = function (oz) {
    var uniteler = (oz.uniteler || []).filter(function (u) { return tr.bosluk(u.ad); });
    var saat = Math.max(1, parseInt(oz.saat, 10) || 2);
    if (!uniteler.length) uniteler = [{ ad: "1. Ünite", saat: 1, kazanimlar: "" }];
    var toplam = uniteler.reduce(function (t, u) { return t + (parseInt(u.saat, 10) || 1); }, 0);
    var paylar = uniteler.map(function (u) { return (parseInt(u.saat, 10) || 1) / toplam * 36; });
    var tam = paylar.map(function (x) { return Math.max(1, Math.floor(x)); });
    var top = function () { return tam.reduce(function (a, b) { return a + b; }, 0); };
    while (top() < 36) { var i = 0, en = -1; paylar.forEach(function (p, k) { if (p - tam[k] > en) { en = p - tam[k]; i = k; } }); tam[i]++; }
    while (top() > 36) { var j = 0, b = -99; paylar.forEach(function (p, k) { if (tam[k] > 1 && tam[k] - p > b) { b = tam[k] - p; j = k; } }); tam[j]--; }
    var haftalar = [], h = 1;
    uniteler.forEach(function (u, ui) {
      var kazanimlar = String(u.kazanimlar || "").split(/\n+/).map(function (x) { return tr.bosluk(x.replace(/^[-•*\d.)\s]+/, "")); }).filter(Boolean);
      for (var k = 0; k < tam[ui]; k++) {
        var hf = { h: h, s: saat, u: [ui] };
        if (kazanimlar.length) {
          var a = Math.floor(k * kazanimlar.length / tam[ui]);
          var bb = Math.max(a + 1, Math.floor((k + 1) * kazanimlar.length / tam[ui]));
          var sec2 = kazanimlar.slice(a, bb);
          hf.c = sec2.map(function (x) { return ["", x]; });
          hf.b = sec2.map(function (x) { return tr.cumleSonu(tr.yeterliliktenGenisZamana(x) || x); });
          if (k === 0) hf.k = "";
        }
        haftalar.push(hf);
        h++;
      }
    });
    haftalar.push({ h: 37, s: 0, x: "SE" });
    return {
      id: "ozel", sinif: oz.sinif || "", okul: "genel", etiket: "Öğretmen tarafından girilen içerik", program: "OZEL", saat: saat,
      kaynak: "Ders Bilgi Formu / çerçeve öğretim programından öğretmen tarafından girilmiştir.",
      uniteler: uniteler.map(function (u) { return { ad: tr.up(tr.bosluk(u.ad)) }; }), haftalar: haftalar
    };
  };

  /* ----------------------------------------------------------------- bağlam */
  function profilleri(bep) {
    var ids = (bep.ogrenci && bep.ogrenci.yetersizlik) || [];
    if (!ids.length) ids = ["diger"];
    return ids.map(BEP.yetersizlikBul);
  }

  /* Destek düzeyi tanıya göre otomatik belirlenir; birden fazla tanıda en yoğun olanı esas alınır */
  var DESTEK_SIRASI = { hafif: 1, orta: 2, yogun: 3 };
  function otomatikDestek(profiller) {
    return profiller.reduce(function (en, p) {
      var d = p.varsayilanDestek || "orta";
      return DESTEK_SIRASI[d] > DESTEK_SIRASI[en] ? d : en;
    }, "hafif");
  }
  BEP.otomatikDestek = function (bep) { return otomatikDestek(profilleri(bep)); };

  BEP.baglam = function (bep) {
    var ozel = bep.ders && bep.ders.id === "__ozel__";
    var ders = ozel ? { id: "__ozel__", ad: tr.bosluk(bep.ders.ozel && bep.ders.ozel.ad) || "Meslek Dersi", grup: "Meslek" } : BEP.dersBul(bep.ders && bep.ders.id);
    var plan = ozel ? BEP.ozelPlanOlustur(bep.ders.ozel || {}) : BEP.planBul(ders, bep.ders && bep.ders.planId);
    var profiller = profilleri(bep);
    var ayar = bep.ayarlar || {};
    var olcut = BEP.OLCUTLER.filter(function (o) { return o.id === (ayar.olcut || "80"); })[0] || BEP.OLCUTLER[0];
    var ad = tr.ilkAd(bep.ogrenci && bep.ogrenci.ad);
    var ozne = ayar.ozne === "ogrenci" ? "Öğrenci" : ayar.ozne === "yok" ? "" : (ad || "Öğrenci");
    return {
      bep: bep, ders: ders, plan: plan, profil: profiller[0], profiller: profiller,
      grup: ozel ? "mes" : BEP.dersGrubu(ders && ders.id),
      program: plan ? plan.program : "TYMM",
      destek: ayar.destek || otomatikDestek(profiller),
      olcut: olcut.metin, ozne: ozne, ad: ad || "Öğrenci",
      dil: ders && ders.id === "ingilizce" ? "en" : "tr",
      saat: parseInt(bep.ders && bep.ders.saat, 10) || (!ozel && BEP.okulTuruSaati(bep)) || (plan && plan.saat) || 2,
      sinavHaftalari: (ayar.sinavHaftalari || [8, 16, 25, 33]).map(Number)
    };
  };

  /* ----------------------------------------------------------------- yardımcı metinler */
  function uniteSadeAd(ad, dil) {
    var s = tr.bosluk(ad);
    s = s.replace(/^\d+(\.\d+)?\.?\s*(TEMA|ÜNİTE|Tema|Ünite|THEME|Theme|UNIT|Unit)?\s*\d*\s*[:\-–]?\s*/, "");
    s = s.replace(/^(THEME|Theme|UNIT|Unit)\s*\d+\s*[:\-–]\s*/, "");
    s = s.replace(/\s*\(\d\)\s*$/, "").replace(/[\s\-–:;,]+$/, "");
    return tr.baslikDuzeni(s, dil);
  }
  BEP.uniteSadeAd = uniteSadeAd;

  function konuSade(k) {
    if (!k) return "";
    var s = String(k).split(" | ")[0];
    s = s.replace(/^(Okuma|Yazma|Konuşma|Dinleme\/İzleme|Dinleme|Sözlü İletişim|Dil Bilgisi)\s*:\s*/, "");
    s = s.replace(/^Sub-themes:\s*/i, "");
    return tr.bosluk(s);
  }

  /* "Gerçek Sayıların Üslü…" gibi başlık biçimli konuları tırnak içinde, cümle biçimlileri küçük harfle ver */
  function konuIfadesi(k) {
    var s = tr.bosluk(k).replace(/[.;:…]+$/, "");
    var kelimeler = s.split(" ").filter(function (w) { return /^[A-Za-zÇĞİÖŞÜçğıöşü]/.test(w) && w.length > 3; });
    var buyuk = kelimeler.filter(function (w) { return /^[A-ZÇĞİÖŞÜ]/.test(w); }).length;
    if (kelimeler.length && buyuk / kelimeler.length >= 0.6) return "“" + s + "”";
    return tr.ilkHarfKucuk(s);
  }

  /* Programdaki süreç bileşenleri çok soyut kaldığında kullanılacak somut BEP davranışları */
  var SOMUT_SABLON = {
    mat: ["{konu} konusuyla ilgili basit örnek işlemleri adım adım yapar", "{konu} konusundaki temel kavramları örnekleriyle eşleştirir", "{konu} konusuyla ilgili günlük yaşamdan basit bir problemi çözer"],
    fen: ["{konu} konusunun temel kavramlarını görsel ve somut örneklerle açıklar", "{konu} konusundaki kavramları tanımlarıyla eşleştirir", "{konu} konusuyla ilgili basit bir gözlem veya deney sonucunu söyler"],
    sos: ["{konu} konusundaki temel bilgileri kısa cümlelerle açıklar", "{konu} konusuyla ilgili kavramları örnekleriyle eşleştirir", "{konu} konusundaki olayları/olguları zaman şeridi veya harita üzerinde gösterir"],
    cog: ["{konu} konusundaki temel kavramları harita ve görsellerle açıklar", "{konu} konusuyla ilgili kavramları örnekleriyle eşleştirir", "{konu} konusundaki bilgileri harita üzerinde gösterir"],
    fel: ["{konu} konusundaki temel kavramları günlük yaşamdan örneklerle açıklar", "{konu} konusuyla ilgili kavramları tanımlarıyla eşleştirir", "{konu} konusu hakkındaki görüşünü bir gerekçeyle kısaca ifade eder"],
    din: ["{konu} konusundaki temel bilgileri kısa cümlelerle açıklar", "{konu} konusuyla ilgili kavramları örnekleriyle eşleştirir", "{konu} konusundaki temel mesajı günlük yaşamla ilişkilendirerek söyler"],
    kur: ["{konu} konusunda model okumayı takip ederek kısa bölümleri okur", "{konu} konusundaki kısa bölümleri tekrar ederek ezberler"],
    bes: ["{konu} konusundaki temel hareketleri model eşliğinde uygular", "{konu} konusuyla ilgili oyun kurallarına uyarak etkinliğe katılır"],
    gor: ["{konu} konusuyla ilgili basit bir çalışmayı model ve şablon desteğiyle yapar", "{konu} konusundaki temel kavramları örnek görsellerle eşleştirir"],
    muz: ["{konu} konusuyla ilgili kısa bir ezgi veya ritmi model eşliğinde uygular", "{konu} konusundaki temel kavramları örneklerle eşleştirir"],
    mes: ["{konu} konusundaki temel bilgileri kısa cümlelerle açıklar", "{konu} konusuyla ilgili uygulamayı adım kartlarıyla yapar", "{konu} konusunda iş güvenliği kurallarına uyarak basit bir uygulama yapar"],
    tde: ["{konu} konusuyla ilgili sadeleştirilmiş bir metni okuyarak konusunu ve ana fikrini söyler"]
  };

  var KOLAY_FIIL = /(belirler|bulur|söyler|okur|yazar|eşleştirir|gösterir|sıralar|tanır|ayırt eder|açıklar|örnek verir|örneklendirir|hesaplar|çizer|ölçer|sınıflandırır|listeler|tamamlar|kullanır|uygular|tanımlar|ifade eder|fark eder|anlatır|adlandırır|seçer|inceler|dinler|izler|özetler|gruplandırır|yapar|sorar|tespit eder|bilir)\.?$/;
  var ZOR_FIIL = /(sorgular|değerlendirir|analiz eder|eleştir|yapılandırır|geneller|çıkarım|sentez|tartışır|yorumlar|ilişkilendirir|karar verir|önerme|varsayım|ortadan kaldırır|gerekçelendir|savunur|tasarlar|test eder|muhakeme|hipotez|kanıt|argüman|yansıtır|stratejisini|yöntem ve strateji)/;

  function davranisPuani(t, i, kullanilan, destek) {
    var p = 0;
    if (KOLAY_FIIL.test(t)) p += 6;
    if (ZOR_FIIL.test(t)) p -= destek === "hafif" ? 2 : 7;
    p -= Math.max(0, t.length - 110) / 12;
    p -= i * 0.6; // programdaki sıralamaya saygı
    if (kullanilan[t]) p -= 25;
    if (/…\.?$/.test(t)) p -= 30; // kaynakta kısaltılmış (yarım) cümle
    if (t.length > 150) p -= 12;
    return p;
  }
  function davranisSec(adaylar, kullanilan, destek) {
    var enIyi = null, enPuan = -1e9;
    adaylar.forEach(function (a, i) {
      var t = tr.bosluk(a);
      if (t.length < 10) return;
      var p = davranisPuani(t, i, kullanilan, destek);
      if (p > enPuan) { enPuan = p; enIyi = t; }
    });
    return enIyi ? { metin: enIyi, puan: enPuan } : null;
  }

  /* Bir hafta için seçilebilecek KDA davranış seçenekleri (arayüzde "başka öneri" listesi) */
  BEP.davranisSecenekleri = function (bep, haftaNo) {
    var ctx = BEP.baglam(bep);
    if (!ctx.plan) return [];
    var hv = null;
    ctx.plan.haftalar.forEach(function (h) { if (h.h === haftaNo) hv = h; });
    if (!hv) return [];
    var out = [];
    (hv.b || []).forEach(function (b) { out.push(b); });
    (hv.c || []).forEach(function (c) { var g = tr.yeterliliktenGenisZamana(c[1]); if (g) out.push(tr.cumleSonu(g)); });
    var konu = konuSade(hv.k);
    if (konu) (SOMUT_SABLON[ctx.grup] || SOMUT_SABLON.mes).forEach(function (s) { out.push(tr.cumleSonu(tr.ilkHarfBuyuk(s.replace("{konu}", konuIfadesi(konu))))); });
    return benzersiz(out.map(function (x) { return tr.cumleSonu(tr.bosluk(x)); }));
  };
  BEP.kdaCumlesiOlustur = function (bep, davranis, haftaIndeks) {
    var ctx = BEP.baglam(bep);
    return kdaCumlesi(ctx, kosulSec(ctx, haftaIndeks || 0), davranis);
  };

  function kdaCumlesi(ctx, kosul, davranis) {
    var d = tr.ilkHarfKucuk(String(davranis).replace(/[.\s]+$/, ""));
    var govde = (kosul ? kosul + " " : "") + d;
    var s = ctx.ozne ? ctx.ozne + ", " + govde : tr.ilkHarfBuyuk(govde);
    s += ".";
    if (ctx.olcut) s += " (Ölçüt: " + ctx.olcut + ")";
    return s;
  }

  /* Aynı davranış sonraki haftalarda tekrar edildiğinde ipucu aşamalı olarak azaltılır (ipucunun silikleştirilmesi) */
  var IPUCU_AZALTMA = {
    yogun: ["öğretmen model olduğunda", "sözel ve görsel ipucu verildiğinde", "görsel ipuçlarıyla desteklendiğinde", "kısa bir sözel ipucu verildiğinde"],
    orta: ["görsel ipuçlarıyla desteklendiğinde", "kısa bir sözel ipucu verildiğinde", "bağımsız olarak", "farklı örneklerle çalışırken bağımsız olarak"],
    hafif: ["kısa bir ipucu verildiğinde", "bağımsız olarak", "farklı örneklerle çalışırken bağımsız olarak"]
  };
  function azaltilmisKosul(ctx, tekrar, onceki) {
    var l = IPUCU_AZALTMA[ctx.destek] || IPUCU_AZALTMA.orta;
    var i = Math.min(tekrar, l.length) - 1;
    if (onceki) {
      var j = l.indexOf(onceki);
      if (j >= 0 && j >= i) i = Math.min(j + 1, l.length - 1);
    }
    return l[Math.max(0, i)];
  }

  function kosulSec(ctx, i) {
    var p = ctx.profil;
    var liste = (p.kosul && p.kosul[ctx.destek]) || (p.kosul && p.kosul.orta) || [];
    return sec(liste, i);
  }

  var DIL_SABLON = {
    kelime: "“{tema}” temasına ait en az beş temel kelimeyi görsel kartlarla eşleştirir",
    dinleme: "“{tema}” temasıyla ilgili kısa ve yavaş seslendirilen bir metinde geçen temel kelimeleri işaretler",
    okuma: "“{tema}” temasıyla ilgili görselli kısa bir metni okuyarak evet/hayır sorularını yanıtlar",
    konusma: "“{tema}” temasıyla ilgili model diyalogdaki kalıpları kullanarak kısa bir diyalog kurar",
    yazma: "“{tema}” temasıyla ilgili model cümleleri kullanarak iki-üç basit cümle yazar",
    oryantasyon: "derste sık kullanılan sınıf içi kalıpları ve selamlaşma ifadelerini kullanır",
    tekrar: "önceki yıllarda öğrendiği temel kelime ve kalıpları oyun ve görsel kartlarla tekrar eder",
    degerlendirme: "önceki temalarda öğrendiği kelime ve kalıpları değerlendirme etkinliklerinde kullanır"
  };
  var DIL_DONGU = ["kelime", "dinleme", "okuma", "konusma", "yazma"];

  var TDE_SABLON = {
    yazma: "“{unite}” {tur} kapsamında verilen yazma şablonunu kullanarak üç-dört cümlelik bir metin yazar",
    konusma: "“{unite}” {tur} kapsamında hazırlık yaptığı bir-iki dakikalık kısa bir konuşmayı sınıf önünde sunar",
    dilbilgisi: "metinden seçilen cümlelerde temel yazım ve noktalama kurallarını doğru uygular",
    okuma: "“{unite}” {tur} kapsamındaki sadeleştirilmiş bir metni okuyarak konusunu ve ana fikrini söyler",
    dinleme: "dinlediği kısa bir metnin konusunu ve ana düşüncesini söyler"
  };

  /* ----------------------------------------------------------------- yıllık plan üretimi */
  BEP.planUret = function (bep) {
    var ctx = BEP.baglam(bep);
    if (!ctx.plan) return { satirlar: [], uniteler: [], hata: "Seçilen ders/sınıf için plan verisi bulunamadı." };
    var plan = ctx.plan;
    var takvim = BEP.takvimHaftalari(bep.egitimYili || "2026-2027");
    var grupVeri = BEP.DERS_GRUPLARI[ctx.grup] || BEP.DERS_GRUPLARI.mes;
    var haftaVeri = {};
    plan.haftalar.forEach(function (h) { haftaVeri[h.h] = h; });

    var udaNo = {}, kdaSayac = {}, kullanilan = {}, sonKosul = {}, uniteHaftalari = {};
    var siradakiUda = 1;
    var oncekiKda = "", oncekiUnite = null;
    var sinavSirasi = {};
    ctx.sinavHaftalari.slice().sort(function (a, b) { return a - b; }).forEach(function (h, i) {
      var donem = h <= 18 ? 1 : 2;
      sinavSirasi[h] = donem + ". DÖNEM " + ((i % 2) + 1) + ". BEP YAZILI SINAVI";
    });
    // dönem içindeki sırayı doğru hesapla
    (function () {
      var d1 = ctx.sinavHaftalari.filter(function (h) { return h <= 18; }).sort(function (a, b) { return a - b; });
      var d2 = ctx.sinavHaftalari.filter(function (h) { return h > 18; }).sort(function (a, b) { return a - b; });
      sinavSirasi = {};
      d1.forEach(function (h, i) { sinavSirasi[h] = "1. DÖNEM " + (i + 1) + ". BEP YAZILI SINAVI"; });
      d2.forEach(function (h, i) { sinavSirasi[h] = "2. DÖNEM " + (i + 1) + ". BEP YAZILI SINAVI"; });
    })();

    var satirlar = [];
    var haftaIndeks = 0;
    takvim.forEach(function (t) {
      if (t.tur === "tatil") {
        satirlar.push({ tur: "tatil", ay: t.ay, tarih: t.tarih, ad: t.ad, aciklama: t.aciklama, alt: t.alt });
        return;
      }
      haftaIndeks++;
      var hv = haftaVeri[t.no] || { h: t.no, x: "DEVAM" };
      var satir = { tur: "hafta", ay: t.ay, no: t.no, tarih: t.tarih, donem: t.donem, saat: String(ctx.saat), notlar: t.notlar };
      var ui = hv.u && hv.u.length ? hv.u[0] : oncekiUnite;
      var unite = ui !== null && ui !== undefined ? plan.uniteler[ui] : null;
      var beceri = BEP.beceriSez(ctx.grup, hv);
      var ozel = hv.x;

      // ---- ÜNİTE VE KONULAR
      var uniteMetni = unite ? unite.ad : "";
      if (hv.u && hv.u.length > 1) uniteMetni = hv.u.map(function (i) { return plan.uniteler[i].ad; }).join(" / ");
      var konu = hv.k ? tr.kisalt(String(hv.k).split(" | ")[0], 95) : "";
      if (ozel === "OTP") { uniteMetni = "OKUL TEMELLİ PLANLAMA"; konu = "Zümrece belirlenen okul temelli etkinlikler (okuma, proje, gözlem vb.)"; }
      if (ozel === "SE") { uniteMetni = "SOSYAL ETKİNLİK HAFTASI"; konu = t.no === 37 ? "Yıl sonu sosyal etkinlikleri ve BEP genel değerlendirmesi" : "Sosyal etkinlikler"; satir.saat = t.no === 37 ? "—" : satir.saat; }
      if (ozel === "ZEN") konu = "Zenginleştirme etkinliği (tema kapsamında)";
      if (ozel === "DEVAM" && !konu) konu = "Önceki haftanın konularının pekiştirilmesi";
      satir.unite = uniteMetni + (konu ? "\n• " + konu : "");

      // ---- UDA / KDA
      var kda = "", udaEtiket = "";
      if (ozel === "OTP") {
        kda = kdaCumlesi(ctx, kosulSec(ctx, haftaIndeks), "zümre öğretmenler kurulunca belirlenen okul temelli planlama etkinliğine görev paylaşımıyla katılır");
      } else if (ozel === "SE") {
        kda = t.no === 37
          ? (ctx.ozne ? ctx.ozne + ", " : "") + (ctx.ozne ? "sınıf ve okul düzeyindeki sosyal etkinliklere akranlarıyla birlikte katılır; yıl boyunca edindiği becerileri sergiler." : "Sınıf ve okul düzeyindeki sosyal etkinliklere akranlarıyla birlikte katılır.")
          : kdaCumlesi(ctx, "", "sınıf ve okul düzeyindeki sosyal etkinliklere akranlarıyla birlikte katılır");
      } else if (unite) {
        if (!udaNo[ui]) { udaNo[ui] = siradakiUda++; kdaSayac[ui] = 0; }
        uniteHaftalari[ui] = uniteHaftalari[ui] || [];
        uniteHaftalari[ui].push({ no: t.no, donem: t.donem, k: hv.k, c: hv.c });
        kdaSayac[ui]++;
        udaEtiket = "UDA " + udaNo[ui] + " / KDA " + udaNo[ui] + "." + kdaSayac[ui] + ": ";
        var kosul = kosulSec(ctx, haftaIndeks + (ui || 0));
        var davranis = null;
        if (ozel === "DEVAM" || ozel === "ZEN") {
          davranis = ozel === "ZEN" ? "tema kapsamındaki zenginleştirme etkinliğine sadeleştirilmiş bir görevle ve akran desteğiyle katılır"
            : "önceki haftada çalışılan amaca yönelik pekiştirme etkinliklerini tamamlar";
        } else if (ctx.grup === "ing" || ctx.grup === "arp") {
          var temaAd = uniteSadeAd(unite.ad, ctx.dil);
          var bec = sec(DIL_DONGU, kdaSayac[ui] - 1);
          if (/ORIENTATION/i.test(unite.ad)) bec = "oryantasyon";
          else if (/REVISION|TEKRAR/i.test(unite.ad)) bec = "tekrar";
          else if (/EVALUATION|DEĞERLENDİRME/i.test(unite.ad) || ozel === "DEG") bec = "degerlendirme";
          davranis = DIL_SABLON[bec].replace("{tema}", temaAd);
        } else {
          var adaylar = (hv.b && hv.b.length) ? hv.b.slice() : [];
          if (!adaylar.length && hv.c) {
            hv.c.forEach(function (c) {
              var g = tr.yeterliliktenGenisZamana(c[1]);
              if (g) adaylar.push(g);
              else if (/r\.?$/.test(tr.bosluk(c[1]))) adaylar.push(c[1]);
            });
          }
          var secim = davranisSec(adaylar, kullanilan, ctx.destek);
          var konuAd = konuSade(hv.k);
          if (/(r|z)\.?$/.test(konuAd)) konuAd = ""; // konu alanında cümle (kazanım) varsa konu olarak kullanma
          var turAd = BEP.birimTuru(ctx.ders && ctx.ders.id, ctx.program, unite.ad) === "tema" ? "teması" : "ünitesi";
          var uygun = secim && !/…\.?$/.test(secim.metin) && secim.metin.length <= 150;
          if (secim && kullanilan[secim.metin] && (uygun || !konuAd)) {
            // Tüm adaylar önceki haftalarda kullanılmış: aynı davranış, azaltılmış ipucuyla
            davranis = secim.metin;
            kosul = azaltilmisKosul(ctx, kullanilan[secim.metin], sonKosul[secim.metin]);
          } else if (secim && (secim.puan >= 0 || (ctx.destek === "hafif" && uygun) || !konuAd)) {
            davranis = secim.metin;
          } else if (ctx.grup === "tde") {
            davranis = (TDE_SABLON[beceri] || TDE_SABLON.okuma).replace("{unite}", uniteSadeAd(unite.ad)).replace("{tur}", turAd);
            if (kullanilan[tr.bosluk(davranis)]) kosul = azaltilmisKosul(ctx, kullanilan[tr.bosluk(davranis)], sonKosul[tr.bosluk(davranis)]);
          } else if (konuAd) {
            var sablonlar = SOMUT_SABLON[ctx.grup] || SOMUT_SABLON.mes;
            davranis = sec(sablonlar, kdaSayac[ui] - 1).replace("{konu}", konuIfadesi(tr.kisalt(konuAd, 80)));
            if (kullanilan[tr.bosluk(davranis)]) davranis = sec(sablonlar, kdaSayac[ui]).replace("{konu}", konuIfadesi(tr.kisalt(konuAd, 80)));
            if (kullanilan[tr.bosluk(davranis)]) kosul = azaltilmisKosul(ctx, kullanilan[tr.bosluk(davranis)], sonKosul[tr.bosluk(davranis)]);
          } else {
            davranis = "“" + uniteSadeAd(unite.ad) + "” " + turAd + " kapsamındaki temel kavramları örneklerle açıklar";
          }
        }
        kullanilan[tr.bosluk(davranis)] = (kullanilan[tr.bosluk(davranis)] || 0) + 1;
        sonKosul[tr.bosluk(davranis)] = kosul;
        kda = udaEtiket + kdaCumlesi(ctx, kosul, davranis);
      } else {
        kda = kdaCumlesi(ctx, kosulSec(ctx, haftaIndeks), "önceki haftalarda çalışılan amaçları pekiştirir");
      }
      satir.kda = kda;
      satir.udaNo = unite && udaNo[ui] ? udaNo[ui] : null;
      if (unite) oncekiUnite = ui;
      oncekiKda = kda;

      // ---- Resmî öğrenme çıktısı / kazanım (müfredat sütunlu düzen için)
      if (hv.c && hv.c.length) {
        satir.cikti = (hv.c[0][0] ? hv.c[0][0] + ". " : "") + tr.kisalt(hv.c[0][1], 140) + (hv.c.length > 1 ? "\n(+" + (hv.c.length - 1) + " öğrenme çıktısı/kazanım daha)" : "");
      } else {
        satir.cikti = ozel === "OTP" ? "Okul temelli planlama" : ozel === "SE" ? "—" : (konu || "—");
      }

      // ---- Yöntem ve teknikler
      var yGrup = grupVeri.yontem[beceri] || grupVeri.yontem.genel;
      var yontemler = benzersiz([sec(ctx.profil.yontem, haftaIndeks), sec(yGrup, haftaIndeks), sec(yGrup, haftaIndeks + 1), sec(grupVeri.yontem.genel, haftaIndeks + 2)]).slice(0, 3);
      if (ozel === "OTP") yontemler = ["Proje Tabanlı Öğrenme", "İş Birlikli Öğrenme", "Akran Desteği"];
      if (ozel === "SE") yontemler = ["Gösteri / Sergi", "Akran Desteği", "Olumlu Pekiştirme"];
      satir.yontem = yontemler.map(function (y) { return "• " + y; }).join("\n");

      // ---- Araç-gereç
      var mGrup = grupVeri.materyal[beceri] || grupVeri.materyal.genel;
      var araclar = benzersiz([sec(mGrup, haftaIndeks), sec(mGrup, haftaIndeks + 1), sec(ctx.profil.materyal, haftaIndeks)]).slice(0, 3);
      if (ozel === "OTP") araclar = ["Görselli Etkinlik Yönergesi", "Kontrol Listesi", "Akıllı Tahta"];
      if (ozel === "SE") araclar = ["Etkinlik Materyalleri", "Öğrenci Ürün Dosyası"];
      satir.arac = araclar.map(function (y) { return "• " + y; }).join("\n");

      // ---- Ölçme-değerlendirme ve açıklamalar
      var olcme = [];
      var resmi = (hv.o || []).map(function (o) { return BEP.OLCME_DONUSUM[o] || o; });
      var adayO = benzersiz(resmi.concat([sec(BEP.VARSAYILAN_OLCME, haftaIndeks)]));
      olcme.push(sec(adayO, haftaIndeks));
      if (ozel === "SE" && t.no === 37) olcme = ["Yıl sonu BEP genel değerlendirmesi", "BEP izleme çizelgesinin tamamlanması"];
      if (ozel === "OTP") olcme = ["Katılım gözlem formu"];
      var sinav = sinavSirasi[t.no];
      var satirlarO = olcme.map(function (x) { return "• " + x; });
      if (sinav) satirlarO.unshift("• " + sinav + "\n(BEP amaçlarına göre uyarlanmış)");
      (hv.g || []).forEach(function (g) { satirlarO.push("• " + g); });
      (t.notlar || []).forEach(function (n) { satirlarO.push("• " + n); });
      satir.olcme = satirlarO.join("\n");
      satir.sinav = !!sinav;
      satirlar.push(satir);
    });

    // ---- UDA listesi (izleme çizelgesi)
    var udalar = [];
    Object.keys(udaNo).forEach(function (ui) {
      ui = +ui;
      var haftalar = uniteHaftalari[ui] || [];
      var donemler = benzersiz(haftalar.map(function (h) { return h.donem; }));
      udalar.push({ no: udaNo[ui], uniteIndeks: ui, unite: plan.uniteler[ui].ad, metin: BEP.udaMetni(ctx, plan.uniteler[ui], haftalar), donemler: donemler,
        ilkHafta: haftalar.length ? haftalar[0].no : 0, sonHafta: haftalar.length ? haftalar[haftalar.length - 1].no : 0 });
    });
    udalar.sort(function (a, b) { return a.no - b.no; });
    return { satirlar: satirlar, udalar: udalar, plan: plan, ctx: ctx };
  };

  /* Uzun dönemli amaç (her ünite/tema için bir UDA) */
  BEP.udaMetni = function (ctx, unite, haftalar) {
    var ad = uniteSadeAd(unite.ad, ctx.dil);
    var tur = BEP.birimTuru(ctx.ders && ctx.ders.id, ctx.program, unite.ad) === "tema" ? "teması" : "ünitesi";
    var ozne = ctx.ozne ? ctx.ozne + ", " : "";
    var baslat = function (s) { return ctx.ozne ? ozne + s : tr.ilkHarfBuyuk(s); };
    if (ctx.grup === "tde") {
      if (ctx.program === "2018") {
        if (/^GİRİŞ$/i.test(tr.up(ad))) return baslat("edebiyatın diğer disiplinlerle ilişkisini ve dilin tarihsel gelişimini sadeleştirilmiş metinler ve örnekler üzerinden açıklar.");
        return baslat("“" + ad + "” ünitesindeki sadeleştirilmiş metinleri okur; türün temel özelliklerini örnekler üzerinden açıklar ve bu türde kısa metinler oluşturur.");
      }
      return baslat("“" + ad + "” temasındaki sadeleştirilmiş metinleri okur ve dinler; metinlerle ilgili duygu ve düşüncelerini kısa sözlü ve yazılı ifadelerle anlatır.");
    }
    if (ctx.grup === "ing" || ctx.grup === "arp") {
      if (/ORIENTATION/i.test(unite.ad)) return baslat("derste sık kullanılan sınıf içi kalıpları, selamlaşma ve tanışma ifadelerini kullanır.");
      if (/REVISION/i.test(unite.ad)) return baslat("önceki yıllarda öğrendiği temel kelime ve kalıpları (" + ad + ") oyun ve görsel kartlarla pekiştirir.");
      if (/EVALUATION/i.test(unite.ad)) return baslat("önceki temalarda öğrendiği kelime ve kalıpları değerlendirme etkinliklerinde kullanır.");
      return baslat("“" + ad + "” temasına ait temel kelime ve kalıpları dinleme, konuşma, okuma ve yazma etkinliklerinde görsel destekle kullanır.");
    }
    if (ctx.grup === "bes") return baslat("“" + ad + "” " + tur + " kapsamındaki hareket, oyun ve sağlıklı yaşam becerilerini bireysel düzeyine uygun biçimde uygular.");
    if (ctx.grup === "gor" || ctx.grup === "muz") return baslat("“" + ad + "” " + tur + " kapsamındaki temel sanat becerilerini model ve uygulama desteğiyle kullanır.");
    var konular = benzersiz((haftalar || []).map(function (h) { return konuSade(h.k); })).filter(function (k) { return k && k.length < 120; });
    if (konular.length) {
      var liste = konular.slice(0, 2).map(function (k) { return konuIfadesi(k); });
      var metin = liste.join(" ve ");
      var ek = " konularındaki";
      if (metin.length > 150) { metin = konuIfadesi(tr.kisalt(konular[0], 140)); ek = " konusundaki"; }
      else if (liste.length === 1) ek = " konusundaki";
      return baslat("“" + ad + "” " + tur + " kapsamında " + metin + ek + " temel kavram ve becerileri bireysel düzeyine uygun destekle kazanır.");
    }
    return baslat("“" + ad + "” " + tur + " kapsamındaki temel kavram ve becerileri bireysel düzeyine uygun destekle kazanır.");
  };

  /* İzleme çizelgesi satırları */
  BEP.izlemeSatirlari = function (udalar) {
    return udalar.map(function (u) {
      var d1 = u.donemler.indexOf(1) >= 0, d2 = u.donemler.indexOf(2) >= 0;
      return { no: u.no, metin: u.metin, d1: d1 ? "[ ] Gerçekleşti\n[ ] Kısmen  [ ] Hayır" : "— (2. Dönem)", d2: d2 ? "[ ] Gerçekleşti\n[ ] Kısmen  [ ] Hayır" : "— (1. Dönem)", karar: "" };
    });
  };

  /* ----------------------------------------------------------------- uyarlamalar ve öneriler */
  BEP.varsayilanUyarlamalar = function (bep) {
    var profiller = profilleri(bep);
    var sinif = [], sinav = [], gorulen = {};
    profiller.forEach(function (p, i) {
      (p.sinif || []).forEach(function (u) {
        if (gorulen["s:" + u.baslik]) return;
        gorulen["s:" + u.baslik] = 1;
        sinif.push({ baslik: u.baslik, aciklama: u.aciklama, secili: i === 0 || sinif.length < 6 });
      });
      (p.sinav || []).forEach(function (u) {
        if (gorulen["n:" + u.baslik]) return;
        gorulen["n:" + u.baslik] = 1;
        sinav.push({ baslik: u.baslik, aciklama: u.aciklama, secili: i === 0 || sinav.length < 7 });
      });
    });
    return { sinif: sinif, sinav: sinav };
  };

  BEP.performansOnerileri = function (bep) {
    var ctx = BEP.baglam(bep);
    var ad = ctx.ad;
    var f = function (s) { return s.replace(/\{ad\}/g, ad); };
    var gelisim = [], guclu = [], destek = [];
    ctx.profiller.forEach(function (p) {
      (p.gelisim || []).forEach(function (x) { gelisim.push(f(x)); });
      (p.guclu || []).forEach(function (x) { guclu.push(f(x)); });
      (p.destek || []).forEach(function (x) { destek.push(f(x)); });
    });
    var grup = BEP.DERS_GRUPLARI[ctx.grup] || BEP.DERS_GRUPLARI.mes;
    var ders = (grup.performans || []).map(function (p) {
      return { etiket: p.etiket, secenekler: { yogun: p.yogun, orta: p.orta, hafif: p.hafif } };
    });
    return { gelisim: benzersiz(gelisim), guclu: benzersiz(guclu), destek: benzersiz(destek), ders: ders, destekDuzeyi: ctx.destek, alanEtiketi: grup.alanEtiketi };
  };

  /* Davranış özellikleri: davranış sorunu öne çıkan tanıların (DEHB, otizm, duygusal-davranış) ifadeleri
     önceliklidir; yoksa birincil tanının nötr ifadesi kullanılır. */
  function davranisMetni(profiller) {
    var sorunlu = profiller.filter(function (p) { return p.davranisSorunu && p.davranis; });
    var liste = sorunlu.length ? sorunlu : profiller.slice(0, 1);
    return benzersiz(liste.map(function (p) { return p.davranis || ""; })).map(function (x) { return "• " + x; }).join("\n");
  }

  BEP.varsayilanPerformans = function (bep) {
    var ctx = BEP.baglam(bep);
    var o = BEP.performansOnerileri(bep);
    var d = o.destekDuzeyi;
    var f = function (s) { return s.replace(/\{ad\}/g, ctx.ad); };
    // Birden fazla tanıda her tanının ifadelerinden sırayla pay alınır (birincil tanı önce)
    var sec = function (alan, n) {
      var listeler = ctx.profiller.map(function (p) { return (p[alan] || []).map(f); });
      var sonuc = [];
      for (var i = 0; i < 8 && sonuc.length < n; i++) {
        listeler.forEach(function (l) { if (l[i] && sonuc.length < n && sonuc.indexOf(l[i]) < 0) sonuc.push(l[i]); });
      }
      return sonuc;
    };
    var n = ctx.profiller.length > 1 ? 4 : 3;
    return {
      gelisim: sec("gelisim", n).map(function (x) { return "• " + x; }).join("\n"),
      ders: o.ders.map(function (p) { return "• " + p.etiket + ": " + p.secenekler[d]; }).join("\n"),
      guclu: sec("guclu", 3).map(function (x, i) { return (i + 1) + ". " + x; }).join("\n"),
      destek: sec("destek", n).map(function (x, i) { return (i + 1) + ". " + x; }).join("\n"),
      davranis: davranisMetni(ctx.profiller)
    };
  };

  /* Tablo 4.3 – BEP geliştirme birimi kararları (tanı, hizmet türü ve derse göre otomatik) */
  BEP.otomatikKararlar = function (bep) {
    var ctx = BEP.baglam(bep), o = bep.ogrenci || {};
    var V = BEP.VARSAYILAN_KARARLAR;
    var dersAd = ctx.ders ? String(ctx.ders.ad || "").replace(/\s*\((Seçmeli|AİHL)\)\s*$/, "") : "ilgili";
    var T = BEP.takvimBilgi(bep.egitimYili);
    var destekOdasi = /destek eğitim odası/i.test(o.hizmet || "")
      ? "Öğrenci, BEP geliştirme biriminin kararıyla " + dersAd + " dersi kapsamında destek eğitim odası hizmetinden yararlanacaktır. Haftalık süre ve sorumlu öğretmen ders programına göre birimce belirlenecek; sınıf içi amaçlar destek eğitim odasında pekiştirilecektir."
      : "Bu ders için destek eğitim odası hizmeti planlanmamıştır; ihtiyaç hâlinde BEP geliştirme birimince değerlendirilecektir.";
    var sorunlu = ctx.profiller.some(function (p) { return p.davranisSorunu; });
    var davranis = sorunlu
      ? "Öğrencinin sınıf içi davranışları olumlu davranış desteği yaklaşımıyla izlenecektir. Sınıf kuralları kısa ve görsel olarak sunulacak, uygun davranışlar anında pekiştirilecek, geçişler önceden haber verilecektir. Gözlem kayıtlarına göre gerektiğinde BEP geliştirme birimince davranış değiştirme programı hazırlanacaktır."
      : V.davranis;
    var kararlar = [
      { baslik: "Destek Eğitim Odası (Md. 20/1-b, 48/1-d)", aciklama: destekOdasi },
      { baslik: "Aile Bilgilendirme Süreci", aciklama: V.aileSiklik + " • " + V.aileYol + " • Veliye BEP amaçları ve dönem sonu değerlendirme sonuçları hakkında bilgi verilecektir." },
      { baslik: "Davranış Desteği (Md. 20/1-d)", aciklama: davranis }
    ];
    var muaf = BEP.muafiyetNotu(bep);
    if (muaf && ctx.ders && /ingilizce|arapca/.test(ctx.ders.id)) kararlar.push({ baslik: "Diğer Kararlar", aciklama: muaf });
    kararlar.push({ baslik: "Bir Sonraki BEP Birimi Toplantısı", aciklama: "1. dönem sonunda (" + T.birinciDonemSonu + " haftası) BEP amaçlarının gerçekleşme durumu değerlendirilecek; gerektiğinde daha erken toplanılacaktır." });
    return kararlar;
  };

  /* Yabancı dil muafiyeti hatırlatması (ÖEHY Md. 24/1-ç; OKY Md. 51/6) */
  BEP.muafiyetNotu = function (bep) {
    var ctx = BEP.baglam(bep);
    var uygun = ctx.profiller.some(function (p) { return p.yabanciDilMuafiyeti; });
    if (!uygun) return "";
    return "Öğrenci; işitme yetersizliği, zihinsel yetersizlik veya otizm tanısı nedeniyle velinin yazılı talebi ve BEP geliştirme biriminin kararı doğrultusunda yabancı dil dersinden muaf tutulabilir (Özel Eğitim Hizmetleri Yönetmeliği Md. 24/1-ç; Ortaöğretim Kurumları Yönetmeliği Md. 51/6).";
  };
})(typeof window !== "undefined" ? window : globalThis);

/* Plan, izleme ve varsayılan alanları BEP kaydına yazar (arayüz ve testler için) */
(function (kok) {
  "use strict";
  var BEP = kok.BEP;
  BEP.planiHazirla = function (bep, secenek) {
    secenek = secenek || {};
    var sonuc = BEP.planUret(bep);
    if (sonuc.hata) return sonuc;
    var eski = (bep.plan && bep.plan.satirlar) || [];
    if (secenek.duzenlemeleriKoru && eski.length) {
      var eskiHarita = {};
      eski.forEach(function (s) { if (s.tur === "hafta" && s.duzenlendi) eskiHarita[s.no] = s; });
      sonuc.satirlar = sonuc.satirlar.map(function (s) {
        var e = eskiHarita[s.no];
        if (!e || s.tur !== "hafta") return s;
        Object.keys(e.duzenlendi).forEach(function (alan) { if (e.duzenlendi[alan]) s[alan] = e[alan]; });
        s.duzenlendi = e.duzenlendi;
        return s;
      });
    }
    bep.plan = { satirlar: sonuc.satirlar, udalar: sonuc.udalar, imza: BEP.planImzasi(bep), olusturma: new Date().toISOString() };
    var eskiIzleme = {};
    (bep.izleme || []).forEach(function (u) { eskiIzleme[u.no] = u; });
    bep.izleme = BEP.izlemeSatirlari(sonuc.udalar).map(function (u) {
      var e = eskiIzleme[u.no];
      if (e && secenek.duzenlemeleriKoru && e.duzenlendi) { u.metin = e.metin; u.karar = e.karar; u.duzenlendi = true; }
      return u;
    });
    return sonuc;
  };
  /* Planı etkileyen seçimlerin imzası: değiştiğinde arayüz "planı yenile" uyarısı gösterir */
  BEP.planImzasi = function (bep) {
    var o = bep.ogrenci || {}, d = bep.ders || {}, a = bep.ayarlar || {};
    var imza = [d.id, d.planId, d.saat, d.id === "__ozel__" ? d.ozel : null, (o.yetersizlik || []).join(","), BEP.tr.ilkAd(o.ad), a.destek, a.olcut, a.ozne, (a.sinavHaftalari || []).join(",")];
    var okulSaat = BEP.okulTuruSaati(bep);
    if (okulSaat) imza.push("okul-saat:" + okulSaat); // yalnızca istisnada eklenir; mevcut planların imzası değişmez
    return JSON.stringify(imza);
  };
})(typeof window !== "undefined" ? window : globalThis);
