/*
 * BEP Hazırlama Aracı — HTML önizleme ve yazdırma
 * Word ile aynı belge modelinden A4 yatay sayfalar üretir. Tarayıcının
 * "Yazdır > PDF olarak kaydet" özelliğiyle doğrudan PDF alınabilir.
 *
 * İki aşamada çalışır:
 *  1) BEP.onizlemeHtml(model): DOM gerektirmeyen saf dize işlevi (Node'da da çalışır). Sayfaları
 *     Word için tahmin edilen kesmelerle böler ve her öğeye yeniden sayfalama için gereken
 *     işaretleri (data-*) ekler.
 *  2) BEP.sayfalariYerlestir(kapsayici): yalnız tarayıcıda. Aynı içeriği gerçek ölçümle yeniden
 *     sayfalar; yazı tipi Calibri, Carlito ya da daha geniş bir yedek olsa da hiçbir sayfa A4'ü
 *     aşmaz. BEP.yazdir(model) yazdırma alanına çizer, sayfalar ve yazdırma penceresini açar.
 *
 * Yeniden sayfalama işaretleri:
 *   p[data-kn]        sonraki öğeyle aynı sayfada kalmalı (keepNext)
 *   [data-ys]         yeni sayfada başlar (sayfaSonu / pageBreakBefore / zorunluSayfaBasi)
 *   table[data-tablo] modeldeki tablo sırası; aynı numaralı ardışık parçalar tek tablodur
 *   tr.bas            her sayfada tekrarlanan başlık satırı
 *   tr[data-satir]    veri satırı sırası; tr[data-kn] sonraki satırla birlikte kalmalı
 *   td[data-rs]       dikey birleşimin tam satır sayısı; td[data-kopya] sayfa başında yeniden
 *                     oluşturulmuş birleşik hücre (ör. AY), data-bas: asıl hücrenin satırı
 *   td[data-sutun]    hücrenin ızgara sütunu
 *   [data-alan]       PAGE / NUMPAGES alanı
 *   tr[data-devam]    tek başına bir sayfaya sığmadığı için bölünmüş satırın sonraki sayfadaki devamı
 *                     (değer: satır sırası); td[data-etiket] devam satırındaki "(devam)" etiketi;
 *                     [data-bol] ikiye bölünmüş paragraf/öğenin ilk parçası (devamı sonraki parçada)
 */
(function (kok) {
  "use strict";
  var BEP = (kok.BEP = kok.BEP || {});
  var MM = 25.4 / 1440; // twip -> mm
  var PX_MM = 96 / 25.4; // CSS piksel / mm
  var TOLERANS_MM = 1.5; // ölçüm ile yazdırma/ölçek arasındaki küçük farklar için güvenlik payı
  var YER_TUTUCU = "88"; // ölçüm sırasında sayfa numarası alanlarına konan (en geniş) değer
  var SATIR_ARALIGI = 1.2207; // Calibri/Carlito "tek satır" aralığı (yazı boyutunun katı), Word ile aynı

  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function runHtml(r, sayfaNo, toplam) {
    if (r.t === "\t") return '<span class="sekme"></span>';
    var st = "font-size:" + ((r.sz || 16) / 2) + "pt;";
    if (r.b) st += "font-weight:700;";
    if (r.i) st += "font-style:italic;";
    if (r.color) st += "color:#" + r.color + ";";
    if (r.alan === "PAGE" || r.alan === "NUMPAGES") {
      var deger = r.alan === "PAGE" ? sayfaNo : toplam;
      return '<span data-alan="' + r.alan + '" style="' + st + '">' + esc(deger) + "</span>";
    }
    return '<span style="' + st + '">' + esc(r.t).replace(/\n/g, "<br>") + "</span>";
  }

  /* ek: paragraf etiketine eklenecek öznitelikler (yalnız gövde düzeyindeki paragraflar için) */
  function parHtml(p, sayfaNo, toplam, ek) {
    var st = "text-align:" + ({ left: "left", center: "center", right: "right", both: "justify" }[p.jc] || "left") + ";";
    st += "margin:" + ((p.before || 0) / 20) + "pt 0 " + ((p.after || 0) / 20) + "pt 0;";
    st += "line-height:" + ((p.line || 240) / 240 * SATIR_ARALIGI).toFixed(4) + ";";
    // Satır yüksekliği Word'deki gibi paragraftaki en büyük yazıya göre: paragrafın kendi yazı boyutu
    // (satır "dayanağı") ona eşitlenir; aksi hâlde sayfanın yazı boyutu küçük yazılı satırları uzatır.
    var enBuyuk = 0;
    (p.runs || []).forEach(function (r) { if (r.t !== "\t" && (r.t || r.alan) && (r.sz || 16) > enBuyuk) enBuyuk = r.sz || 16; });
    if (enBuyuk) st += "font-size:" + (enBuyuk / 2) + "pt;";
    if (p.sekme) st += "display:flex;justify-content:space-between;gap:8mm;";
    var runs = (p.runs || []);
    var ac = "<p" + (ek || "") + ' style="' + st + '">';
    if (p.sekme) {
      var sol = [], sag = [], hedef = sol;
      runs.forEach(function (r) { if (r.t === "\t") { hedef = sag; return; } hedef.push(r); });
      // Sağ sekmedeki metin (ör. "Sayfa X / Y") bölünmesin; sığmazsa soldaki metin kayar
      return ac + "<span>" + sol.map(function (r) { return runHtml(r, sayfaNo, toplam); }).join("") + '</span><span style="white-space:nowrap;text-align:right">' +
        sag.map(function (r) { return runHtml(r, sayfaNo, toplam); }).join("") + "</span></p>";
    }
    var ic = runs.map(function (r) { return runHtml(r, sayfaNo, toplam); }).join("");
    return ac + (ic || "&nbsp;") + "</p>";
  }

  function kenarCss(k) {
    if (!k) return "";
    var s = "";
    ["top", "left", "bottom", "right"].forEach(function (y) {
      if (k[y]) s += "border-" + y + ":" + (k[y].sz / 8).toFixed(2) + "pt solid #" + k[y].color + ";";
    });
    return s;
  }

  /* Tablonun başlık satırı sayısı, hücrelerin ızgara sütunları, dikey birleşimler (rowspan) ve
     satır bağları. Dikey birleşimler Word'deki gibi aynı ızgara sütunundaki "continue" hücrelerle eşlenir. */
  function tabloBilgisi(t) {
    var satirlar = t.satirlar || [];
    var basSayisi = 0;
    while (basSayisi < satirlar.length && satirlar[basSayisi].baslik) basSayisi++;
    var konum = satirlar.map(function (s) {
      var c = 0;
      return (s.hucreler || []).map(function (h) { var x = c; c += Math.max(1, h.gridSpan || 1); return x; });
    });
    var span = {}, sonHucre = {};
    satirlar.forEach(function (s, ri) {
      (s.hucreler || []).forEach(function (h, ci) {
        if (h.vMerge !== "restart") return;
        var sutun = konum[ri][ci], n = 1, son = h;
        for (var k = ri + 1; k < satirlar.length; k++) {
          var j = konum[k].indexOf(sutun);
          var cc = j >= 0 ? satirlar[k].hucreler[j] : null;
          if (cc && cc.vMerge === "continue") { n++; son = cc; } else break;
        }
        span[ri + ":" + ci] = n;
        sonHucre[ri + ":" + ci] = son;
      });
    });
    // Word'deki gibi: satırın tüm paragrafları keepNext ise satır sonrakiyle birlikte kalır
    var bagli = satirlar.map(function (s) {
      var hs = s.hucreler || [];
      return hs.length > 0 && hs.every(function (h) {
        var ps = h.paragraflar || [];
        return ps.length > 0 && ps.every(function (p) { return !!p.keepNext; });
      });
    });
    return { basSayisi: basSayisi, konum: konum, span: span, sonHucre: sonHucre, bagli: bagli };
  }

  function hucreHtml(c, ek, kenar) {
    var st = "background:#" + (c.fill || "FFFFFF") + ";vertical-align:" + ({ top: "top", bottom: "bottom" }[c.vAlign] || "middle") + ";" + kenarCss(kenar || c.kenar);
    return "<td" + ek + ' style="' + st + '">' + (c.paragraflar || []).map(function (p) { return parHtml(p); }).join("") + "</td>";
  }

  /* Tablonun bir parçası: başlık satırları + [bas, son) aralığındaki veri satırları.
     Parça bir dikey birleşimin ortasından başlıyorsa birleşik hücre ilk satırda yeniden oluşturulur. */
  function tabloHtml(t, bilgi, no, bas, son, ys) {
    var satirlar = t.satirlar || [];
    var B = bilgi.basSayisi;
    var toplam = t.genislikler.reduce(function (a, b) { return a + b; }, 0);
    var h = '<table class="bt" data-tablo="' + no + '"' + (ys ? ' data-ys="1"' : "") + ' style="width:' + (toplam * MM).toFixed(1) + 'mm"><colgroup>' +
      t.genislikler.map(function (w) { return '<col style="width:' + (w * MM).toFixed(2) + 'mm">'; }).join("") + "</colgroup><tbody>";
    var ilkVeri = B + bas, sonVeri = B + son - 1; // satirlar dizisindeki indeksler (dahil)
    function satirHtml(ri) {
      var s = satirlar[ri], baslik = ri < B, ek = "";
      if (baslik) ek = ' class="bas"';
      else {
        ek = ' data-satir="' + (ri - B) + '"';
        if (bilgi.bagli[ri]) ek += ' data-kn="1"';
        if (t.zorunluSayfaBasi && t.zorunluSayfaBasi[ri - B]) ek += ' data-ys="1"';
      }
      var x = "<tr" + ek + ">";
      // Parçanın ilk satırı: daha önce başlayıp bu satırı kapsayan birleşik hücreleri yeniden oluştur
      var kopyalar = [];
      if (!baslik && ri === ilkVeri) {
        Object.keys(bilgi.span).forEach(function (k) {
          var p = k.split(":"), r0 = +p[0], c0 = +p[1], n = bilgi.span[k];
          if (r0 >= B && r0 < ri && r0 + n - 1 >= ri) kopyalar.push({ r0: r0, c0: c0, n: n, sutun: bilgi.konum[r0][c0] });
        });
      }
      function kopyaYaz(sinir) {
        while (kopyalar.length && kopyalar[0].sutun < sinir) {
          var kp = kopyalar.shift(), c = satirlar[kp.r0].hucreler[kp.c0];
          var kalan = Math.min(kp.r0 + kp.n - 1, sonVeri) - ri + 1;
          var ozn = ' data-kopya="1" data-bas="' + (kp.r0 - B) + '" data-rs="' + kp.n + '" data-sutun="' + kp.sutun + '"' + (kalan > 1 ? ' rowspan="' + kalan + '"' : "");
          if (c.gridSpan > 1) ozn += ' colspan="' + c.gridSpan + '"';
          x += hucreHtml(c, ozn, birlesikKenar(kp.r0 + ":" + kp.c0, c));
        }
      }
      function birlesikKenar(anahtar, c) {
        // Birleşik hücrenin alt kenarı Word'deki gibi son "continue" hücresinden gelir
        var sonH = bilgi.sonHucre[anahtar];
        if (!sonH || sonH === c || !sonH.kenar || !sonH.kenar.bottom) return c.kenar;
        var k = {};
        for (var y in (c.kenar || {})) k[y] = c.kenar[y];
        k.bottom = sonH.kenar.bottom;
        return k;
      }
      kopyalar.sort(function (a, b) { return a.sutun - b.sutun; });
      (s.hucreler || []).forEach(function (c, ci) {
        var sutun = bilgi.konum[ri][ci];
        kopyaYaz(sutun + 1);
        if (c.vMerge === "continue") return;
        var ozn = ' data-sutun="' + sutun + '"';
        if (c.gridSpan > 1) ozn += ' colspan="' + c.gridSpan + '"';
        var n = bilgi.span[ri + ":" + ci];
        if (n > 1) {
          var gorunen = baslik ? n : Math.min(ri + n - 1, sonVeri) - ri + 1;
          ozn += ' data-rs="' + n + '"' + (gorunen > 1 ? ' rowspan="' + gorunen + '"' : "");
        }
        x += hucreHtml(c, ozn, n > 1 ? birlesikKenar(ri + ":" + ci, c) : null);
      });
      kopyaYaz(Infinity);
      return x + "</tr>";
    }
    for (var i = 0; i < B; i++) h += satirHtml(i);
    for (var j = ilkVeri; j <= sonVeri; j++) h += satirHtml(j);
    return h + "</tbody></table>";
  }

  function sayfaHtml(model, ic, no, toplam) {
    return '<section class="sayfa"><header class="ust-bilgi">' + (model.ust || []).map(function (p) { return parHtml(p, no, toplam); }).join("") +
      '</header><div class="sayfa-govde">' + ic + '</div><footer class="alt-bilgi">' +
      (model.alt || []).map(function (p) { return parHtml(p, no, toplam); }).join("") + "</footer></section>";
  }

  /** Belge modelini sayfalara bölünmüş HTML'e dönüştürür (saf dize işlevi; tarayıcıda
      BEP.sayfalariYerlestir ile gerçek ölçüme göre yeniden sayfalanır) */
  BEP.onizlemeHtml = function (model) {
    var sayfalar = [[]];
    var ysBekliyor = false;
    function sayfaAc() { if (sayfalar[sayfalar.length - 1].length) sayfalar.push([]); }
    (model.govde || []).forEach(function (o, oi) {
      if (o.tip === "sayfaSonu") { sayfaAc(); ysBekliyor = true; return; }
      if (o.pageBreakBefore) { sayfaAc(); ysBekliyor = true; }
      var ys = ysBekliyor;
      ysBekliyor = false;
      if (o.tip === "p") {
        sayfalar[sayfalar.length - 1].push({ o: o, ys: ys });
        return;
      }
      if (o.tip !== "tablo") return;
      // Tablo: Word için tahmin edilen (sayfaBasi) ve zorunlu (zorunluSayfaBasi) kesmelerden ilk bölme
      var bilgi = tabloBilgisi(o);
      var veriSayisi = (o.satirlar || []).length - bilgi.basSayisi;
      var kesme = {};
      [o.sayfaBasi, o.zorunluSayfaBasi].forEach(function (k) { if (k) Object.keys(k).forEach(function (x) { if (k[x]) kesme[x] = true; }); });
      var bas = 0;
      for (var k = 1; k <= veriSayisi; k++) {
        if (k < veriSayisi && !kesme[k]) continue;
        if (bas > 0) sayfaAc();
        sayfalar[sayfalar.length - 1].push({ o: o, bilgi: bilgi, no: oi, bas: bas, son: k, ys: bas === 0 ? ys : !!(o.zorunluSayfaBasi && o.zorunluSayfaBasi[bas]) });
        bas = k;
      }
      if (veriSayisi <= 0) sayfalar[sayfalar.length - 1].push({ o: o, bilgi: bilgi, no: oi, bas: 0, son: 0, ys: ys });
    });
    if (sayfalar.length > 1 && !sayfalar[sayfalar.length - 1].length) sayfalar.pop();
    var toplam = sayfalar.length;
    return sayfalar.map(function (ogeler, i) {
      var ic = ogeler.map(function (g) {
        if (g.o.tip === "p") {
          var ek = (g.o.keepNext ? ' data-kn="1"' : "") + (g.ys ? ' data-ys="1"' : "");
          return parHtml(g.o, i + 1, toplam, ek);
        }
        return tabloHtml(g.o, g.bilgi, g.no, g.bas, g.son, g.ys);
      }).join("");
      return sayfaHtml(model, ic, i + 1, toplam);
    }).join("");
  };

  /* ------------------------------------------------------------------ gerçek ölçümle sayfalama */

  function dizi(x) { return Array.prototype.slice.call(x || []); }

  /* Sayfalardaki içeriği tek bir akışa çevirir. Önceki sayfalamadan kalan tablo parçaları
     birleştirilir, tekrarlanan başlık satırları ve yeniden oluşturulmuş birleşik hücreler atılır. */
  function akisiCikar(sayfalar) {
    var bloklar = [], sonTablo = null;
    sayfalar.forEach(function (s) {
      var govde = s.querySelector(".sayfa-govde");
      dizi(govde && govde.children).forEach(function (e) {
        var no = e.tagName === "TABLE" ? e.getAttribute("data-tablo") : null;
        if (no !== null && sonTablo && sonTablo.no === no) { tabloSatirlariniAl(sonTablo, e, false); return; }
        if (no !== null) {
          var kabuk = e.cloneNode(false), cg = e.querySelector("colgroup");
          if (cg) kabuk.appendChild(cg.cloneNode(true));
          kabuk.appendChild(e.ownerDocument.createElement("tbody"));
          sonTablo = { tur: "tablo", no: no, kabuk: kabuk, ys: e.hasAttribute("data-ys"), basliklar: [], satirlar: [], gorulen: {} };
          tabloSatirlariniAl(sonTablo, e, true);
          bloklar.push(sonTablo);
          return;
        }
        sonTablo = null;
        bloklar.push({ tur: "p", el: e.cloneNode(true), ys: e.hasAttribute("data-ys") });
      });
    });
    bloklar.forEach(function (b) { if (b.tur === "tablo") tabloyuHazirla(b); });
    return bloklar;
  }

  function tabloSatirlariniAl(t, tablo, ilkParca) {
    dizi(tablo.rows).forEach(function (tr) {
      // Bölünmüş satırın devamı: içerik asıl satırın hücrelerine geri eklenir
      if (tr.hasAttribute("data-devam")) { devamiBirlestir(t.gorulen[tr.getAttribute("data-devam")], tr); return; }
      if (!tr.hasAttribute("data-satir")) { if (ilkParca) t.basliklar.push(tr.cloneNode(true)); return; }
      var r = tr.getAttribute("data-satir");
      if (t.gorulen[r]) return;
      var k = tr.cloneNode(true);
      t.gorulen[r] = k;
      dizi(k.cells).forEach(function (td) {
        if (td.hasAttribute("data-kopya")) { k.removeChild(td); return; }
        var n = +td.getAttribute("data-rs") || 1;
        if (n > 1) td.setAttribute("rowspan", n); else td.removeAttribute("rowspan");
      });
      t.satirlar.push(k);
    });
  }

  /* Devam satırının hücrelerini (kopya ve etiket hücreleri hariç) asıl satırın aynı sütundaki hücrelerine ekler.
     Eski sayfalar yerleşim bitene kadar bozulmasın diye kopyalanarak alınır. */
  function devamiBirlestir(asil, devam) {
    if (!asil) return;
    dizi(devam.cells).forEach(function (td) {
      if (td.hasAttribute("data-kopya") || td.hasAttribute("data-etiket")) return;
      var sutun = td.getAttribute("data-sutun"), hedef = null;
      dizi(asil.cells).some(function (c) { if (c.getAttribute("data-sutun") === sutun) { hedef = c; return true; } return false; });
      if (!hedef) return;
      parcaBirlestir(hedef, td.cloneNode(true));
      hedef.normalize();
    });
  }

  /* b'nin içeriğini a'nın sonuna taşır. Bölmede ikiye ayrılmış öğe (a'nın son öğesi data-bol) b'nin ilk
     öğesiyle tek öğe olur; b'nin parçası da sonraki parçada sürüyorsa işaret birleşik öğede kalır. */
  function parcaBirlestir(a, b) {
    var x = a.lastChild, y = b.firstChild;
    if (x && y && x.nodeType === 1 && y.nodeType === 1 && x.hasAttribute("data-bol")) {
      if (!y.hasAttribute("data-bol")) x.removeAttribute("data-bol");
      parcaBirlestir(x, y);
      b.removeChild(y);
    }
    while (b.firstChild) a.appendChild(b.firstChild);
  }

  /* Paragraf içindeki bölme noktaları, belge sırasıyla: <br> satır sonlarından sonra; kelime ise ayrıca
     boşluktan sonraki her kelime başı. Bir öğenin başına/sonuna düşen nokta üst düzeye taşınır (boş parça olmasın). */
  function bolmeNoktalari(p, kelime) {
    var l = [];
    function ekle(d, o) {
      while (d !== p) {
        var n = d.nodeType === 3 ? d.data.length : d.childNodes.length;
        if (o !== 0 && o !== n) break;
        var i = dizi(d.parentNode.childNodes).indexOf(d);
        o = o === 0 ? i : i + 1;
        d = d.parentNode;
      }
      if (d === p && (o === 0 || o === p.childNodes.length)) return;
      var son = l[l.length - 1];
      if (!son || son.d !== d || son.o !== o) l.push({ d: d, o: o });
    }
    (function gez(e) {
      dizi(e.childNodes).forEach(function (c) {
        if (c.nodeType === 1) {
          if (c.tagName === "BR") ekle(c.parentNode, dizi(c.parentNode.childNodes).indexOf(c) + 1);
          else gez(c);
        } else if (c.nodeType === 3 && kelime) {
          for (var j = 1; j <= c.data.length; j++) {
            if (!/\s/.test(c.data.charAt(j - 1))) continue;
            if (j < c.data.length ? !/\s/.test(c.data.charAt(j)) : true) ekle(c, j);
          }
        }
      });
    })(p);
    return l;
  }

  /* Paragrafı noktadan ikiye ayırır: [ilk parça, devamı]. İlk parça ve noktada ikiye ayrılan
     satır içi öğeler data-bol ile işaretlenir (yeniden sayfalamada birleştirilir). */
  function paragrafiAyir(p, nokta) {
    var belge = p.ownerDocument, r1 = belge.createRange(), r2 = belge.createRange();
    r1.setStart(p, 0); r1.setEnd(nokta.d, nokta.o);
    r2.setStart(nokta.d, nokta.o); r2.setEnd(p, p.childNodes.length);
    var ilk = p.cloneNode(false), devam = p.cloneNode(false);
    ilk.appendChild(r1.cloneContents());
    devam.appendChild(r2.cloneContents());
    ilk.setAttribute("data-bol", "1");
    var e = ilk;
    for (var d = nokta.d; d !== p; d = d.parentNode) {
      if (d.nodeType !== 1 || !e.lastChild) continue;
      e = e.lastChild;
      e.setAttribute("data-bol", "1");
    }
    return [ilk, devam];
  }

  /* Satır sırası; devam satırında bölünen satırın sırası */
  function satirNo(tr) {
    var v = tr.getAttribute("data-satir");
    return v === null ? tr.getAttribute("data-devam") : v;
  }

  /* Satır grupları (birlikte kalacak satırlar) ve dikey birleşim kapsamları */
  function tabloyuHazirla(t) {
    var n = t.satirlar.length, uzanim = [];
    t.kapsamlar = [];
    t.satirlar.forEach(function (tr, i) {
      var u = i;
      dizi(tr.cells).forEach(function (td) {
        var rs = +td.getAttribute("data-rs") || 1;
        if (rs > 1) {
          t.kapsamlar.push({ bas: i, son: Math.min(n - 1, i + rs - 1), td: td, sutun: +td.getAttribute("data-sutun") || 0 });
          u = Math.max(u, i + rs - 1);
        }
      });
      if (tr.hasAttribute("data-kn")) u = Math.max(u, i + 1);
      uzanim.push(Math.min(n - 1, u));
    });
    t.gruplar = [];
    var i = 0;
    while (i < n) {
      var bas = i, son = uzanim[i];
      for (var j = i; j <= son; j++) son = Math.max(son, uzanim[j]);
      // Zorunlu sayfa başı olan satır grubu orada böler (birleşik hücre yeni sayfada yeniden oluşturulur)
      for (j = bas + 1; j <= son; j++) if (t.satirlar[j].hasAttribute("data-ys")) { son = j - 1; break; }
      t.gruplar.push({ bas: bas, son: son });
      i = son + 1;
    }
    // Başlık satırı olmayan kısa tablolar (ör. imza tablosu) bölünmesin
    if (!t.basliklar.length && n > 0 && n <= 2) t.gruplar = [{ bas: 0, son: n - 1 }];
  }

  /* Parçadaki birleşik hücrelerin rowspan değerlerini parçadaki satırlara göre düzeltir */
  function rowspanDuzelt(tbody) {
    var trler = dizi(tbody.rows).filter(function (tr) { return satirNo(tr) !== null; });
    if (!trler.length) return;
    var ilk = +satirNo(trler[0]), son = +satirNo(trler[trler.length - 1]);
    trler.forEach(function (tr) {
      dizi(tr.cells).forEach(function (td) {
        var rs = +td.getAttribute("data-rs") || 1;
        if (rs <= 1) return;
        var kopya = td.hasAttribute("data-kopya");
        var bas = kopya ? +td.getAttribute("data-bas") : +satirNo(tr);
        var adet = Math.min(bas + rs - 1, son) - (kopya ? ilk : bas) + 1;
        if (adet > 1) td.setAttribute("rowspan", adet); else td.removeAttribute("rowspan");
      });
    });
  }

  /* Sayfa içinde bloklarla (paragraf, tablo parçası) doldurma; her adımda gerçek yükseklik ölçülür */
  function yerlestir(bloklar, ustSablon, altSablon, alan, belge) {
    var sayfalar = [], sayfa = null, govde = null, sinir = 0;
    var tolerans = TOLERANS_MM * PX_MM;

    function yeniSayfa() {
      sayfa = belge.createElement("section");
      sayfa.className = "sayfa";
      sayfa.appendChild(ustSablon.cloneNode(true));
      govde = belge.createElement("div");
      govde.className = "sayfa-govde";
      sayfa.appendChild(govde);
      sayfa.appendChild(altSablon.cloneNode(true));
      alan.appendChild(sayfa);
      sayfalar.push(sayfa);
      var r = govde.getBoundingClientRect();
      var pb = parseFloat(belge.defaultView.getComputedStyle(govde).paddingBottom) || 0;
      sinir = r.bottom - pb - tolerans;
    }
    function sigiyor() {
      var son = govde.lastElementChild;
      return !son || son.getBoundingClientRect().bottom <= sinir;
    }
    function tasma() {
      // Tek başına bir sayfaya sığmayan, bölünemeyen öğe (olağan dışı; uzun tablo satırları bölünür):
      // içerik kaybolmasın diye sayfa uzar (yazdırmada da)
      sayfa.className += " tasma";
      yeniSayfa();
    }
    // el öncesinde, sayfa başına kadar uzanmayan bir içerik var mı? (keepNext zinciri hariç)
    function oncesiVar(el) {
      var e = el ? el.previousElementSibling : govde.lastElementChild;
      while (e && e.tagName === "P" && e.hasAttribute("data-kn")) e = e.previousElementSibling;
      return !!e;
    }
    // Yeni sayfaya geç; sayfanın sonundaki keepNext paragraflarını da birlikte götür
    function sayfaKes() {
      var zincir = [], e = govde.lastElementChild;
      while (e && e.tagName === "P" && e.hasAttribute("data-kn")) { zincir.unshift(e); e = e.previousElementSibling; }
      if (!e) zincir = [];
      zincir.forEach(function (z) { govde.removeChild(z); });
      yeniSayfa();
      zincir.forEach(function (z) { govde.appendChild(z); });
    }

    function paragrafYerlestir(b) {
      govde.appendChild(b.el);
      if (sigiyor()) return;
      if (oncesiVar(b.el)) {
        govde.removeChild(b.el);
        sayfaKes();
        govde.appendChild(b.el);
        if (sigiyor()) return;
      }
      tasma();
    }

    function tabloYerlestir(t) {
      var parca = null, tbody = null, veri = 0, parcaSayisi = 0;
      function parcaAc() {
        parca = t.kabuk.cloneNode(true);
        if (parcaSayisi++) parca.removeAttribute("data-ys"); // zorunlu sayfa başı yalnız ilk parçada
        tbody = parca.tBodies[0];
        t.basliklar.forEach(function (h) { tbody.appendChild(h.cloneNode(true)); });
        govde.appendChild(parca);
        veri = 0;
      }
      // i. satırı kapsayan, önceki sayfada (basDahil ise bu satırda) başlamış birleşik hücreleri (ör. AY)
      // sayfanın ilk satırında yeniden oluştur
      function kopyalariEkle(tr, i, basDahil) {
        t.kapsamlar.forEach(function (k) {
          if (k.son < i || k.bas > i || (k.bas === i && !basDahil)) return;
          var c = k.td.cloneNode(true);
          c.setAttribute("data-kopya", "1");
          c.setAttribute("data-bas", k.bas);
          var once = null;
          dizi(tr.cells).some(function (td) { if ((+td.getAttribute("data-sutun") || 0) > k.sutun) { once = td; return true; } return false; });
          tr.insertBefore(c, once);
        });
      }
      function satirEkle(i, devam) {
        var tr = t.satirlar[i].cloneNode(true);
        if (devam) kopyalariEkle(tr, i, false);
        tbody.appendChild(tr);
        veri++;
        rowspanDuzelt(tbody);
        return tr;
      }
      function satirKaldir(tr) { tbody.removeChild(tr); veri--; rowspanDuzelt(tbody); }

      /* Tek başına sayfaya sığmayan satırı böler: her hücrenin sığan kısmı satırda kalır, kalanı i. satırın
         devam satırına (tr[data-devam]) geçer. Hücrede önce bütün paragraflar, sonra sığmayan paragrafın <br>
         satırları; hiç paragraf sığmıyorsa son çare olarak kelime sınırı denenir. Birleşik hücreler (ör. AY)
         bölünmez, devam satırında kopya olarak yeniden oluşur. Dönüş: devam satırı; kalan yoksa false;
         bölünemiyorsa (ilerleme yok) null. */
      function satirBol(tr, i) {
        var hucreler = dizi(tr.cells).filter(function (td) { return !td.hasAttribute("data-kopya") && (+td.getAttribute("data-rs") || 1) <= 1; });
        var icerikler = hucreler.map(function (td) {
          var l = dizi(td.childNodes);
          l.forEach(function (n) { td.removeChild(n); });
          return l;
        });
        function geriAl() {
          hucreler.forEach(function (td, k) {
            while (td.firstChild) td.removeChild(td.firstChild);
            icerikler[k].forEach(function (n) { td.appendChild(n); });
          });
          return null;
        }
        if (!sigiyor()) return geriAl(); // boş hücrelerle de sığmıyor (birleşik hücre ya da başlık çok uzun)
        var kalanVar = false, ilerleme = false;
        var kalanlar = hucreler.map(function (td, k) {
          var d = hucreDoldur(td, icerikler[k]);
          if (d.kalan.length) { kalanVar = true; if (d.yerlesen) ilerleme = true; }
          return d.kalan;
        });
        if (!kalanVar) return false;
        if (!ilerleme) return geriAl();
        var devam = belge.createElement("tr");
        devam.setAttribute("data-devam", String(i));
        hucreler.forEach(function (td, k) {
          var c = td.cloneNode(false);
          c.removeAttribute("rowspan");
          kalanlar[k].forEach(function (n) { c.appendChild(n); });
          devam.appendChild(c);
        });
        // Bu sayfada tamamlanan ilk hücre (ör. hafta) devam satırında soluk "(devam)" etiketiyle yinelenir
        var e0 = hucreler[0], c0 = devam.firstChild;
        var metin = e0 ? e0.textContent.replace(/\s+/g, " ").trim() : "";
        if (e0 && !kalanlar[0].length && metin) {
          // Uzun etiket (ör. Bölüm 2'deki alan adı) kısaltılarak yinelenir
          if (metin.length <= 80) dizi(e0.childNodes).forEach(function (n) { c0.appendChild(n.cloneNode(true)); });
          else {
            var kopya = e0.cloneNode(true); // <br> ve paragraf sınırları boşluk olsun ("Düzeyi(Sayılar" yazılmasın)
            dizi(kopya.querySelectorAll("br, p, div, li")).forEach(function (n) { n.parentNode.insertBefore(belge.createTextNode(" "), n); });
            c0.textContent = kopya.textContent.replace(/\s+/g, " ").trim().slice(0, 70).replace(/\s+\S*$/, "") + "…";
          }
          if (!e0.hasAttribute("data-etiket")) {
            // Ayrı satırda, küçük ve bölünmeden (dar hafta sütununda "(devam" / ")" olmasın)
            var s = belge.createElement("span"), hedef = c0.lastElementChild || c0;
            s.style.cssText = "font-size:6pt;font-weight:400;font-style:italic;color:#4A5568;white-space:nowrap";
            s.textContent = "(devam)";
            hedef.appendChild(belge.createElement("br"));
            hedef.appendChild(s);
          }
          c0.setAttribute("data-etiket", "1");
        }
        kopyalariEkle(devam, i, true);
        return devam;
      }
      /* Hücreye içeriğini sığdığı kadar geri ekler; sığmayan kısmı ve yerleşen parça sayısını döndürür */
      function hucreDoldur(td, dugumler) {
        var k = 0;
        for (; k < dugumler.length; k++) {
          td.appendChild(dugumler[k]);
          if (!sigiyor()) { td.removeChild(dugumler[k]); break; }
        }
        var kalan = dugumler.slice(k), sonuc = { kalan: kalan, yerlesen: k };
        if (!kalan.length || kalan[0].nodeType !== 1) return sonuc;
        var p = kalan[0];
        var devam = enIyiBolme(td, p, bolmeNoktalari(p, false)) || (k === 0 ? enIyiBolme(td, p, bolmeNoktalari(p, true)) : null);
        if (devam) { kalan[0] = devam; sonuc.yerlesen++; }
        return sonuc;
      }
      /* Paragrafın sığan en uzun ilk parçasını veren nokta (ikili arama). Bulunursa ilk parça hücreye eklenir,
         devamı döner; bulunamazsa null. */
      function enIyiBolme(td, p, noktalar) {
        var alt = 0, ust = noktalar.length - 1, en = -1;
        while (alt <= ust) {
          var orta = (alt + ust) >> 1, ikili = paragrafiAyir(p, noktalar[orta]);
          td.appendChild(ikili[0]);
          var sigdi = sigiyor();
          td.removeChild(ikili[0]);
          if (sigdi) { en = orta; alt = orta + 1; } else ust = orta - 1;
        }
        if (en < 0) return null;
        var sonuc = paragrafiAyir(p, noktalar[en]);
        td.appendChild(sonuc[0]);
        return sonuc[1];
      }
      function grupEkle(g) {
        var eklenen = [];
        for (var i = g.bas; i <= g.son; i++) eklenen.push(satirEkle(i, veri === 0));
        if (sigiyor()) return true;
        eklenen.reverse().forEach(satirKaldir);
        return false;
      }
      // Satır boş bir sayfaya da sığmayacaksa (nasılsa bölünecek) ve bu sayfada en az çeyrek sayfa yer varsa
      // sonraki sayfaya taşınmadan burada bölünür (boş kalan sayfa yarısı ve fazladan kâğıt olmasın)
      function yerindeBolunur(tr) {
        var ilkVeri = null;
        dizi(tbody.rows).some(function (x) { if (satirNo(x) !== null) { ilkVeri = x; return true; } return false; });
        var pb = parseFloat(belge.defaultView.getComputedStyle(govde).paddingTop) || 0;
        var kapasite = sinir - (govde.getBoundingClientRect().top + pb) - (ilkVeri.getBoundingClientRect().top - parca.getBoundingClientRect().top);
        var r = tr.getBoundingClientRect();
        return r.height > kapasite + PX_MM && sinir - r.top >= kapasite / 4;
      }
      // Parçayı kapatıp yeni sayfada yenisini aç. Parça boşsa (yalnız başlık) önündeki keepNext zinciriyle taşınır.
      function yeniParca() {
        if (veri === 0) { govde.removeChild(parca); sayfaKes(); } else { rowspanDuzelt(tbody); yeniSayfa(); }
        parcaAc();
      }

      parcaAc();
      if (!t.satirlar.length) {
        // Yalnız başlık satırlarından oluşan tablo: paragraf gibi bütün olarak yerleştir
        if (sigiyor()) return;
        if (oncesiVar(parca)) { govde.removeChild(parca); sayfaKes(); govde.appendChild(parca); if (sigiyor()) return; }
        tasma();
        return;
      }
      t.gruplar.forEach(function (g) {
        var zorunlu = t.satirlar[g.bas].hasAttribute("data-ys");
        if (zorunlu && (veri > 0 || oncesiVar(parca))) yeniParca();
        if (grupEkle(g)) return;
        // Grup bu sayfaya sığmadı: mümkünse bütün olarak sonraki sayfaya taşı
        if (veri > 0 || oncesiVar(parca)) {
          yeniParca();
          if (grupEkle(g)) return;
        }
        // Grup boş sayfaya da sığmıyor: satır satır böl
        for (var i = g.bas; i <= g.son; i++) {
          var tr = satirEkle(i, veri === 0);
          if (sigiyor()) continue;
          if ((veri > 1 || oncesiVar(parca)) && !yerindeBolunur(tr)) {
            satirKaldir(tr);
            yeniParca();
            tr = satirEkle(i, true);
            if (sigiyor()) continue;
          }
          // Tek satır bile sayfaya sığmıyor: hücre içeriklerinden bölünür, kalanı sonraki sayfalarda başlık
          // satırı tekrarıyla sürer (her .sayfa tek kâğıt kalır)
          while (tr) {
            var devam = satirBol(tr, i);
            if (devam === null) { rowspanDuzelt(tbody); tasma(); parcaAc(); break; } // bölünemiyor (olağan dışı)
            if (!devam) break;
            yeniParca();
            tbody.appendChild(devam);
            veri++;
            rowspanDuzelt(tbody);
            tr = sigiyor() ? null : devam;
          }
        }
      });
      if (veri === 0 && parca.parentNode) parca.parentNode.removeChild(parca);
      else rowspanDuzelt(tbody);
    }

    yeniSayfa();
    bloklar.forEach(function (b) {
      if (b.ys && govde.children.length) yeniSayfa();
      if (b.tur === "tablo") tabloYerlestir(b);
      else paragrafYerlestir(b);
    });
    // Boş kalan sayfaları (ör. sonda) at
    sayfalar = sayfalar.filter(function (s, i) {
      var g = s.querySelector(".sayfa-govde");
      if (g.children.length || (i === 0 && sayfalar.length === 1)) return true;
      s.parentNode.removeChild(s);
      return false;
    });
    return sayfalar;
  }

  function numarala(sayfalar) {
    sayfalar.forEach(function (s, i) {
      dizi(s.querySelectorAll('[data-alan="PAGE"]')).forEach(function (e) { e.textContent = String(i + 1); });
      dizi(s.querySelectorAll('[data-alan="NUMPAGES"]')).forEach(function (e) { e.textContent = String(sayfalar.length); });
    });
  }

  /**
   * BEP.onizlemeHtml çıktısını içeren öğeyi tarayıcıdaki gerçek ölçüme göre yerinde yeniden sayfalar.
   * Ölçüm, belgeye geçici olarak eklenen ekran dışı bir alanda ölçeksiz (zoom 1) yapılır; bu yüzden
   * kapsayıcı gizli (display:none) olsa ya da sayfalara CSS zoom uygulanmış olsa da sonuç doğrudur.
   * Tekrar çağrılabilir. Sayfa sayısını döndürür.
   */
  BEP.sayfalariYerlestir = function (kapsayici) {
    if (!kapsayici || !kapsayici.querySelectorAll) return 0;
    var belge = kapsayici.ownerDocument;
    var eskiler = dizi(kapsayici.querySelectorAll(".sayfa"));
    if (!eskiler.length || !belge || !belge.body || !belge.defaultView) return eskiler.length;
    var ust = eskiler[0].querySelector(".ust-bilgi"), alt = eskiler[0].querySelector(".alt-bilgi");
    if (!ust || !alt || !eskiler[0].querySelector(".sayfa-govde")) return eskiler.length;
    ust = ust.cloneNode(true);
    alt = alt.cloneNode(true);
    // Sayfa numarası en geniş hâliyle ölçülsün (alt bilgi sonradan genişleyip içeriğe binmesin)
    [ust, alt].forEach(function (b) { dizi(b.querySelectorAll("[data-alan]")).forEach(function (e) { e.textContent = YER_TUTUCU; }); });
    var bloklar = akisiCikar(eskiler);

    var alan = belge.createElement("div");
    alan.setAttribute("aria-hidden", "true");
    alan.style.cssText = "position:fixed;left:-30000px;top:0;width:297mm;visibility:hidden;pointer-events:none;zoom:1;";
    belge.body.appendChild(alan);
    var sayfalar;
    try {
      sayfalar = yerlestir(bloklar, ust, alt, alan, belge);
    } finally {
      if (alan.parentNode) alan.parentNode.removeChild(alan);
    }
    numarala(sayfalar);
    var parca = belge.createDocumentFragment();
    sayfalar.forEach(function (s) { parca.appendChild(s); });
    eskiler[0].parentNode.insertBefore(parca, eskiler[0]);
    eskiler.forEach(function (s) { if (s.parentNode) s.parentNode.removeChild(s); });
    return sayfalar.length;
  };

  /**
   * Belgeyi #yazdirma-alani'na çizer (yoksa oluşturur), gerçek ölçümle sayfalar ve düzen oturduktan
   * sonra yazdırma penceresini açar.
   */
  var yazdirmaNo = 0;
  BEP.yazdir = function (model) {
    var belge = kok.document;
    var alan = belge.getElementById("yazdirma-alani");
    if (!alan) {
      alan = belge.createElement("div");
      alan.id = "yazdirma-alani";
      belge.body.appendChild(alan);
    }
    alan.innerHTML = BEP.onizlemeHtml(model);
    var no = ++yazdirmaNo, bitti = false;
    function sayfalaVeYazdir() {
      if (bitti || no !== yazdirmaNo) return; // art arda tıklamada yalnız son istek yazdırılır
      bitti = true;
      try { BEP.sayfalariYerlestir(alan); } catch (e) { if (kok.console) kok.console.error(e); }
      // Yeni sayfaların stil ve düzeni otursun, sonra yazdır
      setTimeout(function () { kok.print(); }, 50);
    }
    // Yazı tipleri yüklenmeden ölçülürse satır uzunlukları yanlış olur
    if (belge.fonts && belge.fonts.ready && belge.fonts.ready.then) {
      belge.fonts.ready.then(sayfalaVeYazdir, sayfalaVeYazdir);
      setTimeout(sayfalaVeYazdir, 1500);
    } else setTimeout(sayfalaVeYazdir, 0);
  };

  BEP.ONIZLEME_CSS =
    ".onizleme-kapsayici{--olcek:.62}" +
    // Sayfa: üst bilgi 5 mm'den, gövde en erken 12 mm'den başlar; alt bilgi alttan 5 mm'de biter (Word ile aynı).
    // Üst/alt bilgi akış içindedir: uzarlarsa gövde küçülür, içerikle çakışmazlar. Sayfalama ölçeksiz (zoom 1)
    // ölçüme göre yapıldığından ekranda sayfa tam 210 mm'dir; CSS zoom ile küçültülmüş önizlemede satırlar biraz
    // farklı kayabilir, bu durumda içerik kırpılmasın diye sayfa uzar (yazdırmada yükseklik sabittir).
    ".sayfa{position:relative;display:flex;flex-direction:column;width:297mm;min-height:210mm;padding:5mm 15mm;box-sizing:border-box;background:#fff;margin:0 auto 10mm auto;" +
    "box-shadow:0 2px 12px rgba(15,23,42,.18);font-family:Calibri,Carlito,'Segoe UI',Arial,sans-serif;font-size:8pt;line-height:1.2207;font-weight:400;font-style:normal;" +
    "letter-spacing:normal;word-spacing:normal;text-transform:none;text-indent:0;white-space:normal;-webkit-text-size-adjust:100%;text-size-adjust:100%;color:#1A202C}" +
    ".sayfa p{margin:0}" +
    ".ust-bilgi{flex:none;min-height:7mm}" +
    ".alt-bilgi{flex:none;min-height:7mm;display:flex;flex-direction:column;justify-content:flex-end}" +
    ".sayfa-govde{flex:1 1 auto;min-height:0;padding-top:2mm}" +
    "table.bt{border-collapse:collapse;table-layout:fixed;margin:0 auto}" +
    "table.bt td{border:.5pt solid #CBD5E1;padding:.8mm 1.23mm;overflow-wrap:anywhere}" +
    ".sekme{display:none}" +
    "@media print{@page{size:A4 landscape;margin:0}body *{visibility:hidden}#yazdirma-alani,#yazdirma-alani *{visibility:visible}" +
    "#yazdirma-alani{position:absolute;left:0;top:0;width:297mm}" +
    "#yazdirma-alani .sayfa{height:210mm;overflow:hidden;box-shadow:none;margin:0;zoom:1!important;break-inside:avoid;page-break-inside:avoid;-webkit-print-color-adjust:exact;print-color-adjust:exact}" +
    "#yazdirma-alani .sayfa+.sayfa{break-before:page;page-break-before:always}" +
    // Tek başına bir sayfadan uzun öğe (olağan dışı): kırpılmasın, sonraki kâğıda taşsın
    "#yazdirma-alani .sayfa.tasma{height:auto;overflow:visible;break-inside:auto;page-break-inside:auto}}";
})(typeof window !== "undefined" ? window : globalThis);
