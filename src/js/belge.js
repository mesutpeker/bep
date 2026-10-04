/*
 * BEP Hazırlama Aracı — Belge modeli
 * BEP kaydından, hem Word (.docx) hem HTML önizleme için ortak bir belge modeli üretir.
 *
 * Biçim kuralları (BEP_Uygulama_Gelistirme_Rehberi.md ve örnek .docx):
 *   A4 yatay, kenar boşlukları 1,5 cm (sağ/sol) – 1,2 cm (üst/alt), tablo genişliği 26,2 cm (14852 dxa)
 *   MEB laciverti #1B365D başlıklar, #CBD5E1 iç çizgiler, ay sonlarında 2,5 pt lacivert çizgi
 *   Satır bölünme yasağı (cantSplit), başlık satırı tekrarı (tblHeader), ay bütünlüğü (keepNext)
 *   Sayfa kesmeleri ay sınırlarında, satır yükseklikleri tahmin edilerek dengeli dağıtılır.
 */
(function (kok) {
  "use strict";
  var BEP = (kok.BEP = kok.BEP || {});
  var tr = BEP.tr;

  var R = { lacivert: "1B365D", mavi: "2B6CB0", cizgi: "CBD5E1", etiket: "EDF2F7", zebra1: "F8FAFC", zebra2: "FFFFFF", tatil: "FEF3C7", tatilYazi: "92400E", yazi: "1A202C", gri: "4A5568", ustGri: "718096", beyaz: "FFFFFF" };
  var TABLO_GENISLIGI = 14852;
  var SAYFA = { w: 16838, h: 11906, ust: 680, alt: 680, sol: 850, sag: 850, ustBilgi: 284, altBilgi: 284 };
  BEP.SAYFA = SAYFA;
  BEP.RENK = R;

  var DUZENLER = {
    ornek: {
      ad: "Örnek belge düzeni (araç-gereç ayrı sütun)",
      genislikler: [850, 680, 1191, 510, 2154, 3798, 1814, 1701, 2154],
      basliklar: function (prog) { return ["AY", "HAFTA", "TARİH", "SAAT", "ÜNİTE / TEMA VE KONULAR", prog === "2018" ? "BEP KAZANIMLARI (UDA / KDA)" : "BEP AMAÇLARI (UDA / KDA)", "ÖĞRENME-ÖĞRETME YÖNTEM VE TEKNİKLERİ", "EĞİTİM TEKNOLOJİLERİ, ARAÇ VE GEREÇLER", "ÖLÇME-DEĞERLENDİRME VE AÇIKLAMALAR"]; },
      alanlar: ["ay", "hafta", "tarih", "saat", "unite", "kda", "yontem", "arac", "olcme"]
    },
    mufredat: {
      ad: "Müfredat çıktısı sütunlu düzen (rehberdeki 9 sütun)",
      genislikler: [850, 624, 1134, 454, 1928, 2665, 3515, 1928, 1754],
      basliklar: function (prog) { return ["AY", "HAFTA", "TARİH", "SAAT", "ÜNİTE / TEMA", prog === "2018" ? "KAZANIMLAR (MÜFREDAT)" : "ÖĞRENME ÇIKTILARI (MÜFREDAT)", "BEP AMAÇLARI (UDA / KDA)", "YÖNTEM, TEKNİK VE ARAÇ-GEREÇLER", "ÖLÇME-DEĞERLENDİRME VE AÇIKLAMALAR"]; },
      alanlar: ["ay", "hafta", "tarih", "saat", "unite", "cikti", "kda", "yontemArac", "olcme"]
    }
  };
  BEP.PLAN_DUZENLERI = DUZENLER;

  /* ------------------------------------------------------------ model yardımcıları */
  function run(t, o) { var x = { t: String(t == null ? "" : t) }; if (o) for (var k in o) x[k] = o[k]; return x; }
  function par(runs, o) { var x = { tip: "p", runs: runs }; if (o) for (var k in o) x[k] = o[k]; return x; }
  function hucre(paragraflar, o) { var x = { paragraflar: paragraflar }; if (o) for (var k in o) x[k] = o[k]; return x; }

  var TABLO_PAR = { before: 10, after: 20, line: 252 };
  function metinPar(t, o, po) {
    var p = par([run(t, o)], { before: TABLO_PAR.before, after: TABLO_PAR.after, line: TABLO_PAR.line, jc: (po && po.jc) || "left" });
    if (po) for (var k in po) p[k] = po[k];
    return p;
  }
  function etiketHucre(t, w, o) {
    return hucre([metinPar(t, { b: true, color: (o && o.color) || R.yazi, sz: (o && o.sz) || 15 })], { w: w, fill: R.etiket });
  }
  function degerHucre(t, w, o) {
    return hucre([metinPar(t || "", { b: !!(o && o.b), color: (o && o.color) || R.yazi, sz: (o && o.sz) || 15 })], { w: w, fill: (o && o.fill) || R.beyaz });
  }
  function satirlarPar(metin, sz, o) {
    // Çok satırlı metni ayrı paragraflara böler (performans, uyarlama hücreleri)
    var satirlar = String(metin || "").split(/\n+/).map(function (s) { return s.trim(); }).filter(Boolean);
    if (!satirlar.length) satirlar = [""];
    return satirlar.map(function (s) { return metinPar(s, { color: R.yazi, sz: sz || 15, b: !!(o && o.b) }, o && o.po); });
  }
  function bolumBasligi(no, metin, o) {
    var runs = [];
    if (no) runs.push(run("[BÖLÜM " + no + "] ", { b: true, color: R.mavi, sz: 18 }));
    runs.push(run(metin, { b: true, color: R.lacivert, sz: 19 }));
    return par(runs, { keepNext: true, before: (o && o.before) || 0, after: 40, jc: "left", pageBreakBefore: !!(o && o.pageBreakBefore) });
  }
  function altBaslik(metin, o) {
    return par([run(metin, { i: true, color: R.gri, sz: 16 })], { keepNext: true, before: 0, after: (o && o.after) || 60, jc: "left" });
  }
  function tabloBasligi(metin, before) {
    return par([run(metin, { b: true, color: R.mavi, sz: 19 })], { keepNext: true, before: before || 40, after: 40, jc: "left" });
  }
  function bosluk(after) { return par([], { before: 0, after: after || 60 }); }
  function sayfaSonu() { return { tip: "sayfaSonu" }; }

  function nokta(n) { return new Array((n || 24) + 1).join("."); }
  function tabloGenislikleri(oranlar) {
    var top = oranlar.reduce(function (a, b) { return a + b; }, 0);
    var g = oranlar.map(function (o) { return Math.floor(o / top * TABLO_GENISLIGI); });
    g[g.length - 1] += TABLO_GENISLIGI - g.reduce(function (a, b) { return a + b; }, 0);
    return g;
  }

  /* ------------------------------------------------------------ metin yardımcıları */
  function sinifIfadesi(bep, ctx) {
    var plan = ctx.plan, s = plan && plan.sinif;
    if (!s || s === "S" || s === "") s = bep.ogrenci && bep.ogrenci.sinif;
    if (s === "H") return "HAZIRLIK SINIFI";
    return s ? s + ". SINIF" : "";
  }
  function dersAdi(ctx) {
    var ad = ctx.ders ? ctx.ders.ad : "";
    return ad.replace(/\s*\((Seçmeli|AİHL)\)\s*$/, "").replace(" / Temel Düzey Matematik", "");
  }
  function sinifSube(o) {
    var s = o.sinif === "H" ? "Hazırlık" : (o.sinif || "");
    return s && o.sube ? s + "/" + tr.up(o.sube) : s || "";
  }
  function tanilar(bep) {
    var ids = (bep.ogrenci && bep.ogrenci.yetersizlik) || [];
    var ad = ids.filter(function (i) { return i !== "diger"; }).map(function (i) { return BEP.yetersizlikBul(i).ad; });
    if (ids.indexOf("diger") >= 0 && bep.ogrenci.yetersizlikMetni) ad.push(bep.ogrenci.yetersizlikMetni);
    return ad.join(", ") || "—";
  }
  BEP.tanilarMetni = tanilar;

  function ustBaslikSatiri(okul) {
    if (okul.baslikSatiri2) return okul.baslikSatiri2;
    var il = tr.up(okul.il || "");
    var ilce = tr.up(okul.ilce || "");
    if (!il) return "";
    if (!ilce || ilce === "MERKEZ") return il + " VALİLİĞİ – İL MİLLÎ EĞİTİM MÜDÜRLÜĞÜ";
    return ilce + " KAYMAKAMLIĞI – İLÇE MİLLÎ EĞİTİM MÜDÜRLÜĞÜ";
  }
  BEP.ustBaslikSatiri = ustBaslikSatiri;
  function okulMudurlugu(okul) {
    var ad = tr.up(okul.ad || "");
    if (!ad) return "";
    return /MÜDÜRLÜĞÜ$/.test(ad) ? ad : ad + " MÜDÜRLÜĞÜ";
  }

  /* ------------------------------------------------------------ satır yüksekliği tahmini (dxa)
   * Calibri'nin gerçek karakter genişlikleri (yazitipi.js) ile Word'ün kelime kaydırması taklit edilir. */
  var GENISLIK_HARITASI = null;
  function genislikHaritasi() {
    if (GENISLIK_HARITASI) return GENISLIK_HARITASI;
    var C = BEP.CALIBRI, h = { r: {}, b: {} };
    if (C) for (var i = 0; i < C.karakterler.length; i++) { h.r[C.karakterler[i]] = C.r[i]; h.b[C.karakterler[i]] = C.b[i]; }
    GENISLIK_HARITASI = h;
    return h;
  }
  function olc(metin, sz, kalin) {
    var h = genislikHaritasi()[kalin ? "b" : "r"], top = 0;
    for (var i = 0; i < metin.length; i++) { var w = h[metin[i]]; top += w === undefined ? 960 : w; }
    return top / 2048 * (sz / 2) * 20;
  }
  function satirSayisi(metin, genislik, sz, kalin) {
    var ic = Math.max(200, genislik - 140), bosluk = olc(" ", sz, kalin);
    return String(metin || "").split("\n").reduce(function (toplam, paragraf) {
      var n = 1, mevcut = 0;
      paragraf.split(" ").forEach(function (k) {
        var w = olc(k, sz, kalin);
        if (mevcut > 0 && mevcut + bosluk + w <= ic) { mevcut += bosluk + w; return; }
        if (mevcut > 0) n++;
        mevcut = w;
        while (mevcut > ic) { n++; mevcut -= ic; }
      });
      return toplam + n;
    }, 0);
  }
  function satirYuksekligiTwip(sz) { return sz / 2 * 1.2207 * 20; }
  function hucreYuksekligi(metin, genislik, sz, kalin, paragrafSayisi, sonra) {
    return satirSayisi(metin, genislik, sz, kalin) * satirYuksekligiTwip(sz) + (paragrafSayisi || 1) * (sonra === undefined ? 10 : sonra) + 90;
  }
  BEP.metinSatirSayisi = satirSayisi;

  /* ------------------------------------------------------------ BÖLÜM 3: yıllık plan tablosu */
  function planTablosu(bep, ctx, govdeBasYuksekligi) {
    var ayar = bep.ayarlar || {};
    var duzen = DUZENLER[ayar.duzen] || DUZENLER.ornek;
    var G = duzen.genislikler;
    var basliklar = duzen.basliklar(ctx.program);
    var satirlar = (bep.plan && bep.plan.satirlar) || [];

    // Başlık satırı
    var baslikSatiri = {
      baslik: true, cantSplit: true,
      hucreler: basliklar.map(function (b, i) {
        return hucre([par([run(b, { b: true, color: R.beyaz, sz: 15 })], { before: 10, after: 20, line: 252, jc: "center", keepNext: true })], { w: G[i], fill: R.lacivert });
      })
    };
    var baslikYuk = Math.max.apply(null, basliklar.map(function (b, i) { return satirSayisi(b, G[i], 15, true) * satirYuksekligiTwip(15) * 1.05 + 20 + 10 + 90; }));

    // Ay grupları
    var gruplar = [];
    satirlar.forEach(function (s, i) {
      var g = gruplar[gruplar.length - 1];
      if (!g || g.ay !== s.ay) { g = { ay: s.ay, indeksler: [] }; gruplar.push(g); }
      g.indeksler.push(i);
    });

    function hucreMetni(s, alan) {
      if (alan === "yontemArac") return [s.yontem, s.arac].filter(Boolean).join("\n");
      return s[alan] || "";
    }
    function satirYuk(s, aySonu) {
      var y = 0;
      if (s.tur === "tatil") {
        y = Math.max(hucreYuksekligi(s.tarih, G[2], 15, true), hucreYuksekligi(s.ad + " (" + (s.alt || "Eğitim-Öğretime Ara") + ")", G[duzen.alanlar.indexOf("kda")], 15, true), hucreYuksekligi(s.aciklama || "", G[G.length - 1], 15, true));
      } else {
        duzen.alanlar.forEach(function (a, i) {
          if (a === "ay") return;
          var sz = a === "hafta" || a === "saat" ? 15 : 14;
          var t = a === "hafta" ? s.no + ". Hf" : hucreMetni(s, a);
          y = Math.max(y, hucreYuksekligi(t, G[i], sz, a === "hafta" || a === "olcme" && /SINAVI/.test(t)));
        });
      }
      return y + (aySonu ? 30 : 8);
    }

    // Sayfa kesmeleri: ayları bölmeden, Calibri ölçüleriyle hesaplanan yüksekliklere göre dengeli dağıt
    var kullanilabilir = SAYFA.h - SAYFA.ust - SAYFA.alt - 60;
    var guvenlik = 1.03;
    var sayfaBasi = {};
    var mevcut = govdeBasYuksekligi + baslikYuk, kapasite = kullanilabilir;
    gruplar.forEach(function (g, gi) {
      g.yukseklik = g.indeksler.reduce(function (t, i, k) { return t + satirYuk(satirlar[i], k === g.indeksler.length - 1) * guvenlik; }, 0);
      var donemBasi = ayar.donemSayfa && satirlar[g.indeksler[0]].donem === 2 && gi > 0 && satirlar[gruplar[gi - 1].indeksler[0]].donem === 1;
      if (gi > 0 && (mevcut + g.yukseklik > kapasite || donemBasi)) {
        sayfaBasi[g.indeksler[0]] = true;
        mevcut = baslikYuk;
      }
      mevcut += g.yukseklik;
    });

    var tabloSatirlari = [baslikSatiri];
    var zebra = 0;
    gruplar.forEach(function (g) {
      g.indeksler.forEach(function (idx, k) {
        var s = satirlar[idx];
        var ilk = k === 0, son = k === g.indeksler.length - 1;
        var po = { keepNext: !son, pageBreakBefore: !!sayfaBasi[idx] && ilk };
        var kalinAlt = son ? { sz: 20, color: R.lacivert } : null;
        var hucreler = [];
        // AY hücresi (dikey birleşik)
        var ayKenar = { right: { sz: 8, color: R.lacivert } };
        if (son) ayKenar.bottom = { sz: 20, color: R.lacivert };
        hucreler.push(hucre([par(ilk ? [run(s.ay, { b: true, color: R.lacivert, sz: 17 })] : [], { before: 0, after: 10, line: 240, jc: "center", keepNext: po.keepNext, pageBreakBefore: po.pageBreakBefore })],
          { w: G[0], fill: R.etiket, vMerge: ilk ? "restart" : "continue", kenar: ayKenar }));
        var kenar = kalinAlt ? { bottom: kalinAlt } : null;
        if (s.tur === "tatil") {
          var tatilHucre = function (t, i, o) {
            return hucre([par([run(t, { b: o && o.b !== undefined ? o.b : true, i: !!(o && o.i), color: R.tatilYazi, sz: (o && o.sz) || 15 })], { before: 0, after: 10, line: 240, jc: "center", keepNext: po.keepNext, pageBreakBefore: po.pageBreakBefore })], { w: G[i], fill: R.tatil, kenar: kenar });
          };
          duzen.alanlar.forEach(function (a, i) {
            if (a === "ay") return;
            if (a === "hafta") hucreler.push(tatilHucre("—", i));
            else if (a === "tarih") hucreler.push(tatilHucre(s.tarih, i));
            else if (a === "saat") hucreler.push(tatilHucre("—", i, { b: false }));
            else if (a === "unite") hucreler.push(tatilHucre(s.ad, i, { sz: 16 }));
            else if (a === "kda") hucreler.push(tatilHucre(s.ad + " (" + (s.alt || "Eğitim-Öğretime Ara") + ")", i, { i: true }));
            else if (a === "olcme") hucreler.push(tatilHucre(s.aciklama || "Resmî Tatil", i));
            else hucreler.push(tatilHucre("—", i, { b: false }));
          });
          tabloSatirlari.push({ cantSplit: true, hucreler: hucreler });
          zebra++;
          return;
        }
        var fill = zebra % 2 === 0 ? R.zebra1 : R.zebra2;
        zebra++;
        duzen.alanlar.forEach(function (a, i) {
          if (a === "ay") return;
          var p = { before: 0, after: 10, line: 240, jc: "left", keepNext: po.keepNext, pageBreakBefore: po.pageBreakBefore };
          var runs;
          if (a === "hafta") { p.jc = "center"; runs = [run(s.no + ". Hf", { b: true, color: R.lacivert, sz: 15 })]; }
          else if (a === "tarih") { p.jc = "center"; runs = [run(s.tarih, { color: R.gri, sz: 14 })]; }
          else if (a === "saat") { p.jc = "center"; runs = [run(s.saat, { b: true, color: R.yazi, sz: 15 })]; }
          else if (a === "kda") {
            var m = String(s.kda || "").match(/^(UDA\s*\d+\s*\/\s*KDA\s*[\d.]+\s*:)\s*([\s\S]*)$/);
            runs = m ? [run(m[1] + " ", { b: true, color: R.lacivert, sz: 14 }), run(m[2], { color: R.yazi, sz: 14 })] : [run(s.kda || "", { color: R.yazi, sz: 14 })];
          } else if (a === "olcme") {
            runs = [];
            String(s.olcme || "").split("\n").forEach(function (l, li) {
              var kalin = /BEP YAZILI SINAVI|^\(BEP amaçlarına/.test(l);
              runs.push(run((li ? "\n" : "") + l, { b: kalin, color: R.yazi, sz: 14 }));
            });
          } else {
            runs = [run(hucreMetni(s, a), { color: R.yazi, sz: 14 })];
          }
          hucreler.push(hucre([par(runs, p)], { w: G[i], fill: fill, kenar: kenar }));
        });
        tabloSatirlari.push({ cantSplit: true, hucreler: hucreler });
      });
    });
    return { tip: "tablo", genislikler: G, satirlar: tabloSatirlari, sayfaBasi: sayfaBasi };
  }

  /* ------------------------------------------------------------ belge modeli */
  BEP.belgeModeli = function (bep) {
    var ctx = BEP.baglam(bep);
    var o = bep.ogrenci || {}, okul = bep.okul || {}, ayar = bep.ayarlar || {};
    var T = BEP.takvimBilgi(bep.egitimYili);
    var yil = T.egitimYili;
    var sinifIf = sinifIfadesi(bep, ctx);
    var dersAd = dersAdi(ctx);
    var dersAdUp = tr.up(dersAd);
    var adSoyad = tr.adSoyadBicim(o.ad || "");
    var ilkAd = ctx.ad;
    var ss = sinifSube(o);
    var haftaSayisi = (bep.plan && bep.plan.satirlar || []).filter(function (s) { return s.tur === "hafta"; }).length || 37;
    var ogretimHaftasi = Math.min(36, haftaSayisi);
    var toplamSaat = ogretimHaftasi * ctx.saat;
    var govde = [];

    /* --- Üst başlık --- */
    var ust1 = ustBaslikSatiri(okul), ust2 = okulMudurlugu(okul);
    var baslikMetni = yil + " EĞİTİM-ÖĞRETİM YILI " + (sinifIf ? sinifIf + " " : "") + dersAdUp + " DERSİ ÜNİTELENDİRİLMİŞ BEP YILLIK PLANI";
    govde.push(par([
      run("T.C." + (ust1 ? "\n" + ust1 : "") + (ust2 ? "\n" + ust2 : "") + "\n", { b: true, color: R.lacivert, sz: 20 }),
      run(baslikMetni, { b: true, color: R.mavi, sz: 22 })
    ], { before: 0, after: 40, line: 252, jc: "center" }));

    /* --- BÖLÜM 1 --- */
    govde.push(bolumBasligi(1, "ÖĞRENCİ VE EĞİTSEL TANILAMA BİLGİLERİ"));
    var G1 = [2551, 4875, 2551, 4875];
    var noSinif = [o.no, ss ? (o.sinif === "H" ? "Hazırlık" : o.sinif + ". Sınıf") + (o.sube ? " – " + tr.up(o.sube) + " Şubesi (" + ss.replace("/", "-") + ")" : "") : ""].filter(Boolean).join(" / ");
    var okulTurAd = { anadolu: "Anadolu Lisesi Programı", fen: "Fen Lisesi Programı", sosyal: "Sosyal Bilimler Lisesi Programı", mtal: "Mesleki ve Teknik Ortaöğretim Programı", aihl: "Anadolu İmam Hatip Lisesi Programı", diger: "Ortaöğretim Programı" }[okul.tur] || "Ortaöğretim Programı";
    var dersBilgi = dersAd + " (" + ctx.saat + " Saat) / 1 Yıl (" + ogretimHaftasi + " Öğretim Haftası)";
    var bepTarih = (BEP.tarih.isoToTR(o.bepBaslangic) || T.dersBasi) + " – " + (BEP.tarih.isoToTR(o.bepBitis) || T.dersSonu);
    var ogretmen = (bep.ders && bep.ders.ogretmen) || "";
    // [etiket, değer, etiket, değer, sol kalın, sağ kalın]
    var t1 = [
      ["Öğrencinin Adı Soyadı:", tr.up(o.ad || ""), "Okul No / Sınıfı-Şubesi:", noSinif, true, true],
      ["Kayıtlı Olduğu Okul:", okul.ad || "", "Programı:", okulTurAd, false, false],
      ["Yetersizlik Türü / Tanısı:", tanilar(bep), "Önerilen Hizmet / Karar:", o.hizmet || "Tam Zamanlı Kaynaştırma / Bütünleştirme", true, true],
      ["Ders / Haftalık Saat / Süre:", dersBilgi, "BEP Başlangıç – Bitiş Tarihi:", bepTarih, true, false],
      ["Ders Öğretmeni:", ogretmen ? tr.adSoyadBicim(ogretmen) : nokta(30), "Kullandığı Destek Materyali / Cihaz:", o.cihaz || "Yok", false, false]
    ];
    govde.push({
      tip: "tablo", genislikler: G1, satirlar: t1.map(function (s, i) {
        return { cantSplit: true, hucreler: [etiketHucre(s[0], G1[0]), degerHucre(s[1], G1[1], { b: s[4], color: i === 0 ? R.lacivert : R.yazi, sz: i === 0 ? 17 : 15 }), etiketHucre(s[2], G1[2]), degerHucre(s[3], G1[3], { b: s[5] })] };
      })
    });
    if (ayar.kvkkNotu !== false) govde.push(par([run("Not: Bu dosya özel nitelikli kişisel veri (sağlık/eğitsel tanı bilgisi) içerir; 6698 sayılı KVKK kapsamında yalnızca yetkili kişilerce kullanılmalı ve korunmalıdır.", { i: true, color: R.ustGri, sz: 13 })], { before: 30, after: 60 }));
    else govde.push(bosluk(60));

    /* --- BÖLÜM 2 --- */
    govde.push(bolumBasligi(2, "ÖĞRENCİNİN MEVCUT EĞİTSEL PERFORMANS DÜZEYİ (VAR OLAN DÜZEY)"));
    var G2 = [3515, 11337];
    var perf = bep.performans || {};
    var grup = BEP.DERS_GRUPLARI[ctx.grup] || BEP.DERS_GRUPLARI.mes;
    var t2 = [
      ["Bilişsel, Duyuşsal ve Sosyal Gelişim Özellikleri", perf.gelisim],
      [dersAd + " Alanı Performans Düzeyi\n" + grup.alanEtiketi, perf.ders],
      ["Öğrencinin Güçlü Yönleri (Pozitif Özellikler)", perf.guclu],
      ["Geliştirilmesi ve Desteklenmesi Gereken Yönleri", perf.destek]
    ];
    if (tr.bosluk(perf.davranis)) t2.push(["Davranış Özellikleri / Davranış Problemi (Varsa)", perf.davranis]);
    govde.push({
      tip: "tablo", genislikler: G2, satirlar: t2.map(function (s, i) {
        return { cantSplit: true, hucreler: [
          hucre([metinPar(s[0], { b: true, color: R.lacivert, sz: 17 })], { w: G2[0], fill: R.etiket }),
          hucre(satirlarPar(s[1] || "—", 15), { w: G2[1], fill: i % 2 ? R.zebra1 : R.beyaz })
        ] };
      })
    });

    /* --- BÖLÜM 3 --- */
    govde.push(sayfaSonu());
    var b3 = "[BÖLÜM 3] " + baslikMetni;
    var alt3 = "MEB " + yil + " Çalışma Takvimi ve " + (ctx.plan ? ctx.plan.kaynak.replace(/\s*\(.*\)\s*$/, "") : "resmî öğretim programı") + " esas alınarak hazırlanmıştır • Aylar gruplandırılmış ve kalın çizgilerle belirginleştirilmiştir (" + ogretimHaftasi + " öğretim haftası / " + toplamSaat + " ders saati)";
    govde.push(bolumBasligi(3, baslikMetni));
    govde.push(altBaslik(alt3));
    var metinGenisligi = SAYFA.w - SAYFA.sol - SAYFA.sag + 140;
    var govdeBas = satirSayisi(b3, metinGenisligi, 19, true) * satirYuksekligiTwip(19) + 40 +
      satirSayisi(alt3, metinGenisligi, 16, false) * satirYuksekligiTwip(16) + 60 + 110;
    govde.push(planTablosu(bep, ctx, govdeBas));

    /* --- BÖLÜM 4 --- */
    govde.push(sayfaSonu());
    govde.push(bolumBasligi(4, "ÖZEL EĞİTİM HİZMETLERİ YÖNETMELİĞİ GEREĞİNCE EĞİTSEL VE SINAV UYARLAMALARI"));
    govde.push(altBaslik("Yasal Dayanak: MEB Özel Eğitim Hizmetleri Yönetmeliği Md. 20, 22, 23 ve 24; Ortaöğretim Kurumları Yönetmeliği Md. 10/1-f, 43/1-g ve 45/1-ğ"));
    var G4 = [3515, 11337];
    function uyarlamaTablosu(baslik1, baslik2, liste) {
      var satirlar = [{ baslik: true, cantSplit: true, hucreler: [
        hucre([metinPar(baslik1, { b: true, color: R.beyaz, sz: 16 }, { jc: "center" })], { w: G4[0], fill: R.lacivert }),
        hucre([metinPar(baslik2, { b: true, color: R.beyaz, sz: 16 }, { jc: "center" })], { w: G4[1], fill: R.lacivert })
      ] }];
      liste.forEach(function (u) {
        satirlar.push({ cantSplit: true, hucreler: [
          hucre([metinPar(u.baslik, { b: true, color: R.lacivert, sz: 16 })], { w: G4[0], fill: R.etiket }),
          hucre(satirlarPar(u.aciklama, 16), { w: G4[1], fill: R.zebra1 })
        ] });
      });
      return { tip: "tablo", genislikler: G4, satirlar: satirlar };
    }
    var uy = BEP.varsayilanUyarlamalar(bep);
    var sinifU = (uy.sinif || []).filter(function (u) { return u.secili !== false && tr.bosluk(u.baslik + u.aciklama); });
    var sinavU = (uy.sinav || []).filter(function (u) { return u.secili !== false && tr.bosluk(u.baslik + u.aciklama); });
    govde.push(tabloBasligi("Tablo 4.1: Sınıf İçi Öğretimsel ve Çevresel Uyarlamalar", 40));
    govde.push(uyarlamaTablosu("UYARLAMA ALANI", "UYGULANACAK YÖNTEM, TEKNİK VE DÜZENLEMELER", sinifU));
    govde.push(tabloBasligi("Tablo 4.2: Ölçme ve Değerlendirme (Sınav) Uyarlamaları (Özel Eğitim Hizmetleri Yönetmeliği Md. 24)", 120));
    govde.push(uyarlamaTablosu("ÖLÇME-DEĞERLENDİRME ESASI", "YÖNETMELİK HÜKMÜ VE UYGULANACAK ÖZEL SINAV TEDBİRLERİ", sinavU));

    var kararlar = BEP.otomatikKararlar(bep);
    govde.push(tabloBasligi("Tablo 4.3: BEP Geliştirme Birimi Kararları – Destek Eğitim, Aile Bilgilendirme ve Davranış Desteği", 120));
    govde.push(uyarlamaTablosu("KARAR ALANI", "BEP GELİŞTİRME BİRİMİNCE ALINAN KARAR / UYGULAMA", kararlar));

    /* --- BÖLÜM 5 --- */
    govde.push(sayfaSonu());
    govde.push(bolumBasligi(5, "BEP İZLEME, DÖNEM SONU DEĞERLENDİRME ÇİZELGESİ VE ONAY İMZALARI"));
    var G5 = [1020, 4876, 2154, 2154, 4648];
    var izleme = bep.izleme || [];
    var t5 = [{ baslik: true, cantSplit: true, hucreler: ["AMAÇ NO", "UZUN DÖNEMLİ AMAÇ (UDA)", "1. DÖNEM SONU", "2. DÖNEM SONU", "BEP BİRİMİ KARARI VE AÇIKLAMA"].map(function (b, i) {
      return hucre([metinPar(b, { b: true, color: R.beyaz, sz: 16 }, { jc: "center" })], { w: G5[i], fill: R.lacivert });
    }) }];
    izleme.forEach(function (u, i) {
      var f = i % 2 ? R.beyaz : R.zebra1;
      t5.push({ cantSplit: true, hucreler: [
        hucre([metinPar("UDA " + u.no, { b: true, color: R.lacivert, sz: 16 }, { jc: "center" })], { w: G5[0], fill: R.etiket }),
        hucre([metinPar(u.metin, { color: R.yazi, sz: 15 })], { w: G5[1], fill: f }),
        hucre([metinPar(u.d1, { color: R.yazi, sz: 15 }, { jc: "center" })], { w: G5[2], fill: f }),
        hucre([metinPar(u.d2, { color: R.yazi, sz: 15 }, { jc: "center" })], { w: G5[3], fill: f }),
        hucre([metinPar(u.karar || "", { color: R.yazi, sz: 15 })], { w: G5[4], fill: f })
      ] });
    });
    govde.push({ tip: "tablo", genislikler: G5, satirlar: t5 });
    var olcutAd = (BEP.OLCUTLER.filter(function (x) { return x.id === (ayar.olcut || "80"); })[0] || {}).ad;
    govde.push(par([run("Açıklama: Kısa dönemli amaçlar (KDA), yıllık plandaki ilgili haftalarda uygulanır ve " + (olcutAd && ayar.olcut !== "yok" ? "“" + olcutAd + "” ölçütüne" : "belirlenen ölçüte") + " göre değerlendirilir. Dönem sonlarında her uzun dönemli amaç için uygun kutu işaretlenir. Yıl sonu genel BEP değerlendirmesi: " + nokta(70), { i: true, color: R.gri, sz: 14 })], { before: 40, after: 60, keepNext: true }));

    /* --- BÖLÜM 6 --- */
    govde.push(bolumBasligi(6, "BEP GELİŞTİRME BİRİMİ İMZA SİRKÜSÜ", { before: 80 }));
    var G6 = [2475, 2475, 2475, 2475, 2475, 2477];
    var ku = bep.kurul || {};
    var tarih = ku.tarih ? BEP.tarih.isoToTR(ku.tarih) : "..... / ..... / 20.....";
    var roller = [
      ["BEP Birim Başkanı\n(" + (ku.baskanUnvan || "Müdür Yardımcısı") + ")", ku.baskan],
      [dersAd + "\nDersi Öğretmeni", (bep.ders && bep.ders.ogretmen) || ku.ogretmen],
      ["Sınıf Rehber Öğretmeni\n(" + (ss || "...") + " Şubesi)", ku.sinifRehber],
      ["Rehber Öğretmen /\nPsikolojik Danışman", ku.rehberOgretmen],
      ["Öğrenci Velisi\n(Anne / Baba / Vasi)", ku.veli],
      ["Öğrenci\n(" + [ss, o.no].filter(Boolean).join(" – ") + ")", o.ad ? adSoyad : ""]
    ];
    govde.push({ tip: "tablo", genislikler: G6, satirlar: [
      { cantSplit: true, hucreler: roller.map(function (r0, i) { return hucre([metinPar(r0[0], { b: true, color: R.lacivert, sz: 16 }, { jc: "center" })], { w: G6[i], fill: R.etiket }); }) },
      { cantSplit: true, hucreler: roller.map(function (r0, i) {
        return hucre([metinPar("Adı Soyadı: " + (r0[1] ? r0[1] : nokta(26)) + "\n\nİmza:\n\nTarih: " + tarih, { color: R.yazi, sz: 15 }, { jc: "center" })], { w: G6[i], fill: R.beyaz });
      }) }
    ] });
    var td = bep.tasdik || {};
    var uygTarih = td.uygulamaTarihi ? BEP.tarih.isoToTR(td.uygulamaTarihi) : (ku.tarih ? BEP.tarih.isoToTR(ku.tarih) : "..... / ..... / 20.....");
    govde.push(par([run("OKUL MÜDÜRLÜĞÜ TASDİKİ: " + (ss || "....") + " sınıfı " + (o.no || "....") + " numaralı öğrencimiz " + (adSoyad || "....................") + " için hazırlanan işbu " + yil + " Eğitim-Öğretim Yılı " + dersAd + " Dersi Ünitelendirilmiş BEP Yıllık Planı incelenmiş olup " + uygTarih + " tarihinden itibaren uygulanması uygun görülmüştür.", { b: true, color: R.yazi, sz: 16 })], { keepNext: true, before: 100, after: 20, jc: "center" }));
    govde.push(par([run("UYGUNDUR\n" + (td.tarih ? BEP.tarih.isoToTR(td.tarih) : "..... / ..... / 20.....") + "\n\n" + (okul.mudur ? tr.adSoyadBicim(okul.mudur) : nokta(36)) + "\nOkul Müdürü (İmza – Mühür)", { b: true, color: R.yazi, sz: 16 })], { before: 60, after: 0, jc: "center" }));

    /* --- Üst ve alt bilgi --- */
    var ustBilgi = [par([run("T.C. " + (tr.up(okul.il || "") ? tr.up(okul.il) + " VALİLİĞİ | " : "") + (okulMudurlugu(okul) || "") + "\n" + (sinifIf ? sinifIf + " " : "") + dersAdUp + " DERSİ ÜNİTELENDİRİLMİŞ BEP YILLIK PLANI (" + yil + ")", { color: R.ustGri, sz: 15 })], { jc: "right", before: 0, after: 0, line: 240 })];
    var altBilgi = [par([
      run("Öğrenci: " + (tr.up(o.ad || "") || "—") + " (No: " + (o.no || "—") + " | Sınıf: " + (ss || "—") + ")  •  Tanı: " + tanilar(bep), { i: true, color: R.ustGri, sz: 15 }),
      run("\t", { sz: 15 }),
      run("ÖEHY Md. 20 ve 24 esaslarına göre düzenlenmiştir.  |  Sayfa ", { color: R.ustGri, sz: 15 }),
      run("", { alan: "PAGE", color: R.ustGri, sz: 15 }),
      run(" / ", { color: R.ustGri, sz: 15 }),
      run("", { alan: "NUMPAGES", color: R.ustGri, sz: 15 })
    ], { jc: "left", before: 0, after: 0, line: 240, sekme: SAYFA.w - SAYFA.sol - SAYFA.sag })];

    return {
      govde: govde, ust: ustBilgi, alt: altBilgi,
      meta: { baslik: baslikMetni, ogrenci: adSoyad, ders: dersAd, olusturan: (bep.ders && bep.ders.ogretmen) || "", yil: yil }
    };
  };
})(typeof window !== "undefined" ? window : globalThis);
