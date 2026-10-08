/*
 * BEP Hazırlama Aracı — Çalışma takvimi
 * Kaynak: MEB "2026-2027 Eğitim Öğretim Yılı Takvimi Açıklandı" (meb.gov.tr/…/haber/41057/tr)
 *   1. dönem: 14 Eylül 2026 – 22 Ocak 2027 | 1. dönem ara tatili: 16–20 Kasım 2026
 *   Yarıyıl tatili: 25 Ocak – 5 Şubat 2027 | 2. dönem: 8 Şubat – 25 Haziran 2027
 *   2. dönem ara tatili: 8–12 Mart 2027
 * Dinî bayramlar: Diyanet İşleri Başkanlığı 2027 dinî günler takvimi
 *   Ramazan Bayramı 9–11 Mart 2027 (arife 8 Mart) — ara tatile denk gelir
 *   Kurban Bayramı 16–19 Mayıs 2027 (arife 15 Mayıs)
 * Haftaların aylara dağıtımında haftanın çarşamba günü esas alınmıştır
 * (ör. 28 Eylül–2 Ekim = Eylül; 30 Kasım–4 Aralık = Aralık), OGM çerçeve planlarıyla uyumludur.
 */
(function (kok) {
  "use strict";
  var BEP = (kok.BEP = kok.BEP || {});

  var AY_ADLARI = ["OCAK", "ŞUBAT", "MART", "NİSAN", "MAYIS", "HAZİRAN", "TEMMUZ", "AĞUSTOS", "EYLÜL", "EKİM", "KASIM", "ARALIK"];
  var AY_UZUN = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  var AY_KISA = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

  /* Uygulamanın varsayılan eğitim yılı. Yeni yıl için TAKVIMLER'e kayıt ekleyip bu değeri güncelleyin. */
  BEP.VARSAYILAN_YIL = "2026-2027";

  BEP.TAKVIMLER = {
    "2026-2027": {
      egitimYili: "2026-2027",
      kaynak: "MEB 2026-2027 Eğitim Öğretim Yılı Çalışma Takvimi",
      dersBasi: "2026-09-14",
      dersSonu: "2027-06-25",
      birinciDonemSonu: "2027-01-22",
      ikinciDonemBasi: "2027-02-08",
      tatiller: [
        { bas: "2026-11-16", son: "2026-11-20", ad: "I. DÖNEM ARA TATİLİ", aciklama: "Resmî Ara Tatil", alt: "Eğitim-Öğretime Ara" },
        { bas: "2027-01-25", son: "2027-02-05", ad: "YARIYIL TATİLİ", aciklama: "Resmî Yarıyıl Tatili", alt: "Sömestir Tatili" },
        { bas: "2027-03-08", son: "2027-03-12", ad: "II. DÖNEM ARA TATİLİ", aciklama: "Resmî Ara Tatil • Ramazan Bayramı (9-11 Mart)", alt: "Eğitim-Öğretime Ara" }
      ],
      // Haftanın iş günlerine denk gelen resmî tatil / yarım gün notları
      notlar: [
        { bas: "2026-10-28", son: "2026-10-29", metin: "28 Ekim yarım gün; 29 Ekim tatil" },
        { bas: "2027-01-01", son: "2027-01-01", metin: "1 Ocak Yılbaşı tatili" },
        { bas: "2027-01-22", son: "2027-01-22", metin: "1. dönem sonu (22 Ocak)" },
        { bas: "2027-04-23", son: "2027-04-23", metin: "23 Nisan tatil" },
        { bas: "2027-05-17", son: "2027-05-19", metin: "Kurban Bayramı: 17-19 Mayıs tatil" },
        { bas: "2027-06-25", son: "2027-06-25", metin: "Ders yılı sonu (25 Haziran)" }
      ]
    }
  };

  function tarihOku(s) {
    var p = s.split("-").map(Number);
    return new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  }
  function gunEkle(d, n) { return new Date(d.getTime() + n * 86400000); }
  function iso(d) { return d.toISOString().slice(0, 10); }
  function iki(n) { return (n < 10 ? "0" : "") + n; }

  function aralikMetni(bas, son, uzun) {
    var b = bas, s = son;
    var ad = uzun ? AY_UZUN : AY_KISA;
    if (b.getUTCMonth() === s.getUTCMonth()) {
      return iki(b.getUTCDate()) + " – " + iki(s.getUTCDate()) + " " + ad[s.getUTCMonth()] + " " + s.getUTCFullYear();
    }
    if (uzun) {
      return iki(b.getUTCDate()) + " " + AY_KISA[b.getUTCMonth()] + " – " + iki(s.getUTCDate()) + " " + AY_KISA[s.getUTCMonth()] + " " + s.getUTCFullYear();
    }
    return iki(b.getUTCDate()) + " " + ad[b.getUTCMonth()] + " – " + iki(s.getUTCDate()) + " " + ad[s.getUTCMonth()];
  }

  function tarihTR(d) { return iki(d.getUTCDate()) + "." + iki(d.getUTCMonth() + 1) + "." + d.getUTCFullYear(); }

  /**
   * Takvimi haftalara böler.
   * Dönen dizi öğeleri:
   *   { tur: "hafta", no, pazartesi, cuma, ay, donem, tarih, notlar: [] }
   *   { tur: "tatil", ad, aciklama, ay, tarih, bas, son }
   */
  function takvim(yil) { return BEP.TAKVIMLER[yil] || BEP.TAKVIMLER[BEP.VARSAYILAN_YIL]; }
  BEP.takvim = takvim;

  BEP.takvimHaftalari = function (yil) {
    var T = takvim(yil);
    var bas = tarihOku(T.dersBasi), son = tarihOku(T.dersSonu), d1Son = tarihOku(T.birinciDonemSonu);
    var sonuc = [], no = 0;
    var tatiller = T.tatiller.map(function (t) { return { t: t, b: tarihOku(t.bas), s: tarihOku(t.son) }; });
    var eklenenTatil = {};
    for (var pzt = bas; pzt <= son; pzt = gunEkle(pzt, 7)) {
      var cuma = gunEkle(pzt, 4), crs = gunEkle(pzt, 2);
      var tatil = null;
      for (var i = 0; i < tatiller.length; i++) {
        if (pzt >= tatiller[i].b && pzt <= tatiller[i].s) { tatil = tatiller[i]; break; }
      }
      if (tatil) {
        if (!eklenenTatil[tatil.t.ad]) {
          eklenenTatil[tatil.t.ad] = 1;
          var tc = gunEkle(tatil.b, 2);
          sonuc.push({
            tur: "tatil", ad: tatil.t.ad, aciklama: tatil.t.aciklama, alt: tatil.t.alt,
            ay: AY_ADLARI[tc.getUTCMonth()], ayNo: tc.getUTCMonth(),
            tarih: aralikMetni(tatil.b, tatil.s, true), bas: iso(tatil.b), son: iso(tatil.s)
          });
        }
        continue;
      }
      no++;
      var notlar = [];
      T.notlar.forEach(function (n) {
        var nb = tarihOku(n.bas), ns = tarihOku(n.son);
        if (ns >= pzt && nb <= cuma) notlar.push(n.metin);
      });
      sonuc.push({
        tur: "hafta", no: no, pazartesi: iso(pzt), cuma: iso(cuma),
        ay: AY_ADLARI[crs.getUTCMonth()], ayNo: crs.getUTCMonth(),
        donem: cuma <= d1Son ? 1 : 2,
        tarih: aralikMetni(pzt, cuma, false), notlar: notlar
      });
    }
    return sonuc;
  };

  BEP.takvimBilgi = function (yil) {
    var T = takvim(yil);
    var haftalar = BEP.takvimHaftalari(T.egitimYili);
    var donemSonHaftasi = 0;
    haftalar.forEach(function (h) { if (h.tur === "hafta" && h.donem === 1) donemSonHaftasi = h.no; });
    return {
      egitimYili: T.egitimYili, kaynak: T.kaynak,
      dersBasi: tarihTR(tarihOku(T.dersBasi)), dersSonu: tarihTR(tarihOku(T.dersSonu)),
      dersBasiIso: T.dersBasi, dersSonuIso: T.dersSonu,
      birinciDonemSonu: tarihTR(tarihOku(T.birinciDonemSonu)), ikinciDonemBasi: tarihTR(tarihOku(T.ikinciDonemBasi)),
      // 1. dönemin son öğretim haftası (2026-2027: 18) ve son öğretim haftası (36; 37. hafta sosyal etkinlik)
      donemSonHaftasi: donemSonHaftasi,
      sonOgretimHaftasi: haftalar.filter(function (h) { return h.tur === "hafta"; }).length - 1,
      tatiller: T.tatiller.map(function (t) { return { ad: t.ad, aciklama: t.aciklama, tarih: aralikMetni(tarihOku(t.bas), tarihOku(t.son), true) }; })
    };
  };

  BEP.tarih = {
    isoToTR: function (s) {
      if (!s) return "";
      if (/^\d{2}\.\d{2}\.\d{4}$/.test(s)) return s;
      var p = String(s).split("-");
      return p.length === 3 ? p[2] + "." + p[1] + "." + p[0] : s;
    },
    AY_ADLARI: AY_ADLARI
  };
})(typeof window !== "undefined" ? window : globalThis);
