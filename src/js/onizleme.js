/*
 * BEP Hazırlama Aracı — HTML önizleme ve yazdırma
 * Word ile aynı belge modelinden A4 yatay sayfalar üretir. Tarayıcının
 * "Yazdır > PDF olarak kaydet" özelliğiyle doğrudan PDF alınabilir.
 */
(function (kok) {
  "use strict";
  var BEP = (kok.BEP = kok.BEP || {});
  var MM = 25.4 / 1440; // twip -> mm

  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function runHtml(r, sayfaNo, toplam) {
    var st = "font-size:" + ((r.sz || 16) / 2) + "pt;";
    if (r.b) st += "font-weight:700;";
    if (r.i) st += "font-style:italic;";
    if (r.color) st += "color:#" + r.color + ";";
    var t = r.alan === "PAGE" ? String(sayfaNo) : r.alan === "NUMPAGES" ? String(toplam) : r.t;
    var html = esc(t).replace(/\n/g, "<br>");
    if (r.t === "\t") return '<span class="sekme"></span>';
    return '<span style="' + st + '">' + html + "</span>";
  }

  function parHtml(p, sayfaNo, toplam) {
    var st = "text-align:" + ({ left: "left", center: "center", right: "right", both: "justify" }[p.jc] || "left") + ";";
    st += "margin:" + ((p.before || 0) / 20) + "pt 0 " + ((p.after || 0) / 20) + "pt 0;";
    st += "line-height:" + ((p.line || 240) / 240 * 1.17).toFixed(3) + ";";
    if (p.sekme) st += "display:flex;justify-content:space-between;gap:8mm;";
    var runs = (p.runs || []);
    if (p.sekme) {
      var sol = [], sag = [], hedef = sol;
      runs.forEach(function (r) { if (r.t === "\t") { hedef = sag; return; } hedef.push(r); });
      return '<p style="' + st + '"><span>' + sol.map(function (r) { return runHtml(r, sayfaNo, toplam); }).join("") + "</span><span>" +
        sag.map(function (r) { return runHtml(r, sayfaNo, toplam); }).join("") + "</span></p>";
    }
    var ic = runs.map(function (r) { return runHtml(r, sayfaNo, toplam); }).join("");
    return '<p style="' + st + '">' + (ic || "&nbsp;") + "</p>";
  }

  function kenarCss(k) {
    if (!k) return "";
    var s = "";
    ["top", "left", "bottom", "right"].forEach(function (y) {
      if (k[y]) s += "border-" + y + ":" + (k[y].sz / 8).toFixed(2) + "pt solid #" + k[y].color + ";";
    });
    return s;
  }

  function tabloHtml(t, satirlar) {
    var toplam = t.genislikler.reduce(function (a, b) { return a + b; }, 0);
    var h = '<table class="bt" style="width:' + (toplam * MM).toFixed(1) + 'mm"><colgroup>' +
      t.genislikler.map(function (w) { return '<col style="width:' + (w * MM).toFixed(2) + 'mm">'; }).join("") + "</colgroup>";
    // dikey birleşimler için rowspan hesapla
    var span = {};
    satirlar.forEach(function (s, ri) {
      s.hucreler.forEach(function (c, ci) {
        if (c.vMerge === "restart") {
          var n = 1;
          for (var k = ri + 1; k < satirlar.length; k++) {
            var cc = satirlar[k].hucreler[ci];
            if (cc && cc.vMerge === "continue") n++; else break;
          }
          span[ri + ":" + ci] = n;
        }
      });
    });
    satirlar.forEach(function (s, ri) {
      h += "<tr" + (s.baslik ? ' class="bas"' : "") + ">";
      s.hucreler.forEach(function (c, ci) {
        if (c.vMerge === "continue") return;
        var st = "background:#" + (c.fill || "FFFFFF") + ";vertical-align:" + (c.vAlign === "top" ? "top" : "middle") + ";" + kenarCss(c.kenar);
        var rs = span[ri + ":" + ci];
        h += "<td" + (rs > 1 ? ' rowspan="' + rs + '"' : "") + ' style="' + st + '">' + (c.paragraflar || []).map(function (p) { return parHtml(p); }).join("") + "</td>";
      });
      h += "</tr>";
    });
    return h + "</table>";
  }

  /** Belge modelini sayfalara bölünmüş HTML'e dönüştürür */
  BEP.onizlemeHtml = function (model) {
    var sayfalar = [[]];
    model.govde.forEach(function (o) {
      var aktif = sayfalar[sayfalar.length - 1];
      if (o.tip === "sayfaSonu") { sayfalar.push([]); return; }
      if (o.tip === "tablo" && o.sayfaBasi && Object.keys(o.sayfaBasi).length) {
        // plan tablosunu tahmini sayfa kesmelerinden böl, başlık satırını tekrarla
        var bas = o.satirlar[0], parca = [bas], veriIndeks = 0;
        o.satirlar.slice(1).forEach(function (s) {
          if (o.sayfaBasi[veriIndeks] && parca.length > 1) {
            aktif.push({ tip: "tablo", genislikler: o.genislikler, satirlar: parca });
            sayfalar.push([]); aktif = sayfalar[sayfalar.length - 1];
            parca = [bas];
          }
          parca.push(s);
          veriIndeks++;
        });
        aktif.push({ tip: "tablo", genislikler: o.genislikler, satirlar: parca });
        return;
      }
      aktif.push(o);
    });
    var toplam = sayfalar.length;
    return sayfalar.map(function (ogeler, i) {
      var ic = ogeler.map(function (o) {
        if (o.tip === "p") return parHtml(o, i + 1, toplam);
        if (o.tip === "tablo") return tabloHtml(o, o.satirlar);
        return "";
      }).join("");
      return '<section class="sayfa"><header class="ust-bilgi">' + (model.ust || []).map(function (p) { return parHtml(p, i + 1, toplam); }).join("") +
        '</header><div class="sayfa-govde">' + ic + '</div><footer class="alt-bilgi">' +
        (model.alt || []).map(function (p) { return parHtml(p, i + 1, toplam); }).join("") + "</footer></section>";
    }).join("");
  };

  BEP.ONIZLEME_CSS =
    ".onizleme-kapsayici{--olcek:.62}" +
    ".sayfa{position:relative;width:297mm;min-height:210mm;padding:12mm 15mm 12mm 15mm;box-sizing:border-box;background:#fff;margin:0 auto 10mm auto;" +
    "box-shadow:0 2px 12px rgba(15,23,42,.18);font-family:Calibri,Carlito,'Segoe UI',Arial,sans-serif;color:#1A202C;overflow:hidden}" +
    ".sayfa p{margin:0}" +
    ".ust-bilgi{position:absolute;top:5mm;left:15mm;right:15mm}" +
    ".alt-bilgi{position:absolute;bottom:5mm;left:15mm;right:15mm}" +
    ".sayfa-govde{padding-top:2mm}" +
    "table.bt{border-collapse:collapse;table-layout:fixed;margin:0 auto}" +
    "table.bt td{border:.5pt solid #CBD5E1;padding:.8mm 1.23mm;overflow-wrap:anywhere}" +
    ".sekme{display:none}" +
    "@media print{@page{size:A4 landscape;margin:0}body *{visibility:hidden}#yazdirma-alani,#yazdirma-alani *{visibility:visible}" +
    "#yazdirma-alani{position:absolute;left:0;top:0;width:297mm}" +
    "#yazdirma-alani .sayfa{box-shadow:none;margin:0;page-break-after:always;break-after:page;height:210mm;zoom:1!important}}";
})(typeof window !== "undefined" ? window : globalThis);
