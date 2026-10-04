/*
 * BEP Hazırlama Aracı — e-Okul "Özel Eğitim Gereksinimli Öğrenci Listesi" ayrıştırıcı
 * PDF'ten kopyalanan metni öğrenci kayıtlarına dönüştürür. PDF görüntüleyicilere göre alanların
 * kopyalanma sırası değiştiği için her kayıt içinde alanlar sıradan bağımsız tanınır.
 * Aynı öğrencinin birden çok tanısı tek kayıtta birleştirilir. Metin yalnızca tarayıcıda işlenir.
 */
(function (kok) {
  "use strict";
  var BEP = (kok.BEP = kok.BEP || {});
  var tr = BEP.tr;

  var TANI = /((?:Hafif|Orta|Ağır|Çok Ağır)\s+Düzeyde\s+Zihinsel\s+Yetersizlik|Zihinsel\s+Yetersizlik|Özel\s+Öğrenme\s+Güçlüğü|Dikkat\s+Eksikliği\s+ve\s+Hiperaktivite\s+Bozukluğu|(?:Hafif|Orta|Ağır)\s+Düzeyde\s+Otizm(?:\s+Spektrum\s+Bozukluğu)?|Otizm\s+Spektrum\s+Bozukluğu|İşitme\s+Yetersizliği(?:\s+(?:Az\s+İşiten|İşitmeyen|Ağır\s+İşiten))?|Görme\s+Yetersizliği(?:\s+(?:Az\s+Gören|Görmeyen))?|Bedensel\s+Yetersizlik|Dil\s+ve\s+Konuşma\s+Güçlüğü|Duygusal\s+ve\s+Davranış\s+Bozukluğu|Süreğen\s+Hastalık\w*|Özel\s+Yetenekli?)/i;
  var SINIF = /(\d{1,2})\s*\.\s*Sınıf\s*\/\s*([A-ZÇĞİÖŞÜ0-9]{1,3})\s*Şubesi/;
  var HIZMET = /(Tam|Yarı)\s+Zamanlı\s+Kaynaştırma\s*\/?\s*Bütünleştirme(?:\s+Yoluyla\s+Eğitim\s+Uygulamaları)?/i;
  var RAM_UYARI = /RAM\s+Rapor[\s\S]*?başvurunuz/i;

  function temizle(metin) {
    var t = String(metin || "").replace(/\r/g, "");
    t = t.replace(/Bütünle\s*\n\s*ştirme/g, "Bütünleştirme");
    t = t.replace(/\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}(:\d{2})?(\s+\d{1,3})?/g, " "); // alt bilgi: tarih saat sayfa
    t = t.replace(/\s+/g, " ");
    [/T\.C\./g, /[A-ZÇĞİÖŞÜ]+\s+VALİLİĞİ/g, /\b[A-ZÇĞİÖŞÜa-zçğıöşü]+\s*\/\s*[^/]*?Müdürlüğü/g, /Özel Eğitim Gereksinimli Öğrenci Listesi/g,
      /Sınıfı\s*\/\s*Şubesi/g, /Engel Durumu/g, /Önerilen Hizmet/g, /Adı\s+Soyadı/g, /Öğr\.\s*No/g, /S\.\s*No/g, /Cinsiyeti/g]
      .forEach(function (d) { t = t.replace(d, " "); });
    return t.replace(/\s+/g, " ").trim();
  }

  BEP.eokulAyristir = function (metin) {
    var t = temizle(metin);
    var baslar = [], d = /(?:^|\s)(\d{1,3})\s+(\d{1,6})(?=\s)/g, m;
    while ((m = d.exec(t))) baslar.push({ i: m.index, son: d.lastIndex, sira: m[1], no: m[2] });
    var liste = [], harita = {};
    baslar.forEach(function (b, k) {
      var parca = t.slice(b.son, k + 1 < baslar.length ? baslar[k + 1].i : t.length);
      var sm = parca.match(SINIF);
      if (!sm) return;
      var cins = (parca.match(/\b(Erkek|Kız|Kadın)\b/) || [])[1] || "";
      var tani = (parca.match(TANI) || [])[1] || "";
      var hizmet = (parca.match(HIZMET) || [])[0] || "";
      var uyari = RAM_UYARI.test(parca);
      var ad = parca.replace(SINIF, " ").replace(TANI, " ").replace(HIZMET, " ").replace(RAM_UYARI, " ").replace(/\b(Erkek|Kız|Kadın)\b/, " ");
      ad = ad.replace(/\bRAM\b/g, " ");
      var adm = ad.match(/[A-ZÇĞİÖŞÜÂÎÛ]{2,}(?:\s+[A-ZÇĞİÖŞÜÂÎÛ]{2,})+/);
      ad = adm ? adm[0] : tr.bosluk(ad);
      var anahtar = b.no + "|" + sm[1] + sm[2];
      var kayit = harita[anahtar];
      if (!kayit) {
        kayit = { no: b.no, sinif: sm[1], sube: sm[2], ad: tr.baslikDuzeni(tr.bosluk(ad)), cinsiyet: cins === "Kadın" ? "Kız" : cins, engeller: [], yetersizlik: [], hizmet: "", uyari: "" };
        harita[anahtar] = kayit;
        liste.push(kayit);
      }
      tani = tr.bosluk(tani);
      if (tani && kayit.engeller.indexOf(tani) < 0) kayit.engeller.push(tani);
      var id = BEP.yetersizlikEsle(tani);
      if (id && kayit.yetersizlik.indexOf(id) < 0) kayit.yetersizlik.push(id);
      if (/^Tam/i.test(hizmet)) kayit.hizmet = "Tam Zamanlı Kaynaştırma / Bütünleştirme";
      else if (/^Yarı/i.test(hizmet)) kayit.hizmet = "Yarı Zamanlı Kaynaştırma / Bütünleştirme (Özel Eğitim Sınıfı)";
      if (uyari) kayit.uyari = "e-Okul uyarısı: RAM raporundaki sınıf kademesi ile e-Okul sınıf kademesi farklı; RAM’a başvurulması gerekiyor.";
    });
    return liste;
  };
})(typeof window !== "undefined" ? window : globalThis);
