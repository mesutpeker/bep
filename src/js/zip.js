/*
 * BEP Hazırlama Aracı — Bağımlılıksız ZIP (STORE) yazıcı
 * .docx bir ZIP paketidir; dosyalar sıkıştırmasız (store) yazılır, Word ve diğer
 * ofis yazılımları bu paketleri sorunsuz açar.
 */
(function (kok) {
  "use strict";
  var BEP = (kok.BEP = kok.BEP || {});

  var CRC_TABLO = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes) {
    var c = 0xffffffff;
    for (var i = 0; i < bytes.length; i++) c = CRC_TABLO[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  function utf8(s) {
    if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(s);
    return Buffer.from(s, "utf8"); // Node (test) ortamı
  }

  function dosTarihi(d) {
    var saat = (d.getHours() << 11) | (d.getMinutes() << 5) | (Math.floor(d.getSeconds() / 2));
    var tarih = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    return { saat: saat & 0xffff, tarih: tarih & 0xffff };
  }

  /** dosyalar: [{ ad: "word/document.xml", veri: string|Uint8Array }] -> Uint8Array */
  BEP.zipOlustur = function (dosyalar) {
    var zaman = dosTarihi(new Date());
    var parcalar = [], merkez = [], ofset = 0;
    dosyalar.forEach(function (f) {
      var ad = utf8(f.ad);
      var veri = typeof f.veri === "string" ? utf8(f.veri) : f.veri;
      var crc = crc32(veri);
      var yerel = new DataView(new ArrayBuffer(30));
      yerel.setUint32(0, 0x04034b50, true);
      yerel.setUint16(4, 20, true);
      yerel.setUint16(6, 0x0800, true); // UTF-8 dosya adları
      yerel.setUint16(8, 0, true); // STORE
      yerel.setUint16(10, zaman.saat, true);
      yerel.setUint16(12, zaman.tarih, true);
      yerel.setUint32(14, crc, true);
      yerel.setUint32(18, veri.length, true);
      yerel.setUint32(22, veri.length, true);
      yerel.setUint16(26, ad.length, true);
      yerel.setUint16(28, 0, true);
      parcalar.push(new Uint8Array(yerel.buffer), ad, veri);

      var m = new DataView(new ArrayBuffer(46));
      m.setUint32(0, 0x02014b50, true);
      m.setUint16(4, 20, true);
      m.setUint16(6, 20, true);
      m.setUint16(8, 0x0800, true);
      m.setUint16(10, 0, true);
      m.setUint16(12, zaman.saat, true);
      m.setUint16(14, zaman.tarih, true);
      m.setUint32(16, crc, true);
      m.setUint32(20, veri.length, true);
      m.setUint32(24, veri.length, true);
      m.setUint16(28, ad.length, true);
      m.setUint16(30, 0, true);
      m.setUint16(32, 0, true);
      m.setUint16(34, 0, true);
      m.setUint16(36, 0, true);
      m.setUint32(38, 0, true);
      m.setUint32(42, ofset, true);
      merkez.push(new Uint8Array(m.buffer), ad);
      ofset += 30 + ad.length + veri.length;
    });
    var merkezBoyut = merkez.reduce(function (t, p) { return t + p.length; }, 0);
    var son = new DataView(new ArrayBuffer(22));
    son.setUint32(0, 0x06054b50, true);
    son.setUint16(4, 0, true);
    son.setUint16(6, 0, true);
    son.setUint16(8, dosyalar.length, true);
    son.setUint16(10, dosyalar.length, true);
    son.setUint32(12, merkezBoyut, true);
    son.setUint32(16, ofset, true);
    son.setUint16(20, 0, true);
    var hepsi = parcalar.concat(merkez, [new Uint8Array(son.buffer)]);
    var toplam = hepsi.reduce(function (t, p) { return t + p.length; }, 0);
    var cikti = new Uint8Array(toplam), i = 0;
    hepsi.forEach(function (p) { cikti.set(p, i); i += p.length; });
    return cikti;
  };
})(typeof window !== "undefined" ? window : globalThis);
