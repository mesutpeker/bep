/*
 * BEP Hazırlama Aracı — Word (.docx / OOXML) yazıcı
 * Belge modelini WordprocessingML'e dönüştürür ve ZIP paketi oluşturur.
 * Kritik tablo kuralları: tblLayout fixed, cantSplit, tblHeader, keepNext, pageBreakBefore, vMerge.
 */
(function (kok) {
  "use strict";
  var BEP = (kok.BEP = kok.BEP || {});
  var NS_W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  var NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function rPr(r) {
    var x = '<w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/>';
    if (r.b) x += "<w:b/><w:bCs/>";
    if (r.i) x += "<w:i/><w:iCs/>";
    if (r.color) x += '<w:color w:val="' + r.color + '"/>';
    if (r.sz) x += '<w:sz w:val="' + r.sz + '"/><w:szCs w:val="' + r.sz + '"/>';
    return x + "</w:rPr>";
  }

  function runXml(r) {
    var pr = rPr(r);
    if (r.alan) {
      return '<w:r>' + pr + '<w:fldChar w:fldCharType="begin"/></w:r>' +
        '<w:r>' + pr + '<w:instrText xml:space="preserve"> ' + r.alan + ' </w:instrText></w:r>' +
        '<w:r>' + pr + '<w:fldChar w:fldCharType="separate"/></w:r>' +
        '<w:r>' + pr + '<w:t>1</w:t></w:r>' +
        '<w:r>' + pr + '<w:fldChar w:fldCharType="end"/></w:r>';
    }
    var x = "<w:r>" + pr;
    var satirlar = String(r.t).split("\n");
    satirlar.forEach(function (s, i) {
      if (i > 0) x += "<w:br/>";
      var parcalar = s.split("\t");
      parcalar.forEach(function (p, j) {
        if (j > 0) x += "<w:tab/>";
        if (p.length) x += '<w:t xml:space="preserve">' + esc(p) + "</w:t>";
      });
    });
    return x + "</w:r>";
  }

  function pPr(p) {
    var x = "<w:pPr>";
    if (p.keepNext) x += "<w:keepNext/>";
    if (p.keepLines) x += "<w:keepLines/>";
    if (p.pageBreakBefore) x += "<w:pageBreakBefore/>";
    if (p.sekme) x += '<w:tabs><w:tab w:val="right" w:pos="' + p.sekme + '"/></w:tabs>';
    x += '<w:spacing w:before="' + (p.before || 0) + '" w:after="' + (p.after || 0) + '" w:line="' + (p.line || 240) + '" w:lineRule="auto"/>';
    if (p.jc) x += '<w:jc w:val="' + p.jc + '"/>';
    return x + "</w:pPr>";
  }

  function parXml(p) {
    return "<w:p>" + pPr(p) + (p.runs || []).map(runXml).join("") + "</w:p>";
  }

  function kenarXml(k) {
    if (!k) return "";
    var cizgi = function (ad) {
      var v = k[ad];
      if (!v) return '<w:' + ad + ' w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>';
      return '<w:' + ad + ' w:val="single" w:sz="' + v.sz + '" w:space="0" w:color="' + v.color + '"/>';
    };
    return "<w:tcBorders>" + cizgi("top") + cizgi("left") + cizgi("bottom") + cizgi("right") + "</w:tcBorders>";
  }

  function hucreXml(h) {
    var x = '<w:tc><w:tcPr><w:tcW w:w="' + h.w + '" w:type="dxa"/>';
    if (h.gridSpan) x += '<w:gridSpan w:val="' + h.gridSpan + '"/>';
    if (h.vMerge === "restart") x += '<w:vMerge w:val="restart"/>';
    else if (h.vMerge === "continue") x += "<w:vMerge/>";
    x += kenarXml(h.kenar);
    if (h.fill) x += '<w:shd w:val="clear" w:color="auto" w:fill="' + h.fill + '"/>';
    x += '<w:tcMar><w:top w:w="45" w:type="dxa"/><w:left w:w="70" w:type="dxa"/><w:bottom w:w="45" w:type="dxa"/><w:right w:w="70" w:type="dxa"/></w:tcMar>';
    x += '<w:vAlign w:val="' + (h.vAlign || "center") + '"/></w:tcPr>';
    var ps = h.paragraflar && h.paragraflar.length ? h.paragraflar : [{ tip: "p", runs: [] }];
    return x + ps.map(parXml).join("") + "</w:tc>";
  }

  function tabloXml(t) {
    var toplam = t.genislikler.reduce(function (a, b) { return a + b; }, 0);
    var x = '<w:tbl><w:tblPr><w:tblW w:w="' + toplam + '" w:type="dxa"/><w:jc w:val="center"/>' +
      '<w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/><w:left w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>' +
      '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/><w:right w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>' +
      '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/></w:tblBorders>' +
      '<w:tblLayout w:type="fixed"/>' +
      '<w:tblCellMar><w:top w:w="45" w:type="dxa"/><w:left w:w="70" w:type="dxa"/><w:bottom w:w="45" w:type="dxa"/><w:right w:w="70" w:type="dxa"/></w:tblCellMar>' +
      '<w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr>';
    x += "<w:tblGrid>" + t.genislikler.map(function (w) { return '<w:gridCol w:w="' + w + '"/>'; }).join("") + "</w:tblGrid>";
    t.satirlar.forEach(function (s) {
      x += "<w:tr><w:trPr>" + (s.cantSplit !== false ? "<w:cantSplit/>" : "") + (s.baslik ? "<w:tblHeader/>" : "") + "</w:trPr>";
      x += s.hucreler.map(hucreXml).join("") + "</w:tr>";
    });
    return x + "</w:tbl>";
  }

  function govdeXml(ogeler) {
    var x = "";
    ogeler.forEach(function (o, i) {
      if (o.tip === "p") x += parXml(o);
      else if (o.tip === "tablo") {
        x += tabloXml(o);
        // Word, tablo ardından gelen öğe tablo/sayfa sonu ise arada paragraf ister
        var sonraki = ogeler[i + 1];
        if (!sonraki || sonraki.tip !== "p") x += '<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="120" w:lineRule="auto"/></w:pPr></w:p>';
      } else if (o.tip === "sayfaSonu") x += '<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="120" w:lineRule="auto"/></w:pPr><w:r><w:br w:type="page"/></w:r></w:p>';
    });
    return x;
  }

  var S = function () { return BEP.SAYFA; };

  function belgeXml(model) {
    var s = S();
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="' + NS_W + '" xmlns:r="' + NS_R + '"><w:body>' + govdeXml(model.govde) +
      '<w:sectPr><w:headerReference w:type="default" r:id="rIdUst1"/><w:footerReference w:type="default" r:id="rIdAlt1"/>' +
      '<w:pgSz w:w="' + s.w + '" w:h="' + s.h + '" w:orient="landscape"/>' +
      '<w:pgMar w:top="' + s.ust + '" w:right="' + s.sag + '" w:bottom="' + s.alt + '" w:left="' + s.sol + '" w:header="' + s.ustBilgi + '" w:footer="' + s.altBilgi + '" w:gutter="0"/>' +
      '<w:cols w:space="708"/><w:docGrid w:linePitch="360"/></w:sectPr></w:body></w:document>';
  }

  function ustAltXml(etiket, paragraflar) {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:' + etiket + ' xmlns:w="' + NS_W + '" xmlns:r="' + NS_R + '">' +
      paragraflar.map(parXml).join("") + "</w:" + etiket + ">";
  }

  var STILLER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:styles xmlns:w="' + NS_W + '"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:eastAsia="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>' +
    '<w:sz w:val="16"/><w:szCs w:val="16"/><w:lang w:val="tr-TR" w:eastAsia="en-US" w:bidi="ar-SA"/></w:rPr></w:rPrDefault>' +
    '<w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
    '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>' +
    '<w:style w:type="character" w:default="1" w:styleId="VarsayilanParagrafYazitipi"><w:name w:val="Default Paragraph Font"/><w:uiPriority w:val="1"/><w:semiHidden/><w:unhideWhenUsed/></w:style>' +
    '<w:style w:type="table" w:default="1" w:styleId="NormalTablo"><w:name w:val="Normal Table"/><w:uiPriority w:val="99"/><w:semiHidden/><w:unhideWhenUsed/>' +
    '<w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>' +
    '<w:style w:type="numbering" w:default="1" w:styleId="ListeYok"><w:name w:val="No List"/><w:uiPriority w:val="99"/><w:semiHidden/><w:unhideWhenUsed/></w:style>' +
    '<w:style w:type="paragraph" w:styleId="UstBilgi"><w:name w:val="header"/><w:basedOn w:val="Normal"/><w:uiPriority w:val="99"/><w:unhideWhenUsed/></w:style>' +
    '<w:style w:type="paragraph" w:styleId="AltBilgi"><w:name w:val="footer"/><w:basedOn w:val="Normal"/><w:uiPriority w:val="99"/><w:unhideWhenUsed/></w:style>' +
    "</w:styles>";

  var AYARLAR = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:settings xmlns:w="' + NS_W + '"><w:zoom w:percent="100"/><w:defaultTabStop w:val="708"/><w:characterSpacingControl w:val="doNotCompress"/>' +
    '<w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat>' +
    '<w:themeFontLang w:val="tr-TR"/><w:decimalSymbol w:val=","/><w:listSeparator w:val=";"/></w:settings>';

  function zamanDamgasi() { return new Date().toISOString().replace(/\.\d{3}Z$/, "Z"); }

  BEP.docxOlustur = function (model) {
    var meta = model.meta || {};
    var cekirdek = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
      "<dc:title>" + esc(meta.baslik || "BEP Yıllık Planı") + "</dc:title><dc:subject>Bireyselleştirilmiş Eğitim Programı</dc:subject>" +
      "<dc:creator>" + esc(meta.olusturan || "BEP Hazırlama Aracı") + "</dc:creator><cp:keywords>BEP; özel eğitim; " + esc(meta.ders || "") + "</cp:keywords>" +
      '<dcterms:created xsi:type="dcterms:W3CDTF">' + zamanDamgasi() + '</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">' + zamanDamgasi() + "</dcterms:modified></cp:coreProperties>";
    var uygulama = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>BEP Hazırlama Aracı</Application><DocSecurity>0</DocSecurity></Properties>';
    var tipler = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
      '<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>' +
      '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>' +
      '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>' +
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
      '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>';
    var kokIliski = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
      '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>';
    var belgeIliski = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rIdStil" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '<Relationship Id="rIdAyar" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>' +
      '<Relationship Id="rIdUst1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>' +
      '<Relationship Id="rIdAlt1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>';
    return BEP.zipOlustur([
      { ad: "[Content_Types].xml", veri: tipler },
      { ad: "_rels/.rels", veri: kokIliski },
      { ad: "docProps/core.xml", veri: cekirdek },
      { ad: "docProps/app.xml", veri: uygulama },
      { ad: "word/document.xml", veri: belgeXml(model) },
      { ad: "word/styles.xml", veri: STILLER },
      { ad: "word/settings.xml", veri: AYARLAR },
      { ad: "word/header1.xml", veri: ustAltXml("hdr", model.ust || []) },
      { ad: "word/footer1.xml", veri: ustAltXml("ftr", model.alt || []) },
      { ad: "word/_rels/document.xml.rels", veri: belgeIliski }
    ]);
  };
})(typeof window !== "undefined" ? window : globalThis);
