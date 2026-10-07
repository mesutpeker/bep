/*
 * BEP Hazırlama Aracı — İçerik üretici
 * Resmî çerçeve yıllık plan verisi + resmî takvim + öğrenci profili => BEP yıllık planı
 *
 * KDA yazımı ORGM (2022) kılavuzuna göre: birey (öğrencinin adı) + koşul + davranış (geniş zaman) + ölçüt.
 * UDA'lar ünite/temaya göre oluşturulur; uzun üniteler konularına göre bölünür, birkaç haftalık kısa
 * temalar birleştirilir. Aynı kazanım birden çok haftaya yayıldığında KDA'lar kademelendirilir:
 * ön koşul beceri → kazanım (tanıya özgü koşulla) → ara basamak → ipucu azaltma → genelleme.
 */
(function (kok) {
  "use strict";
  var BEP = (kok.BEP = kok.BEP || {});
  var tr = BEP.tr;

  function sec(liste, i) { return liste && liste.length ? liste[((i % liste.length) + liste.length) % liste.length] : ""; }
  function benzersiz(a) { var o = []; a.forEach(function (x) { if (x && o.indexOf(x) < 0) o.push(x); }); return o; }
  function kopyala(o, ek) { var x = {}; for (var k in o) x[k] = o[k]; if (ek) for (var e in ek) x[e] = ek[e]; return x; }
  /* ["a","b","c"] -> "a, b ve c" */
  function listeBirlestir(l) { return l.length < 2 ? (l[0] || "") : l.slice(0, -1).join(", ") + " ve " + l[l.length - 1]; }
  BEP.listeBirlestir = listeBirlestir;

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

  /* Okul türüne göre en uygun plan varyantı.
     secenek.hazirlik: okulda hazırlık sınıfı var (İngilizce için "hazırlık sınıfı bulunan liseler" planı) */
  BEP.planOner = function (ders, sinif, okulTuru, secenek) {
    if (!ders) return null;
    var adaylar = ders.planlar.filter(function (p) { return p.sinif === sinif; });
    if (!adaylar.length) return null;
    var tercih = { fen: ["fen", "anadolu", "genel"], sosyal: ["sosyal", "anadolu", "genel"], aihl: ["aihl", "anadolu", "genel"] }[okulTuru] || ["anadolu", "genel", "hazirliksiz"];
    if (ders.id === "ingilizce") tercih = (secenek && secenek.hazirlik) || sinif === "H" ? ["hazirlikli", "hazirliksiz"] : ["hazirliksiz", "hazirlikli"];
    for (var i = 0; i < tercih.length; i++) {
      for (var j = 0; j < adaylar.length; j++) if (adaylar[j].okul === tercih[i]) return adaylar[j].id;
    }
    return adaylar[0].id;
  };
  /* BEP kaydındaki okul bilgisine göre plan önerisi */
  BEP.planOnerBep = function (bep, sinif) {
    var okul = bep.okul || {};
    return BEP.planOner(BEP.dersBul(bep.ders && bep.ders.id), sinif, okul.tur, { hazirlik: !!okul.hazirlikSinifi });
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

  /* Elle girilen (meslek dersi vb.) ders için sentetik plan (36 öğretim haftası + 37. hafta sosyal etkinlik) */
  BEP.ozelPlanOlustur = function (oz) {
    var uniteler = (oz.uniteler || []).filter(function (u) { return tr.bosluk(u.ad); });
    var saat = Math.max(1, parseInt(oz.saat, 10) || 2);
    if (!uniteler.length) uniteler = [{ ad: "1. Ünite", saat: 1, kazanimlar: "" }];
    var kazanimListeleri = uniteler.map(function (u) {
      return String(u.kazanimlar || "").split(/\n+/).map(function (x) { return tr.bosluk(x.replace(/^[-•*\d.)\s]+/, "")); }).filter(Boolean);
    });
    var n = uniteler.length, haftalar = [];
    if (n > 36) {
      // 36'dan fazla öğrenme birimi: birimler haftalara sırayla paylaştırılır (bazı haftalarda iki birim)
      for (var w = 0; w < 36; w++) {
        var bas = Math.floor(w * n / 36), son = Math.floor((w + 1) * n / 36);
        var idx = [];
        for (var i = bas; i < son; i++) idx.push(i);
        var hf = { h: w + 1, s: saat, u: idx };
        // Çok birimli haftada her birimin ilk kazanımı sırayla (birim başına bir öğrenme çıktısı)
        var c = idx.map(function (ui) { return ["", kazanimListeleri[ui][0] || ""]; });
        if (c.some(function (x) { return x[1]; })) {
          hf.c = c.filter(function (x) { return x[1]; }).length === c.length ? c : c.filter(function (x) { return x[1]; });
          if (idx.length === 1) hf.b = hf.c.map(function (x) { return tr.cumleSonu(tr.yeterliliktenGenisZamana(x[1]) || x[1]); });
        }
        haftalar.push(hf);
      }
    } else {
      var toplam = uniteler.reduce(function (t, u) { return t + (parseInt(u.saat, 10) || 1); }, 0);
      var paylar = uniteler.map(function (u) { return (parseInt(u.saat, 10) || 1) / toplam * 36; });
      var tam = paylar.map(function (x) { return Math.max(1, Math.floor(x)); });
      var top = function () { return tam.reduce(function (a, b) { return a + b; }, 0); };
      while (top() < 36) { var ai = 0, en = -1; paylar.forEach(function (p, k) { if (p - tam[k] > en) { en = p - tam[k]; ai = k; } }); tam[ai]++; }
      while (top() > 36) { var j = -1, b = -99; paylar.forEach(function (p, k) { if (tam[k] > 1 && tam[k] - p > b) { b = tam[k] - p; j = k; } }); if (j < 0) break; tam[j]--; }
      var h = 1;
      uniteler.forEach(function (u, ui) {
        var kazanimlar = kazanimListeleri[ui];
        for (var k = 0; k < tam[ui]; k++) {
          var hf2 = { h: h, s: saat, u: [ui] };
          if (kazanimlar.length) {
            var a = Math.floor(k * kazanimlar.length / tam[ui]);
            var bb = Math.max(a + 1, Math.floor((k + 1) * kazanimlar.length / tam[ui]));
            var sec2 = kazanimlar.slice(a, bb);
            hf2.c = sec2.map(function (x) { return ["", x]; });
            hf2.b = sec2.map(function (x) { return tr.cumleSonu(tr.yeterliliktenGenisZamana(x) || x); });
          }
          haftalar.push(hf2);
          h++;
        }
      });
    }
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

  /* Geçerli sınav haftaları (öğretim haftaları içinde, tekrarsız ve sıralı) */
  BEP.sinavHaftalariTemiz = function (liste, sonHafta) {
    return benzersiz((liste || []).map(Number).filter(function (n) { return n >= 1 && n <= (sonHafta || 36); }).map(String))
      .map(Number).sort(function (a, b) { return a - b; });
  };

  BEP.baglam = function (bep) {
    var ozel = bep.ders && bep.ders.id === "__ozel__";
    var ders = ozel ? { id: "__ozel__", ad: tr.bosluk(bep.ders.ozel && bep.ders.ozel.ad) || "Meslek Dersi", grup: "Meslek" } : BEP.dersBul(bep.ders && bep.ders.id);
    var plan = ozel ? BEP.ozelPlanOlustur(bep.ders.ozel || {}) : BEP.planBul(ders, bep.ders && bep.ders.planId);
    var profiller = profilleri(bep);
    var ayar = bep.ayarlar || {};
    var olcut = BEP.OLCUTLER.filter(function (o) { return o.id === (ayar.olcut || "80"); })[0] || BEP.OLCUTLER[0];
    var ad = tr.ilkAd(bep.ogrenci && bep.ogrenci.ad);
    var ozne = ayar.ozne === "ogrenci" ? "Öğrenci" : ayar.ozne === "yok" ? "" : (ad || "Öğrenci");
    var T = BEP.takvimBilgi(bep.egitimYili);
    return {
      bep: bep, ders: ders, plan: plan, profil: profiller[0], profiller: profiller,
      grup: ozel ? "mes" : BEP.dersGrubu(ders && ders.id),
      program: plan ? plan.program : "TYMM",
      destek: ayar.destek || otomatikDestek(profiller),
      // Yalnız özel yetenek tanısı varsa plan zenginleştirme odaklıdır (ÖEHY Md. 19/2)
      zengin: profiller.every(function (p) { return p.zenginlestirme; }),
      olcut: olcut.metin, ozne: ozne, ad: ad || "Öğrenci",
      dil: ders && ders.id === "ingilizce" ? "en" : "tr",
      yil: T.egitimYili, takvim: T,
      saat: parseInt(bep.ders && bep.ders.saat, 10) || (!ozel && BEP.okulTuruSaati(bep)) || (plan && plan.saat) || 2,
      sinavHaftalari: BEP.sinavHaftalariTemiz(ayar.sinavHaftalari || [8, 16, 25, 33], T.sonOgretimHaftasi)
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
    // "TD.12.3. Ölçme", "4.2. Konu" gibi kod/numara önekleri (tek düzeyli "20. Yüzyıl" ve "I. Dünya" korunur)
    s = s.replace(/^[A-ZÇĞİÖŞÜ]{1,6}\.\d+(\.\d+)*\.?\s+/, "").replace(/^\d+(\.\d+)+\.?\s+/, "");
    // "OKUNACAK SURE VE AYETLER; İsra Suresi" -> bölüm başlığı (tamamı büyük harf) atılır
    var parca = s.split(/;\s+/);
    if (parca.length > 1 && !/[a-zçğıöşü]/.test(parca[0])) s = parca.slice(1).join("; ");
    // Uzun konu adlarında parantez içi ayrıntılar atılır: "Organik Moleküller (Karbohidratlar [Mono…" -> "Organik Moleküller"
    if (s.length > 90) s = s.replace(/\s*[(\[].*$/, "");
    return tr.bosluk(s);
  }

  /* Konu alanı bir kazanım/yeterlilik cümlesi mi? (konu adı değil) */
  function cumleMi(k) {
    var s = tr.bosluk(k);
    if (!s) return false;
    if (/[.!?]$/.test(s)) return true;
    var son = s.split(" ").pop();
    if (/(ebilme|abilme)$/.test(son)) return true;
    if (/^(eder|yapar|verir|olur|kurar|bulur|alır|gelir)$/.test(son)) return true;
    if (/(lar|ler)$/.test(son)) return false; // çoğul ad
    var kelimeler = s.split(" ").filter(function (w) { return w.length > 3 && /^[A-Za-zÇĞİÖŞÜçğıöşü]/.test(w); });
    var buyuk = kelimeler.filter(function (w) { return /^[A-ZÇĞİÖŞÜ]/.test(w); }).length;
    if (kelimeler.length && buyuk / kelimeler.length >= 0.6) return false; // başlık biçimi
    return /(ır|ir|ur|ür|ar|er)$/.test(son);
  }
  /* "X konusundaki …" şablonlarında kullanılabilecek bir konu adı mı? */
  function konuKullanilabilir(k) {
    var s = tr.bosluk(k);
    if (!s || s.length < 3 || s.length > 90) return false;
    if (/…|\.\.\./.test(s)) return false;
    if (s.split(" ").length > 12) return false;
    if (!/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(s)) return false;
    return !cumleMi(s);
  }
  BEP.konuKullanilabilir = konuKullanilabilir;

  /* "Gerçek Sayıların Üslü…" gibi başlık biçimli konuları tırnak içinde, cümle biçimlileri küçük harfle ver */
  function konuIfadesi(k) {
    var s = tr.bosluk(k).replace(/[.;:…]+$/, "");
    if (!/[a-zçğıöşü]/.test(s) && /[A-ZÇĞİÖŞÜ]{3}/.test(s)) s = tr.baslikDuzeni(s); // "İSTİKLÂL MARŞI" -> "İstiklâl Marşı"
    var kelimeler = s.split(" ").filter(function (w) { return /^[A-Za-zÇĞİÖŞÜçğıöşü]/.test(w) && w.length > 3; });
    var buyuk = kelimeler.filter(function (w) { return /^[A-ZÇĞİÖŞÜ]/.test(w); }).length;
    if (kelimeler.length && buyuk / kelimeler.length >= 0.6) return "“" + s + "”";
    return tr.ilkHarfKucuk(s);
  }

  /* Konu listesini UDA metnine uygun biçimde birleştirir: "“A” konusundaki" / "“A”, “B” ve “C” konularındaki" */
  function konuListesiIfadesi(konular, sinir) {
    var ifadeler = konular.map(konuIfadesi);
    if (ifadeler.length === 1) return ifadeler[0] + " konusundaki";
    var secilen = [], uzunluk = 0;
    for (var i = 0; i < ifadeler.length; i++) {
      if (secilen.length >= 2 && uzunluk + ifadeler[i].length > (sinir || 170)) break;
      secilen.push(ifadeler[i]);
      uzunluk += ifadeler[i].length + 2;
    }
    if (secilen.length < ifadeler.length) return secilen.join(", ") + " ve ilgili diğer konulardaki";
    return listeBirlestir(secilen) + " konularındaki";
  }

  /* Programdaki süreç bileşenleri çok soyut kaldığında kullanılacak somut BEP davranışları ("başka öneri" listesi) */
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

  /* Aynı kazanım birden çok haftaya yayıldığında kullanılan kademeli basamaklar:
     onkosul (ön koşul beceri), ara (ara basamak), genelleme (farklı/günlük yaşam durumuna aktarma) */
  var KADEME_SABLON = {
    mat: { onkosul: "{konu} konusundaki temel kavram ve sembolleri örnekleriyle eşleştirir", ara: "{konu} konusuyla ilgili basit örnek işlemleri adım adım yapar", genelleme: "{konu} konusuyla ilgili günlük yaşamdan basit bir problemi çözer" },
    fen: { onkosul: "{konu} konusundaki temel kavramları tanımlarıyla eşleştirir", ara: "{konu} konusunun temel kavramlarını görsel ve somut örneklerle açıklar", genelleme: "{konu} konusuyla ilgili basit bir gözlem veya deney sonucunu günlük yaşamdan bir örnekle ilişkilendirir" },
    sos: { onkosul: "{konu} konusundaki temel kavramları örnekleriyle eşleştirir", ara: "{konu} konusundaki temel bilgileri kısa cümlelerle açıklar", genelleme: "{konu} konusundaki olayları/olguları zaman şeridi veya harita üzerinde gösterir" },
    cog: { onkosul: "{konu} konusundaki temel kavramları harita ve görsellerle eşleştirir", ara: "{konu} konusundaki temel kavramları harita ve görsellerle açıklar", genelleme: "{konu} konusundaki bilgileri yakın çevresinden bir örnekle ilişkilendirir" },
    fel: { onkosul: "{konu} konusundaki temel kavramları tanımlarıyla eşleştirir", ara: "{konu} konusundaki temel kavramları günlük yaşamdan örneklerle açıklar", genelleme: "{konu} konusu hakkındaki görüşünü bir gerekçeyle kısaca ifade eder" },
    din: { onkosul: "{konu} konusundaki temel kavramları örnekleriyle eşleştirir", ara: "{konu} konusundaki temel bilgileri kısa cümlelerle açıklar", genelleme: "{konu} konusundaki temel mesajı günlük yaşamla ilişkilendirerek söyler" },
    kur: { onkosul: "{konu} konusundaki kısa bölümleri model okumayı dinleyerek tekrar eder", ara: "{konu} konusunda model okumayı takip ederek kısa bölümleri okur", genelleme: "{konu} konusundaki kısa bölümleri tekrar ederek ezberler" },
    bes: { onkosul: "{konu} konusundaki temel hareketlerin adlarını görselleriyle eşleştirir", ara: "{konu} konusundaki temel hareketleri model eşliğinde uygular", genelleme: "{konu} konusuyla ilgili oyun kurallarına uyarak etkinliğe katılır" },
    gor: { onkosul: "{konu} konusundaki temel kavramları örnek görsellerle eşleştirir", ara: "{konu} konusuyla ilgili basit bir çalışmayı model ve şablon desteğiyle yapar", genelleme: "{konu} konusuyla ilgili yaptığı çalışmayı kısaca tanıtır" },
    muz: { onkosul: "{konu} konusundaki temel kavramları örneklerle eşleştirir", ara: "{konu} konusuyla ilgili kısa bir ezgi veya ritmi model eşliğinde uygular", genelleme: "{konu} konusuyla ilgili dinlediği bir müzik örneğini kısaca anlatır" },
    mes: { onkosul: "{konu} konusundaki temel kavram ve araçları görselleriyle eşleştirir", ara: "{konu} konusuyla ilgili uygulamayı adım kartlarıyla yapar", genelleme: "{konu} konusunda iş güvenliği kurallarına uyarak basit bir uygulama yapar" },
    // Türk Dili ve Edebiyatı: konu alanları çoğunlukla kazanım cümlesidir; tema adı kullanılır
    tde: { onkosul: "{unite} {tur} kapsamındaki metinlerde geçen anahtar kelimelerin anlamlarını örnek cümlelerle eşleştirir", ara: null, genelleme: "{unite} {tur} kapsamında öğrendiklerini kısa bir sözlü ya da yazılı anlatımla paylaşır" }
  };
  /* Özel yetenekli öğrenci: basamaklar sadeleştirme yerine zenginleştirme içerir */
  var ZENGIN_SABLON = {
    onkosul: "{konu} konusuyla ilgili ileri düzey bir kaynağı inceleyerek temel düşüncelerini özetler",
    ara: "{konu} konusuyla ilgili bir araştırma sorusu oluşturarak bulgularını sunar",
    genelleme: "{konu} konusunu farklı bir disiplinle ilişkilendiren özgün bir ürün hazırlar"
  };
  var ZENGIN_SABLON_UNITE = {
    onkosul: "{unite} {tur} kapsamında ileri düzey bir kaynağı inceleyerek temel düşüncelerini özetler",
    ara: "{unite} {tur} kapsamında bir araştırma sorusu oluşturarak bulgularını sunar",
    genelleme: "{unite} {tur} kapsamında öğrendiklerini farklı bir disiplinle ilişkilendiren özgün bir ürün hazırlar"
  };

  var KOLAY_FIIL = /(belirler|bulur|söyler|okur|yazar|eşleştirir|gösterir|sıralar|tanır|ayırt eder|açıklar|örnek verir|örneklendirir|hesaplar|çizer|ölçer|sınıflandırır|listeler|tamamlar|kullanır|uygular|tanımlar|ifade eder|anlatır|adlandırır|seçer|dinler|izler|özetler|gruplandırır|yapar|sorar|tespit eder|çözer)\.?$/;
  var ZOR_FIIL = /(sorgular|değerlendirir|analiz eder|eleştir|yapılandırır|geneller|çıkarım|sentez|tartışır|yorumlar|ilişkilendirir|karar verir|önerme|varsayım|ortadan kaldırır|gerekçelendir|savunur|tasarlar|test eder|muhakeme|hipotez|kanıt|argüman|yansıtır|stratejisini|yöntem ve strateji)/;
  // Gözlemlenemeyen duyuşsal fiiller (ORGM: KDA gözlenebilir ve ölçülebilir olmalı)
  var DUYUSSAL_FIIL = /(benimser|önemser|takdir eder|değer verir|hisseder|sezer|duyarlılık gösterir|istekli olur|merak eder)\.?$/;
  /* Gözlemlenemeyen bilişsel fiilleri gözlemlenebilir karşılıklarına çevirir (yalnız cümle sonundaki fiil) */
  var GOZLENEMEZ = [
    [/ kavrar\.?$/, " açıklar"],
    [/ farkına varır\.?$/, " farkında olduğunu bir örnekle gösterir"],
    [/ fark eder\.?$/, " açıklar"],
    [/ bilir\.?$/, " söyler"],
    [/ anlar\.?$/, " açıklar"],
    [/ algılar\.?$/, " ayırt eder"],
    [/ inceler\.?$/, " inceleyerek bulgularını kısaca söyler"]
  ];
  function gozlenebilirYap(d) {
    var s = tr.bosluk(d).replace(/[.\s]+$/, "");
    for (var i = 0; i < GOZLENEMEZ.length; i++) if (GOZLENEMEZ[i][0].test(s)) return s.replace(GOZLENEMEZ[i][0], GOZLENEMEZ[i][1]);
    return s;
  }
  BEP.gozlenebilirYap = gozlenebilirYap;

  function davranisPuani(t, i, kullanilan, ctx) {
    var p = 0;
    if (KOLAY_FIIL.test(t)) p += ctx.zengin ? 2 : 6;
    if (ZOR_FIIL.test(t)) p += ctx.zengin ? 4 : (ctx.destek === "hafif" ? -2 : -7);
    if (DUYUSSAL_FIIL.test(t)) p -= 10;
    p -= Math.max(0, t.length - 110) / 12;
    p -= i * 0.6; // programdaki sıralamaya saygı
    if (kullanilan && kullanilan[t]) p -= 25;
    if (/…\.?$/.test(t)) p -= 30; // kaynakta kısaltılmış (yarım) cümle
    if (t.length > 150) p -= 12;
    return p;
  }

  /* Haftanın resmî verisinden KDA davranış adayları.
     Çok üniteli (geçiş) haftalarda ilk ünite süreç bileşenlerini (b) / ilk öğrenme çıktısını, sonraki üniteler kendi sıradaki öğrenme çıktısını alır. */
  function cevir(c) {
    // Öğrenme çıktısına eklenmiş "Zenginleştirme: …" / "Açıklama: …" notları davranışa katılmaz
    var t = tr.bosluk(c && c[1]).replace(/\s*(Zenginleştirme|Açıklama|Not)\s*\d*\s*:.*$/i, "");
    if (!t) return null;
    var g = tr.yeterliliktenGenisZamana(t) || (/r\.?$/.test(t) ? t : null);
    return g && g.length <= 220 ? g : null;
  }
  /* Davranış metninin başındaki kazanım kodu/madde numarasını temizler: "11.A.1. İstiklâl…", "MAT.H.4.3. …", "1.Peygamberi…" */
  function adayTemizle(x) {
    return tr.bosluk(x).replace(/^(?:[A-ZÇĞİÖŞÜ]{2,6}|\d{1,2})(?:\.[A-ZÇĞİÖŞÜ0-9]{1,4})+\.{0,2}\s+(?=\S)/, "")
      .replace(/^\d{1,2}\.(?=[A-ZÇĞİÖŞÜ][a-zçğıöşü])/, "");
  }
  function haftaAdaylari(hv, uniteSirasi) {
    var liste = [];
    var cok = (hv.u || []).length > 1;
    if (!cok || uniteSirasi === 0) {
      if (hv.b && hv.b.length) liste = hv.b.slice();
      else liste = (hv.c || []).slice(0, cok ? 1 : undefined).map(cevir);
    } else if (hv.c && hv.c[uniteSirasi]) liste = [cevir(hv.c[uniteSirasi])];
    return benzersiz(liste.filter(Boolean).map(function (x) { return gozlenebilirYap(adayTemizle(x)); })
      .filter(function (x) { return x.length >= 10 && !/…$/.test(x); }));
  }

  /* Bir hafta için seçilebilecek KDA davranış seçenekleri (arayüzde "başka öneri" listesi) */
  BEP.davranisSecenekleri = function (bep, haftaNo) {
    var ctx = BEP.baglam(bep);
    if (!ctx.plan) return [];
    var hv = null;
    ctx.plan.haftalar.forEach(function (h) { if (h.h === haftaNo) hv = h; });
    if (!hv) return [];
    var out = [];
    (hv.u && hv.u.length > 1 ? hv.u : [0]).forEach(function (u, j) { haftaAdaylari(hv, j).forEach(function (x) { out.push(x); }); });
    (hv.c || []).forEach(function (c) { var g = cevir(c); if (g) out.push(gozlenebilirYap(adayTemizle(g))); });
    var konu = konuSade(hv.k);
    if (konuKullanilabilir(konu)) {
      var k = KADEME_SABLON[ctx.grup] || KADEME_SABLON.mes;
      var sablonlar = (SOMUT_SABLON[ctx.grup] || SOMUT_SABLON.mes).concat(ctx.zengin ? [ZENGIN_SABLON.onkosul, ZENGIN_SABLON.ara, ZENGIN_SABLON.genelleme] : [k.onkosul, k.ara, k.genelleme]);
      sablonlar.filter(function (s) { return s && s.indexOf("{unite}") < 0; }).forEach(function (s) { out.push(s.replace("{konu}", konuIfadesi(konu))); });
    }
    return benzersiz(out.map(function (x) { return tr.cumleSonu(tr.ilkHarfBuyuk(tr.bosluk(x))); }));
  };
  BEP.kdaCumlesiOlustur = function (bep, davranis, haftaIndeks) {
    var ctx = BEP.baglam(bep);
    return kdaCumlesi(ctx, kosulSec(ctx, haftaIndeks || 0), davranis);
  };

  function kdaGovdesi(kosul, davranis) {
    return ((kosul ? kosul + " " : "") + tr.ilkHarfKucuk(String(davranis).replace(/[.\s]+$/, ""))).replace(/\s+/g, " ").trim();
  }
  function kdaCumlesi(ctx, kosul, davranis) {
    var govde = kdaGovdesi(kosul, davranis);
    var s = ctx.ozne ? ctx.ozne + ", " + govde : tr.ilkHarfBuyuk(govde);
    s += ".";
    if (ctx.olcut) s += " (Ölçüt: " + ctx.olcut + ")";
    return s;
  }

  /* Aynı davranış sonraki haftalarda tekrar edildiğinde ipucu aşamalı olarak azaltılır (ipucunun silikleştirilmesi) */
  var IPUCU_AZALTMA = {
    yogun: ["öğretmen model olduğunda", "sözel ve görsel ipucu verildiğinde", "görsel ipuçlarıyla desteklendiğinde", "kısa bir sözel ipucu verildiğinde"],
    orta: ["görsel ipuçlarıyla desteklendiğinde", "kısa bir sözel ipucu verildiğinde", "bağımsız olarak"],
    hafif: ["kısa bir ipucu verildiğinde", "bağımsız olarak"]
  };
  // Kazanımın sürdürülmesi ve genellenmesi için koşullar (tekrarları birbirinden ayırır)
  var BAKIM_KOSULLARI = ["günlük yaşamla ilişkili bir örnekte", "akranıyla eşli çalışırken", "kısa bir değerlendirme etkinliğinde", "önceki örnekleri gözden geçirdikten sonra"];
  // Bir kazanım koşusunun son basamağı (genelleme)
  function genellemeKosulu(ctx) { return ctx.zengin ? "farklı kaynakları karşılaştırarak" : ctx.destek === "yogun" ? "farklı örneklerle çalışırken kısa bir ipucu verildiğinde" : "farklı örneklerle çalışırken bağımsız olarak"; }
  var ZENGIN_KOSULLARI = ["bağımsız araştırma sürecinde", "akranlarına sunum hazırlarken", "farklı kaynakları karşılaştırarak"];
  var DEVAM_DAVRANISLARI = [
    "önceki haftalarda çalışılan amaca yönelik pekiştirme etkinliklerini tamamlar",
    "önceki haftalarda öğrendiklerini kısa bir uygulama etkinliğinde kullanır",
    "önceki haftalarda öğrendiklerini akranına bir örnekle açıklar",
    "önceki haftalarda öğrendiklerini kısa bir değerlendirme etkinliğinde gösterir"
  ];

  function kosulSec(ctx, i) {
    var p = ctx.profil;
    var liste = (p.kosul && p.kosul[ctx.destek]) || (p.kosul && p.kosul.orta) || [];
    return sec(liste, i);
  }
  function kosulListesi(ctx) {
    var p = ctx.profil;
    return (p.kosul && p.kosul[ctx.destek]) || (p.kosul && p.kosul.orta) || [];
  }

  var DIL_SABLON = {
    kelime: ["“{tema}” temasına ait en az beş temel kelimeyi görsel kartlarla eşleştirir", "“{tema}” temasına ait temel kelimeleri resimli bir sözlük etkinliğinde doğru görselle eşleştirir"],
    dinleme: ["“{tema}” temasıyla ilgili kısa ve yavaş seslendirilen bir metinde geçen temel kelimeleri işaretler", "“{tema}” temasıyla ilgili kısa bir dinleme metnini dinledikten sonra görsellerle ilgili evet/hayır sorularını yanıtlar"],
    okuma: ["“{tema}” temasıyla ilgili görselli kısa bir metni okuyarak evet/hayır sorularını yanıtlar", "“{tema}” temasıyla ilgili görselli kısa bir metinde geçen anahtar kelimeleri bulur"],
    konusma: ["“{tema}” temasıyla ilgili model diyalogdaki kalıpları kullanarak kısa bir diyalog kurar", "“{tema}” temasıyla ilgili görsel ipuçlarını kullanarak iki-üç kısa cümle söyler"],
    yazma: ["“{tema}” temasıyla ilgili model cümleleri kullanarak iki-üç basit cümle yazar", "“{tema}” temasıyla ilgili verilen kalıpta boşlukları uygun kelimelerle doldurur"],
    oryantasyon: ["derste sık kullanılan sınıf içi kalıpları ve selamlaşma ifadelerini kullanır", "kendini tanıtırken temel tanışma kalıplarını kullanır"],
    tekrar: ["önceki yıllarda öğrendiği temel kelime ve kalıpları oyun ve görsel kartlarla tekrar eder", "önceki yıllarda öğrendiği temel kelimeleri görsellerle eşleştirir", "önceki yıllarda öğrendiği kalıpları kullanarak kısa bir diyalog kurar", "önceki yıllarda öğrendiği kelimelerle iki-üç basit cümle yazar"],
    degerlendirme: ["önceki temalarda öğrendiği kelime ve kalıpları değerlendirme etkinliklerinde kullanır", "önceki temalarda öğrendiği kelimeleri görsellerle eşleştirerek değerlendirme etkinliğini tamamlar"]
  };
  var DIL_DONGU = ["kelime", "dinleme", "okuma", "konusma", "yazma"];
  function dilTuru(uniteAd, ozel) {
    if (/ORIENTATION|ORYANTASYON/i.test(uniteAd)) return "oryantasyon";
    if (/REVISION|TEKRAR/i.test(uniteAd)) return "tekrar";
    if (/EVALUATION|DEĞERLENDİRME/i.test(uniteAd) || ozel === "DEG") return "degerlendirme";
    return "";
  }

  var TDE_SABLON = {
    yazma: "“{unite}” {tur} kapsamında verilen yazma şablonunu kullanarak üç-dört cümlelik bir metin yazar",
    konusma: "“{unite}” {tur} kapsamında hazırlık yaptığı bir-iki dakikalık kısa bir konuşmayı sınıf önünde sunar",
    dilbilgisi: "metinden seçilen cümlelerde temel yazım ve noktalama kurallarını doğru uygular",
    okuma: "“{unite}” {tur} kapsamındaki sadeleştirilmiş bir metni okuyarak konusunu ve ana fikrini söyler",
    dinleme: "dinlediği kısa bir metnin konusunu ve ana düşüncesini söyler"
  };

  function turAdi(ctx, uniteAd) { return BEP.birimTuru(ctx.ders && ctx.ders.id, ctx.program, uniteAd) === "tema" ? "teması" : "ünitesi"; }

  /* ----------------------------------------------------------------- UDA bölümlemesi */
  /* Öğretim haftalarını ünitelerine göre UDA bölümlerine ayırır.
     - 10 haftadan uzun ünite (ör. öğrenme alanı olarak verilmiş "Sayılar ve Cebir") konu, gerekirse kazanım sınırlarından 3-6 haftalık bölümlere ayrılır.
     - En çok 2 haftalık ardışık kısa üniteler (ör. İngilizce temalar) 4 haftaya kadar birleştirilir. */
  /* Haftaları anahtar değişimlerinden 3-6 haftalık gruplara ayırır (en küçük grup 3 hafta) */
  function gruplaraBol(haftalar, anahtarFn) {
    var parcalar = [], cur = null;
    haftalar.forEach(function (h) {
      var anahtar = anahtarFn(h);
      if (!cur || (anahtar && cur.anahtar && anahtar !== cur.anahtar)) { cur = { anahtar: anahtar, haftalar: [] }; parcalar.push(cur); }
      if (!cur.anahtar && anahtar) cur.anahtar = anahtar;
      cur.haftalar.push(h);
    });
    var gruplar = [], g = [];
    parcalar.forEach(function (p) {
      if (g.length >= 3 && g.length + p.haftalar.length > 6) { gruplar.push(g); g = []; }
      g = g.concat(p.haftalar);
    });
    if (g.length) { if (g.length < 3 && gruplar.length) gruplar[gruplar.length - 1] = gruplar[gruplar.length - 1].concat(g); else gruplar.push(g); }
    return gruplar;
  }

  function udaBolumleri(ogretim) {
    var uniteHaftalari = {};
    ogretim.forEach(function (w, wi) {
      if (w.disi || w.ozel === "OTP" || w.ozel === "SE") return;
      var konular = String(w.hv.k || "").split(" | ");
      w.uniteler.forEach(function (ui, j) {
        (uniteHaftalari[ui] = uniteHaftalari[ui] || []).push({ wi: wi, no: w.t.no, ui: ui, konu: konuSade(konular[w.uniteler.length > 1 && konular[j] ? j : 0] || ""),
          aday: w.ozel === "DEVAM" || w.ozel === "ZEN" ? null : JSON.stringify(haftaAdaylari(w.hv, j)) });
      });
    });
    var bolumler = [];
    Object.keys(uniteHaftalari).map(Number).forEach(function (ui) {
      var W = uniteHaftalari[ui];
      if (W.length > 10) {
        // Önce konu sınırlarından, 10 haftadan uzun kalan gruplar kazanım değişimlerinden bölünür
        var gruplar = [];
        gruplaraBol(W, function (h) { return konuKullanilabilir(h.konu) ? tr.low(h.konu) : null; }).forEach(function (g) {
          if (g.length > 10) gruplar = gruplar.concat(gruplaraBol(g, function (h) { return h.aday && h.aday !== "[]" ? h.aday : null; }));
          else gruplar.push(g);
        });
        if (gruplar.length > 1) { gruplar.forEach(function (gh) { bolumler.push({ uniteler: [ui], haftalar: gh, bolunmus: true }); }); return; }
      }
      bolumler.push({ uniteler: [ui], haftalar: W, bolunmus: false });
    });
    bolumler.sort(function (a, b) { return a.haftalar[0].wi - b.haftalar[0].wi || a.uniteler[0] - b.uniteler[0]; });
    // Kısa ve ardışık üniteleri birleştir
    function haftaSayisi(hs) { return benzersiz(hs.map(function (h) { return String(h.wi); })).length; }
    function ardisik(hs) { var l = benzersiz(hs.map(function (h) { return String(h.wi); })).map(Number); return l[l.length - 1] - l[0] === l.length - 1; }
    var sonuc = [];
    bolumler.forEach(function (b) {
      var onceki = sonuc[sonuc.length - 1];
      var kisa = !b.bolunmus && haftaSayisi(b.haftalar) <= 2 && ardisik(b.haftalar);
      if (onceki && onceki.kisa && kisa) {
        var birlikte = onceki.haftalar.concat(b.haftalar);
        var oncekiSon = onceki.haftalar[onceki.haftalar.length - 1].wi;
        if (b.haftalar[0].wi <= oncekiSon + 1 && haftaSayisi(birlikte) <= 4) {
          onceki.uniteler = onceki.uniteler.concat(b.uniteler);
          onceki.haftalar = birlikte;
          return;
        }
      }
      b.kisa = kisa;
      sonuc.push(b);
    });
    // Tek haftalık ünite bölümü (başka bölümün içine düşen) komşu bölüme katılır: tek KDA'lı UDA oluşmaz
    var son2 = [];
    sonuc.forEach(function (b) {
      if (!b.bolunmus && haftaSayisi(b.haftalar) === 1) {
        var wi = b.haftalar[0].wi;
        var hedef = son2.concat(sonuc).filter(function (x) {
          return x !== b && x.haftalar.some(function (h) { return Math.abs(h.wi - wi) <= 1; });
        })[0];
        if (hedef) { hedef.uniteler = benzersiz(hedef.uniteler.concat(b.uniteler).map(String)).map(Number); hedef.haftalar = hedef.haftalar.concat(b.haftalar).sort(function (x, y) { return x.wi - y.wi; }); return; }
      }
      son2.push(b);
    });
    son2.forEach(function (b, i) { b.no = i + 1; });
    return son2;
  }

  /* Bir bölümdeki ardışık ve aynı adaylara sahip haftalar ("koşu") için KDA tanımları üretir */
  function kosuTanimlari(ctx, kosu, kullanilan, durum) {
    var n = kosu.haftalar.length;
    var sablonVar = kosu.sablonVar;
    // Her basamak şablonu bir UDA'da en çok bir kez: ön koşul ilk koşuda, genelleme son koşuda
    var onkosulOlur = sablonVar && durum.ilk && !durum.sablon.onkosul;
    var araOlur = sablonVar && !durum.sablon.ara;
    var genellemeOlur = sablonVar && durum.son && !durum.sablon.genelleme;
    var adaylar = kosu.adaylar.slice();
    // Yoğun/orta destekte zor kazanımlar, somut basamaklar varsa sadeleştirilir
    var uygun = adaylar.filter(function (a, i) { return ctx.zengin || ctx.destek === "hafif" || !sablonVar || davranisPuani(a, i, null, ctx) >= 0; });
    var yeni = uygun.filter(function (a) { return !kullanilan[a]; });
    var puanli = yeni.map(function (a) { return { a: a, p: davranisPuani(a, adaylar.indexOf(a), kullanilan, ctx), i: adaylar.indexOf(a) }; });
    var secilen = puanli.sort(function (x, y) { return y.p - x.p; }).slice(0, n)
      .sort(function (x, y) { return x.i - y.i; }).map(function (x) { return x.a; }); // programdaki sırayla
    var tanimlar = [];
    var ekstra = n - secilen.length;
    var tabanlar = secilen.length ? secilen : (uygun.length ? uygun : adaylar);
    if (onkosulOlur && (ekstra >= 2 || (!secilen.length && ekstra >= 1))) { tanimlar.push({ sablon: "onkosul" }); durum.sablon.onkosul = true; ekstra--; }
    else if (!secilen.length && ekstra >= 1) {
      // Yeni aday yoksa koşunun ilk basamağı ara basamak ya da kazanımın tanıya özgü koşulla yazımıdır (genelleme değil)
      if (araOlur) { tanimlar.push({ sablon: "ara" }); durum.sablon.ara = true; araOlur = false; }
      else if (tabanlar.length) tanimlar.push({ d: tabanlar[0] });
      ekstra--;
    }
    secilen.forEach(function (d) { tanimlar.push({ d: d }); kullanilan[d] = (kullanilan[d] || 0) + 1; });
    if (ekstra > 0) {
      var ek = [];
      if (araOlur && ekstra >= 2) ek.push({ sablon: "ara" });
      var ipuclari = ctx.zengin ? ZENGIN_KOSULLARI : (IPUCU_AZALTMA[ctx.destek] || IPUCU_AZALTMA.orta);
      ipuclari.concat(BAKIM_KOSULLARI).forEach(function (k) { tabanlar.forEach(function (d) { ek.push({ d: d, kosul: k }); }); });
      var son = genellemeOlur ? { sablon: "genelleme" } : (tabanlar.length ? { d: tabanlar[0], kosul: genellemeKosulu(ctx) } : null);
      var alinan = ek.slice(0, son ? ekstra - 1 : ekstra);
      if (alinan.some(function (x) { return x.sablon === "ara"; })) durum.sablon.ara = true;
      if (son && son.sablon) durum.sablon.genelleme = true;
      tanimlar = tanimlar.concat(alinan);
      if (son) tanimlar.push(son);
      while (tanimlar.length < n) tanimlar.push({ devam: true });
    }
    return tanimlar;
  }

  /* ----------------------------------------------------------------- yıllık plan üretimi */
  BEP.planUret = function (bep) {
    var ctx = BEP.baglam(bep);
    if (!ctx.plan) return { satirlar: [], udalar: [], hata: "Seçilen ders/sınıf için plan verisi bulunamadı." };
    var plan = ctx.plan;
    var T = ctx.takvim;
    var takvim = BEP.takvimHaftalari(ctx.yil);
    var grupVeri = BEP.DERS_GRUPLARI[ctx.grup] || BEP.DERS_GRUPLARI.mes;
    var dilGrubu = ctx.grup === "ing" || ctx.grup === "arp";
    var haftaVeri = {};
    plan.haftalar.forEach(function (h) { haftaVeri[h.h] = h; });
    var o = bep.ogrenci || {};
    var tarihGecerli = function (s) { return /^\d{4}-\d{2}-\d{2}$/.test(s || ""); };
    var bepBas = tarihGecerli(o.bepBaslangic) ? o.bepBaslangic : "", bepSon = tarihGecerli(o.bepBitis) ? o.bepBitis : "";

    // 1) Öğretim haftaları ve üniteleri
    var ogretim = [], wiNo = {}, onceki = null;
    takvim.forEach(function (t) {
      if (t.tur !== "hafta") return;
      var hv = haftaVeri[t.no] || { h: t.no, x: "DEVAM" };
      var uniteler = hv.u && hv.u.length ? hv.u.filter(function (i) { return plan.uniteler[i]; }) : [];
      if (!uniteler.length && onceki !== null && hv.x !== "OTP" && hv.x !== "SE") uniteler = [onceki];
      var disi = bepBas && t.cuma < bepBas ? "once" : bepSon && t.pazartesi > bepSon ? "sonra" : "";
      wiNo[t.no] = ogretim.length;
      ogretim.push({ t: t, hv: hv, uniteler: uniteler, ozel: hv.x, disi: disi });
      if (hv.u && hv.u.length) onceki = uniteler[uniteler.length - 1];
    });

    // 2) UDA bölümleri ve hafta -> bölüm eşlemesi
    var bolumler = udaBolumleri(ogretim);
    var haftaBolumleri = {};
    bolumler.forEach(function (b) {
      b.haftalar.forEach(function (h) {
        var l = haftaBolumleri[h.wi] = haftaBolumleri[h.wi] || [];
        if (!l.some(function (x) { return x.b === b; })) l.push({ b: b, ui: h.ui });
      });
    });
    Object.keys(haftaBolumleri).forEach(function (wi) {
      var w = ogretim[wi];
      haftaBolumleri[wi].sort(function (x, y) { return w.uniteler.indexOf(x.ui) - w.uniteler.indexOf(y.ui); });
    });

    // 3) Her bölüm için haftalık KDA tanımları
    var kullanilan = {}, dilSayac = {};
    bolumler.forEach(function (b) {
      b.tanimlar = {};
      var kosular = [], kosu = null;
      benzersiz(b.haftalar.map(function (h) { return String(h.wi); })).map(Number).forEach(function (wi) {
        var w = ogretim[wi], hv = w.hv;
        var ui = (haftaBolumleri[wi].filter(function (x) { return x.b === b; })[0] || {}).ui;
        var sira = Math.max(0, w.uniteler.indexOf(ui));
        var uniteAd = plan.uniteler[ui].ad;
        if (w.ozel === "DEVAM" || w.ozel === "ZEN") { kosu = null; b.tanimlar[wi] = { ozelHafta: w.ozel }; return; }
        if (dilGrubu) {
          kosu = null;
          var bec = dilTuru(uniteAd, w.ozel);
          var anahtar = bec || "u" + ui;
          var k = dilSayac[anahtar] = (dilSayac[anahtar] || 0) + 1;
          if (!bec) bec = DIL_DONGU[(k - 1) % DIL_DONGU.length];
          var varyant = bec === "oryantasyon" || bec === "tekrar" || bec === "degerlendirme" ? k - 1 : Math.floor((k - 1) / DIL_DONGU.length);
          b.tanimlar[wi] = { d: sec(DIL_SABLON[bec], varyant).replace("{tema}", uniteSadeAd(uniteAd, ctx.dil)) };
          return;
        }
        var adaylar = haftaAdaylari(hv, sira);
        var anahtarA = JSON.stringify(adaylar);
        var konu = konuSade(String(hv.k || "").split(" | ")[w.uniteler.length > 1 ? sira : 0] || "");
        if (!kosu || kosu.anahtar !== anahtarA) {
          kosu = { anahtar: anahtarA, adaylar: adaylar, haftalar: [], ui: ui };
          kosular.push(kosu);
        }
        kosu.haftalar.push({ wi: wi, konu: konu, ui: ui });
      });
      var durum = { sablon: {} };
      kosular.forEach(function (k, ki) {
        durum.ilk = ki === 0;
        durum.son = ki === kosular.length - 1;
        if (!b.odak && k.adaylar.length) b.odak = k.adaylar[0];
        // Ünite/konu adına dayalı kademeli basamaklar kullanılabilir mi?
        k.sablonVar = ctx.grup === "tde" || ctx.zengin || k.haftalar.some(function (h) { return konuKullanilabilir(h.konu); });
        if (!k.adaylar.length) {
          var ua = plan.uniteler[k.ui].ad;
          k.adaylar = [ctx.grup === "tde" ? TDE_SABLON.okuma.replace("{unite}", uniteSadeAd(ua)).replace("{tur}", turAdi(ctx, ua))
            : "“" + uniteSadeAd(ua, ctx.dil) + "” " + turAdi(ctx, ua) + " kapsamındaki temel kavramları örneklerle açıklar"];
        }
        kosuTanimlari(ctx, k, kullanilan, durum).forEach(function (tn, i) {
          var h = k.haftalar[i];
          tn.yedek = k.adaylar[0];
          tn.konu = h.konu;
          tn.ui = h.ui;
          b.tanimlar[h.wi] = tn;
        });
      });
    });

    function sablonDoldur(tur, tn) {
      var ua = plan.uniteler[tn.ui].ad;
      var konu = konuKullanilabilir(tn.konu) ? tn.konu : "";
      var kaynak;
      if (ctx.zengin) kaynak = konu ? ZENGIN_SABLON : ZENGIN_SABLON_UNITE;
      else kaynak = KADEME_SABLON[ctx.grup] || KADEME_SABLON.mes;
      var s = kaynak[tur];
      if (!s && tur === "ara" && ctx.grup === "tde") s = TDE_SABLON[tn.beceri] || TDE_SABLON.okuma;
      if (!s) return null;
      if (s.indexOf("{konu}") >= 0 && !konu) {
        if (ctx.grup === "tde") return null;
        s = s.replace("{konu} konusundaki", "{unite} {tur} kapsamındaki").replace("{konu} konusuyla ilgili", "{unite} {tur} kapsamında").replace("{konu} konusunun", "{unite} {tur} kapsamındaki konuların")
          .replace("{konu} konusunda", "{unite} {tur} kapsamında").replace("{konu} konusunu", "{unite} {tur} kapsamında öğrendiklerini").replace("{konu} konusu hakkındaki", "{unite} {tur} hakkındaki");
      }
      return s.replace("{konu}", konuIfadesi(konu)).replace("{unite}", "“" + uniteSadeAd(ua, ctx.dil) + "”").replace("{tur}", turAdi(ctx, ua));
    }

    // 4) Satırlar
    var sinavSirasi = {};
    var d1 = ctx.sinavHaftalari.filter(function (h) { return h <= T.donemSonHaftasi; });
    var d2 = ctx.sinavHaftalari.filter(function (h) { return h > T.donemSonHaftasi; });
    d1.forEach(function (h, i) { sinavSirasi[h] = "1. DÖNEM " + (i + 1) + ". BEP YAZILI SINAVI"; });
    d2.forEach(function (h, i) { sinavSirasi[h] = "2. DÖNEM " + (i + 1) + ". BEP YAZILI SINAVI"; });

    var satirlar = [], kdaSayac = {}, gorulen = {}, devamSayac = 0;
    var haftaIndeks = 0;
    var kosullar = kosulListesi(ctx);

    /* Koşul davranışla aynı şeyi söylüyorsa ("günlük yaşamla ilişkili bir örnekte … günlük yaşamdan …") kullanılmaz */
    function kosulYinelemesi(kosul, davranis) {
      var k = tr.low(kosul), d = tr.low(davranis);
      return [/günlük yaşam/, /akran/, /değerlendirme/, /örnek/, /ipucu/, /model/].some(function (r) { return r.test(k) && r.test(d); });
    }
    var kullanilanSablon = {};
    /* Aynı KDA metni planda ikinci kez kullanılmasın: koşul alternatifleriyle ayırt edilir */
    function benzersizKda(kosul, davranis) {
      var denenecek = [kosul].concat(ctx.zengin ? ZENGIN_KOSULLARI : BAKIM_KOSULLARI, [genellemeKosulu(ctx)], kosullar, ctx.zengin ? [] : (IPUCU_AZALTMA[ctx.destek] || []));
      for (var i = 0; i < denenecek.length; i++) {
        if (i > 0 && kosulYinelemesi(denenecek[i], davranis)) continue;
        var g = tr.low(kdaGovdesi(denenecek[i], davranis));
        if (!gorulen[g]) { gorulen[g] = 1; return { kosul: denenecek[i], davranis: davranis }; }
      }
      for (var j = 0; j < DEVAM_DAVRANISLARI.length * Math.max(1, kosullar.length); j++) {
        var dv = DEVAM_DAVRANISLARI[(devamSayac + j) % DEVAM_DAVRANISLARI.length], kv = sec(kosullar, Math.floor((devamSayac + j) / DEVAM_DAVRANISLARI.length));
        var g2 = tr.low(kdaGovdesi(kv, dv));
        if (!gorulen[g2]) { gorulen[g2] = 1; devamSayac += j + 1; return { kosul: kv, davranis: dv }; }
      }
      return { kosul: kosul, davranis: davranis };
    }

    takvim.forEach(function (t) {
      if (t.tur === "tatil") {
        satirlar.push({ tur: "tatil", ay: t.ay, tarih: t.tarih, ad: t.ad, aciklama: t.aciklama, alt: t.alt });
        return;
      }
      haftaIndeks++;
      var wi = wiNo[t.no], w = ogretim[wi], hv = w.hv, ozel = w.ozel;
      var satir = { tur: "hafta", ay: t.ay, no: t.no, tarih: t.tarih, donem: t.donem, saat: String(ctx.saat), notlar: t.notlar };
      var beceri = BEP.beceriSez(ctx.grup, hv);

      // ---- ÜNİTE VE KONULAR
      var uniteMetni = w.uniteler.map(function (i) { return plan.uniteler[i].ad; }).join(" / ");
      var konu = hv.k ? tr.kisalt(String(hv.k).split(" | ")[0], 95) : "";
      if (ozel === "OTP") { uniteMetni = "OKUL TEMELLİ PLANLAMA"; konu = "Zümrece belirlenen okul temelli etkinlikler (okuma, proje, gözlem vb.)"; }
      if (ozel === "SE") { uniteMetni = "SOSYAL ETKİNLİK HAFTASI"; konu = t.no === 37 ? "Yıl sonu sosyal etkinlikleri ve BEP genel değerlendirmesi" : "Sosyal etkinlikler"; satir.saat = t.no === 37 ? "—" : satir.saat; }
      if (ozel === "ZEN") konu = "Zenginleştirme etkinliği (tema kapsamında)";
      if (ozel === "DEVAM" && !konu) konu = "Önceki haftanın konularının pekiştirilmesi";
      satir.unite = uniteMetni + (konu ? "\n• " + konu : "");

      // ---- UDA / KDA
      var bh = haftaBolumleri[wi] || [];
      satir.udaNolari = [];
      satir.udaBasi = [];
      if (w.disi) {
        satir.bepDisi = w.disi;
        satir.kda = w.disi === "once" ? "— BEP başlangıç tarihinden önceki hafta (BEP amacı uygulanmaz)." : "— BEP bitiş tarihinden sonraki hafta (BEP amacı uygulanmaz).";
      } else if (ozel === "OTP") {
        satir.kda = kdaCumlesi(ctx, kosulSec(ctx, haftaIndeks), "zümre öğretmenler kurulunca belirlenen okul temelli planlama etkinliğine görev paylaşımıyla katılır");
      } else if (ozel === "SE") {
        satir.kda = t.no === 37
          ? (ctx.ozne ? ctx.ozne + ", " : "") + (ctx.ozne ? "sınıf ve okul düzeyindeki sosyal etkinliklere akranlarıyla birlikte katılır; yıl boyunca edindiği becerileri sergiler." : "Sınıf ve okul düzeyindeki sosyal etkinliklere akranlarıyla birlikte katılır.")
          : kdaCumlesi(ctx, "", "sınıf ve okul düzeyindeki sosyal etkinliklere akranlarıyla birlikte katılır");
      } else if (bh.length) {
        satir.kda = bh.map(function (x) {
          var b = x.b, tn = b.tanimlar[wi] || { devam: true, ui: x.ui };
          if (tn.ui === undefined) tn.ui = x.ui;
          kdaSayac[b.no] = (kdaSayac[b.no] || 0) + 1;
          var kosul = tn.kosul || kosulSec(ctx, haftaIndeks + (x.ui || 0)), davranis;
          if (tn.ozelHafta === "ZEN") davranis = ctx.zengin ? "tema kapsamındaki zenginleştirme etkinliğinde ileri düzey bir görevi bağımsız olarak tamamlar" : "tema kapsamındaki zenginleştirme etkinliğine sadeleştirilmiş bir görevle ve akran desteğiyle katılır";
          else if (tn.ozelHafta === "DEVAM" || tn.devam) davranis = sec(DEVAM_DAVRANISLARI, devamSayac++);
          else if (tn.sablon) {
            tn.beceri = beceri;
            davranis = sablonDoldur(tn.sablon, tn);
            // Aynı konu basamağı planda bir kez yazılır; tekrarında kazanımın kendisi bakım koşuluyla verilir
            if (davranis && kullanilanSablon[tr.low(davranis)]) { davranis = tn.yedek; kosul = sec(ctx.zengin ? ZENGIN_KOSULLARI : BAKIM_KOSULLARI, haftaIndeks); }
            if (davranis) kullanilanSablon[tr.low(davranis)] = 1;
          }
          else davranis = tn.d;
          if (!davranis) davranis = sec(DEVAM_DAVRANISLARI, devamSayac++);
          var r = benzersizKda(kosul, davranis);
          satir.udaNolari.push(b.no);
          if (b.haftalar[0].wi === wi) satir.udaBasi.push(b.no);
          return "UDA " + b.no + " / KDA " + b.no + "." + kdaSayac[b.no] + ": " + kdaCumlesi(ctx, r.kosul, r.davranis);
        }).join("\n");
      } else {
        satir.kda = kdaCumlesi(ctx, kosulSec(ctx, haftaIndeks), "önceki haftalarda çalışılan amaçları pekiştirir");
      }
      satir.udaNo = satir.udaNolari[0] || null;

      // ---- Resmî öğrenme çıktısı / kazanım (müfredat sütunu)
      if (hv.c && hv.c.length) {
        var gosterilen = bh.length > 1 ? hv.c.slice(0, bh.length) : hv.c.slice(0, 1);
        satir.cikti = gosterilen.map(function (c) { return (c[0] ? c[0] + ". " : "") + tr.kisalt(c[1], bh.length > 1 ? 100 : 140); }).join("\n") +
          (hv.c.length > gosterilen.length ? "\n(+" + (hv.c.length - gosterilen.length) + " öğrenme çıktısı/kazanım daha)" : "");
      } else {
        satir.cikti = ozel === "OTP" ? "Okul temelli planlama" : ozel === "SE" ? "—" : (konu || "—");
      }

      // ---- Yöntem ve teknikler
      var yGrup = grupVeri.yontem[beceri] || grupVeri.yontem.genel;
      var yontemler = benzersiz([sec(ctx.profil.yontem, haftaIndeks), sec(yGrup, haftaIndeks), sec(yGrup, haftaIndeks + 1), sec(grupVeri.yontem.genel, haftaIndeks + 2)]).slice(0, 3);
      if (ozel === "OTP") yontemler = ["Proje Tabanlı Öğrenme", "İş Birlikli Öğrenme", "Akran Desteği"];
      if (ozel === "SE") yontemler = ["Gösteri / Sergi", "Akran Desteği", "Olumlu Pekiştirme"];
      satir.yontem = yontemler.map(function (y) { return "• " + y; }).join("\n");

      // ---- Araç-gereç (özel yetenekli öğrencide sadeleştirilmiş materyal önerilmez)
      var mGrup = grupVeri.materyal[beceri] || grupVeri.materyal.genel;
      if (ctx.zengin) mGrup = mGrup.filter(function (m) { return !/Sade|Uyarlanmış|Büyük Puntolu|Somut|Kontrol Kartı/.test(m); });
      var araclar = benzersiz(ctx.zengin
        ? [sec(ctx.profil.materyal, haftaIndeks), sec(mGrup, haftaIndeks), sec(mGrup, haftaIndeks + 1)]
        : [sec(mGrup, haftaIndeks), sec(mGrup, haftaIndeks + 1), sec(ctx.profil.materyal, haftaIndeks)]).slice(0, 3);
      if (ozel === "OTP") araclar = ["Görselli Etkinlik Yönergesi", "Kontrol Listesi", "Akıllı Tahta"];
      if (ozel === "SE") araclar = ["Etkinlik Materyalleri", "Öğrenci Ürün Dosyası"];
      satir.arac = araclar.map(function (y) { return "• " + y; }).join("\n");

      // ---- Ölçme-değerlendirme ve açıklamalar (özel yetenekli öğrencide resmî araçlar sadeleştirilmez)
      var olcme = [];
      var resmi = (hv.o || []).map(function (x) { return ctx.zengin ? x : (BEP.OLCME_DONUSUM[x] || x); });
      var adayO = benzersiz(resmi.concat([ctx.zengin ? sec(["Proje değerlendirme ölçeği", "Ürün dosyası (portfolyo)", "Dereceli puanlama anahtarı"], haftaIndeks) : sec(BEP.VARSAYILAN_OLCME, haftaIndeks)]));
      olcme.push(sec(adayO, haftaIndeks));
      if (ozel === "SE" && t.no === 37) olcme = ["Yıl sonu BEP genel değerlendirmesi", "BEP izleme çizelgesinin tamamlanması"];
      if (ozel === "OTP") olcme = ["Katılım gözlem formu"];
      var sinav = w.disi ? "" : sinavSirasi[t.no];
      var satirlarO = olcme.map(function (x) { return "• " + x; });
      if (sinav) satirlarO.unshift("• " + sinav + "\n(BEP amaçlarına göre uyarlanmış)");
      (hv.g || []).forEach(function (g) { satirlarO.push("• " + g); });
      (t.notlar || []).forEach(function (n) { satirlarO.push("• " + n); });
      satir.olcme = satirlarO.join("\n");
      satir.sinav = !!sinav;
      satirlar.push(satir);
    });

    // ---- UDA listesi (izleme çizelgesi)
    // Aynı metne sahip UDA'lar (aynı konunun kazanımlara bölünmüş parçaları) odak kazanımla ayırt edilir
    var metinler = {};
    bolumler.forEach(function (b) { b.metin = BEP.udaMetni(ctx, b, plan); metinler[b.metin] = (metinler[b.metin] || 0) + 1; });
    bolumler.forEach(function (b) { if (metinler[b.metin] > 1 && b.odak) b.metin += " Odak kazanım: " + tr.cumleSonu(tr.ilkHarfKucuk(b.odak)); });
    var udalar = bolumler.map(function (b) {
      var haftalar = benzersiz(b.haftalar.map(function (h) { return String(h.wi); })).map(function (wi) { return ogretim[wi]; });
      return {
        no: b.no, uniteIndeks: b.uniteler[0], uniteler: b.uniteler.slice(),
        unite: benzersiz(b.uniteler.map(function (ui) { return plan.uniteler[ui].ad; })).join(" / "),
        metin: b.metin,
        donemler: benzersiz(haftalar.map(function (w) { return String(w.t.donem); })).map(Number),
        ilkHafta: haftalar.length ? haftalar[0].t.no : 0, sonHafta: haftalar.length ? haftalar[haftalar.length - 1].t.no : 0
      };
    });
    return { satirlar: satirlar, udalar: udalar, plan: plan, ctx: ctx };
  };

  /* Uzun dönemli amaç (her UDA bölümü için): bölümdeki ünite/tema ve konuların tamamını kapsar */
  BEP.udaMetni = function (ctx, bolum, plan) {
    var uniteAdlari = benzersiz(bolum.uniteler.map(function (ui) { return plan.uniteler[ui].ad; }));
    var sade = uniteAdlari.map(function (a) { return uniteSadeAd(a, ctx.dil); });
    var tema = BEP.birimTuru(ctx.ders && ctx.ders.id, ctx.program, uniteAdlari[0]) === "tema";
    var tekil = sade.length === 1;
    var adIf = listeBirlestir(sade.map(function (s) { return "“" + s + "”"; }));
    var turEk = tekil ? (tema ? "teması" : "ünitesi") : (tema ? "temaları" : "üniteleri");
    var ozne = ctx.ozne ? ctx.ozne + ", " : "";
    var baslat = function (s) { return ctx.ozne ? ozne + s : tr.ilkHarfBuyuk(s); };
    var konular = benzersiz(bolum.haftalar.map(function (h) { return h.konu; }).filter(konuKullanilabilir));
    if (ctx.grup === "ing" || ctx.grup === "arp") {
      var ozelParcalar = [], temalar = [];
      uniteAdlari.forEach(function (a, i) {
        var tur = dilTuru(a);
        if (tur === "oryantasyon") ozelParcalar.push("derste sık kullanılan sınıf içi kalıpları, selamlaşma ve tanışma ifadelerini kullanır");
        else if (tur === "tekrar") ozelParcalar.push("önceki yıllarda öğrendiği temel kelime ve kalıpları (" + sade[i] + ") oyun ve görsel kartlarla pekiştirir");
        else if (tur === "degerlendirme") ozelParcalar.push("önceki temalarda öğrendiği kelime ve kalıpları değerlendirme etkinliklerinde kullanır");
        else temalar.push(sade[i]);
      });
      if (temalar.length) {
        var tIf = listeBirlestir(temalar.map(function (s) { return "“" + s + "”"; }));
        ozelParcalar.push(tIf + (temalar.length > 1 ? " temalarına" : " temasına") + (ctx.zengin
          ? " ait kelime ve kalıpları ileri düzey dinleme, okuma ve üretim görevlerinde kullanır"
          : " ait temel kelime ve kalıpları dinleme, konuşma, okuma ve yazma etkinliklerinde görsel destekle kullanır"));
      }
      return baslat(benzersiz(ozelParcalar).join("; ") + ".");
    }
    if (ctx.zengin) {
      return baslat(adIf + " " + turEk + " kapsamında" + (konular.length ? " " + konuListesiIfadesi(konular) : "ki") + " kavram ve becerileri ileri düzey kaynaklar, araştırma ve proje görevleriyle derinleştirir.");
    }
    if (ctx.grup === "tde") {
      if (ctx.program === "2018") {
        if (tekil && /^GİRİŞ$/i.test(tr.up(sade[0]))) return baslat("edebiyatın diğer disiplinlerle ilişkisini ve dilin tarihsel gelişimini sadeleştirilmiş metinler ve örnekler üzerinden açıklar.");
        return baslat(adIf + " " + (tekil ? "ünitesindeki" : "ünitelerindeki") + " sadeleştirilmiş metinleri okur; türün temel özelliklerini örnekler üzerinden açıklar ve bu türde kısa metinler oluşturur.");
      }
      return baslat(adIf + " " + (tekil ? "temasındaki" : "temalarındaki") + " sadeleştirilmiş metinleri okur ve dinler; metinlerle ilgili duygu ve düşüncelerini kısa sözlü ve yazılı ifadelerle anlatır.");
    }
    var kapsam = adIf + " " + turEk + " kapsamında" + (konular.length ? " " + konuListesiIfadesi(konular) : "ki");
    if (ctx.grup === "bes") return baslat(kapsam + " hareket, oyun ve sağlıklı yaşam becerilerini bireysel düzeyine uygun biçimde uygular.");
    if (ctx.grup === "gor" || ctx.grup === "muz") return baslat(kapsam + " temel sanat becerilerini model ve uygulama desteğiyle kullanır.");
    return baslat(kapsam + " temel kavram ve becerileri bireysel düzeyine uygun destekle kazanır.");
  };

  /* İzleme çizelgesi satırları */
  BEP.izlemeSatirlari = function (udalar) {
    return udalar.map(function (u) {
      var d1 = u.donemler.indexOf(1) >= 0, d2 = u.donemler.indexOf(2) >= 0;
      return { no: u.no, unite: u.unite, metin: u.metin, d1: d1 ? "[ ] Gerçekleşti\n[ ] Kısmen  [ ] Hayır" : "— (2. Dönem)", d2: d2 ? "[ ] Gerçekleşti\n[ ] Kısmen  [ ] Hayır" : "— (1. Dönem)", karar: "" };
    });
  };

  /* ----------------------------------------------------------------- uyarlamalar ve öneriler */
  /* Tablo 4.1-4.2: Tüm tanıların uyarlamaları eklenir. Aynı başlıklı uyarlamalar birleştirilir; içerikleri farklıysa
     her tanının düzenlemesi tanı adıyla ayrı paragraf olarak korunur (ÖEHY Md. 20/1-ç, 24/1-b). */
  BEP.varsayilanUyarlamalar = function (bep) {
    var profiller = profilleri(bep);
    var o = bep.ogrenci || {};
    function taniAdi(p) { return p.id === "diger" && tr.bosluk(o.yetersizlikMetni) ? tr.bosluk(o.yetersizlikMetni) : tr.ilkHarfBuyuk(p.kisa); }
    function birlestir(alan) {
      var liste = [], dizin = {};
      profiller.forEach(function (p) {
        (p[alan] || []).forEach(function (u) {
          var x = dizin[u.baslik];
          if (!x) { x = dizin[u.baslik] = { baslik: u.baslik, parcalar: [] }; liste.push(x); }
          if (!x.parcalar.some(function (q) { return q.aciklama === u.aciklama; })) x.parcalar.push({ tani: taniAdi(p), aciklama: u.aciklama });
        });
      });
      return liste.map(function (x) {
        var aciklama = x.parcalar.length === 1 ? x.parcalar[0].aciklama : x.parcalar.map(function (q) { return q.tani + ": " + q.aciklama; }).join("\n");
        return { baslik: x.baslik, aciklama: aciklama, secili: true };
      });
    }
    return { sinif: birlestir("sinif"), sinav: birlestir("sinav") };
  };

  BEP.performansOnerileri = function (bep) {
    var ctx = BEP.baglam(bep);
    var grup = BEP.DERS_GRUPLARI[ctx.grup] || BEP.DERS_GRUPLARI.mes;
    var ders = (grup.performans || []).map(function (p) {
      return { etiket: p.etiket, secenekler: { yogun: p.yogun, orta: p.orta, hafif: p.hafif } };
    });
    return { ders: ders, destekDuzeyi: ctx.destek, alanEtiketi: grup.alanEtiketi };
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
      ders: o.ders.map(function (p) { return "• " + p.etiket + ": " + (ctx.zengin ? BEP.ZENGIN_PERFORMANS : p.secenekler[d]); }).join("\n"),
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
    var T = ctx.takvim;
    var destekOdasi = /destek eğitim odası/i.test(o.hizmet || "")
      ? "Öğrenci, BEP geliştirme biriminin kararıyla " + dersAd + " dersi kapsamında destek eğitim odası hizmetinden yararlanacaktır. Haftalık süre ve sorumlu öğretmen ders programına göre birimce belirlenecek (haftalık toplam ders saatinin %40'ını aşmayacak biçimde, ÖEHY Md. 25/1-a); sınıf içi amaçlar destek eğitim odasında pekiştirilecektir."
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
    if (ctx.zengin) kararlar.push({ baslik: "Zenginleştirme (Md. 19/2)", aciklama: "Öğrenciye bu derste ileri düzey kaynaklar, bağımsız araştırma ve proje görevleriyle zenginleştirilmiş öğretim sunulacak; gerektiğinde bilim ve sanat merkeziyle (BİLSEM) iş birliği yapılacaktır." });
    var muaf = BEP.muafiyetNotu(bep);
    if (muaf && ctx.ders && /ingilizce|arapca/.test(ctx.ders.id)) kararlar.push({ baslik: "Diğer Kararlar", aciklama: muaf });
    kararlar.push({ baslik: "Bir Sonraki BEP Birimi Toplantısı", aciklama: "1. dönem sonunda (" + T.birinciDonemSonu + " haftası) BEP amaçlarının gerçekleşme durumu değerlendirilecek; gerektiğinde daha erken toplanılacaktır." });
    return kararlar;
  };

  /* Yabancı dil muafiyeti hatırlatması (ÖEHY Md. 24/1-ç; OKY Md. 51/6): öğrencinin ilgili tanıları adıyla yazılır */
  BEP.muafiyetNotu = function (bep) {
    var ctx = BEP.baglam(bep);
    var adlar = benzersiz(ctx.profiller.filter(function (p) { return p.yabanciDilMuafiyeti; }).map(function (p) { return p.kisa; }));
    if (!adlar.length) return "";
    return "Öğrenci; " + listeBirlestir(adlar) + (adlar.length > 1 ? " tanıları" : " tanısı") + " nedeniyle velinin yazılı talebi ve BEP geliştirme biriminin kararı doğrultusunda yabancı dil dersinden muaf tutulabilir (Özel Eğitim Hizmetleri Yönetmeliği Md. 24/1-ç; Ortaöğretim Kurumları Yönetmeliği Md. 51/6).";
  };
})(typeof window !== "undefined" ? window : globalThis);

/* Plan, izleme ve varsayılan alanları BEP kaydına yazar (arayüz ve testler için) */
(function (kok) {
  "use strict";
  var BEP = kok.BEP;
  var ETIKET = /^UDA\s*\d+\s*\/\s*KDA\s*[\d.]+\s*:/;
  /* Planın hangi ders/plan için üretildiği: elle düzenlemeler yalnız aynı ders ve planda korunur */
  BEP.planKaynagi = function (bep) {
    var d = bep.ders || {};
    return JSON.stringify([d.id || "", d.id === "__ozel__" ? "" : (d.planId || "")]);
  };
  /* Korunan KDA hücresindeki "UDA x / KDA y:" etiketlerini yeni plandaki numaralarla günceller */
  function etiketleriGuncelle(eski, yeni) {
    var yeniEtiketler = String(yeni || "").split("\n").map(function (l) { return (l.match(ETIKET) || [""])[0]; }).filter(Boolean);
    var satirlar = String(eski || "").split("\n");
    var eskiSayisi = satirlar.filter(function (l) { return ETIKET.test(l); }).length;
    if (!yeniEtiketler.length || eskiSayisi !== yeniEtiketler.length) return eski;
    var k = 0;
    return satirlar.map(function (l) { return ETIKET.test(l) ? l.replace(ETIKET, yeniEtiketler[k++]) : l; }).join("\n");
  }
  BEP.planiHazirla = function (bep, secenek) {
    secenek = secenek || {};
    var sonuc = BEP.planUret(bep);
    if (sonuc.hata) return sonuc;
    var eski = (bep.plan && bep.plan.satirlar) || [];
    // Eski kayıtlarda kaynak bilgisi yoksa aynı ders kabul edilir (düzenlemeler kaybolmasın)
    var ayniKaynak = !bep.plan || !bep.plan.kaynak || bep.plan.kaynak === BEP.planKaynagi(bep);
    var duzenlemeVar = eski.some(function (s) { return s.duzenlendi && Object.keys(s.duzenlendi).length; }) || (bep.izleme || []).some(function (u) { return u.duzenlendi; });
    var koru = !!secenek.duzenlemeleriKoru && ayniKaynak;
    if (secenek.duzenlemeleriKoru && !ayniKaynak && duzenlemeVar) sonuc.duzenlemelerAtildi = true;
    if (koru && eski.length) {
      var eskiHarita = {};
      eski.forEach(function (s) { if (s.tur === "hafta" && s.duzenlendi) eskiHarita[s.no] = s; });
      sonuc.satirlar = sonuc.satirlar.map(function (s) {
        var e = eskiHarita[s.no];
        if (!e || s.tur !== "hafta") return s;
        Object.keys(e.duzenlendi).forEach(function (alan) {
          if (!e.duzenlendi[alan]) return;
          s[alan] = alan === "kda" ? etiketleriGuncelle(e[alan], s.kda) : e[alan];
        });
        s.duzenlendi = e.duzenlendi;
        return s;
      });
    }
    bep.plan = { satirlar: sonuc.satirlar, udalar: sonuc.udalar, imza: BEP.planImzasi(bep), kaynak: BEP.planKaynagi(bep), olusturma: new Date().toISOString() };
    var eskiIzleme = {};
    (bep.izleme || []).forEach(function (u) { eskiIzleme[u.no] = u; });
    bep.izleme = BEP.izlemeSatirlari(sonuc.udalar).map(function (u) {
      var e = eskiIzleme[u.no];
      // Elle yazılan UDA cümlesi, aynı numaralı UDA aynı üniteye aitse korunur
      if (e && koru && e.duzenlendi && (!e.unite || e.unite === u.unite)) { u.metin = e.metin; u.karar = e.karar; u.duzenlendi = true; }
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
    // BEP dönemi ders yılından dar ise (yıl içinde başlayan/biten BEP) haftalar etkilenir
    var T = BEP.takvimBilgi(bep.egitimYili);
    if ((o.bepBaslangic && o.bepBaslangic > T.dersBasiIso) || (o.bepBitis && o.bepBitis < T.dersSonuIso)) imza.push("bep:" + o.bepBaslangic + "/" + o.bepBitis);
    return JSON.stringify(imza);
  };
})(typeof window !== "undefined" ? window : globalThis);
