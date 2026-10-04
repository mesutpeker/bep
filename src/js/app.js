/*
 * BEP Hazırlama Aracı — Arayüz
 * Tüm veriler tarayıcının yerel deposunda (localStorage) tutulur; ağ isteği yapılmaz.
 */
(function () {
  "use strict";
  var BEP = window.BEP, tr = BEP.tr;
  var DEPO = "bep-hazirlama-kayitlari-v1", OKUL_DEPO = "bep-hazirlama-okul-v1";
  var durum = { kayitlar: {}, aktifId: null, adim: 1 };

  function $(s, k) { return (k || document).querySelector(s); }
  function $$(s, k) { return Array.prototype.slice.call((k || document).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function uid() { return "bep-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7); }
  function kopya(o) { return JSON.parse(JSON.stringify(o)); }
  function bep() { return durum.kayitlar[durum.aktifId]; }
  function otoYukseklik(t) { t.style.height = "auto"; t.style.height = Math.max(t.scrollHeight + 2, 40) + "px"; }
  document.addEventListener("input", function (e) { if (e.target && e.target.tagName === "TEXTAREA" && e.target.closest('.plan-duzenleyici, [data-panel="4"]')) otoYukseklik(e.target); });

  /* ------------------------------------------------------------------ bildirim */
  function bildir(metin, tur) {
    var d = document.createElement("div");
    d.textContent = metin;
    if (tur === "hata") d.className = "hata";
    $("#bildirim").appendChild(d);
    setTimeout(function () { d.remove(); }, tur === "hata" ? 6000 : 3200);
  }

  /* ------------------------------------------------------------------ depolama */
  function yukle() {
    try {
      var j = JSON.parse(localStorage.getItem(DEPO) || "{}");
      durum.kayitlar = j.kayitlar || {};
      durum.aktifId = j.aktifId;
    } catch (e) { durum.kayitlar = {}; }
    Object.keys(durum.kayitlar).forEach(function (k) {
      try { kayitDuzelt(durum.kayitlar[k]); } catch (e) { if (window.console) console.error("Kayıt uyarlanamadı:", k, e); }
    });
  }
  var kayitZamanlayici = null;
  function kaydet() {
    try {
      localStorage.setItem(DEPO, JSON.stringify({ kayitlar: durum.kayitlar, aktifId: durum.aktifId }));
      var s = new Date();
      $("#kayitDurumu").textContent = "✓ Bu bilgisayara kaydedildi " + ("0" + s.getHours()).slice(-2) + ":" + ("0" + s.getMinutes()).slice(-2);
    } catch (e) {
      $("#kayitDurumu").textContent = "⚠ Kaydedilemedi (tarayıcı bu sayfada kayda izin vermiyor ya da depolama alanı dolu). Yedekle düğmesini kullanın.";
    }
  }
  function kaydetGecikmeli() { clearTimeout(kayitZamanlayici); kayitZamanlayici = setTimeout(kaydet, 400); }
  function okulHafizasi() { try { return JSON.parse(localStorage.getItem(OKUL_DEPO) || "{}"); } catch (e) { return {}; } }
  function okulHafizaKaydet() {
    var b = bep();
    try {
      localStorage.setItem(OKUL_DEPO, JSON.stringify({
        okul: b.okul,
        kurul: { baskan: b.kurul.baskan, baskanUnvan: b.kurul.baskanUnvan, rehberOgretmen: b.kurul.rehberOgretmen, tarih: b.kurul.tarih },
        tasdik: { tarih: b.tasdik.tarih, uygulamaTarihi: b.tasdik.uygulamaTarihi },
        ogretmen: b.ders.ogretmen
      }));
    } catch (e) { /* depolama kapalıysa okul bilgisi yalnızca bu oturumda kalır */ }
  }

  /* ------------------------------------------------------------------ yeni kayıt */
  // Arayüzde seçilmeyen, tanıya göre otomatik belirlenen ayarlar
  var OTOMATIK_AYARLAR = { destek: "", olcut: "80", ozne: "ad", duzen: "mufredat" };
  // Artık toplanmayan kişisel alanlar (veri en aza indirme) ve arayüzden kaldırılan bölümler
  var KALDIRILAN_OGRENCI_ALANLARI = ["tc", "cinsiyet", "dogumTarihi", "dogumYeri", "alan", "ramKurum", "ramTarih", "ramNo", "okulDisiDestek"];
  var PERFORMANS_ALANLARI = ["gelisim", "ders", "guclu", "destek", "davranis"];

  function yeniBep() {
    var h = okulHafizasi();
    var b = {
      id: uid(), surum: 2, olusturma: new Date().toISOString(), guncelleme: new Date().toISOString(), egitimYili: "2026-2027",
      okul: { il: "", ilce: "", ad: "", tur: "anadolu", mudur: "", baslikSatiri2: "" },
      ogrenci: { ad: "", no: "", sinif: "9", sube: "", yetersizlik: [], yetersizlikMetni: "",
        hizmet: "Tam Zamanlı Kaynaştırma / Bütünleştirme", bepBaslangic: "2026-09-14", bepBitis: "2027-06-25", cihaz: "" },
      ders: { id: "", planId: "", saat: "", ogretmen: h.ogretmen || "", ozel: { ad: "", sinif: "9", saat: 2, uniteler: [{ ad: "", saat: "", kazanimlar: "" }] } },
      performans: { gelisim: "", ders: "", guclu: "", destek: "", davranis: "" }, performansElle: {},
      ayarlar: { destek: "", olcut: "80", ozne: "ad", sinavHaftalari: [8, 16, 25, 33], duzen: "mufredat", donemSayfa: false, kvkkNotu: true },
      plan: null, izleme: [],
      kurul: { baskan: "", baskanUnvan: "Müdür Yardımcısı", sinifRehber: "", rehberOgretmen: "", veli: "", tarih: "" },
      tasdik: { tarih: "", uygulamaTarihi: "" }
    };
    if (h.okul) for (var k in h.okul) b.okul[k] = h.okul[k];
    if (h.kurul) for (var j in h.kurul) if (h.kurul[j] !== undefined) b.kurul[j] = h.kurul[j];
    if (h.tasdik) for (var t in h.tasdik) if (h.tasdik[t] !== undefined) b.tasdik[t] = h.tasdik[t];
    performansOtomatik(b);
    return b;
  }

  /* Eski sürümlerde kaydedilmiş BEP'leri yeni yapıya uyarlar */
  function kayitDuzelt(b) {
    if (!b || typeof b !== "object") return b;
    b.ogrenci = b.ogrenci || {};
    KALDIRILAN_OGRENCI_ALANLARI.forEach(function (k) { delete b.ogrenci[k]; });
    if (!Array.isArray(b.ogrenci.yetersizlik)) b.ogrenci.yetersizlik = [];
    b.ayarlar = b.ayarlar || {};
    for (var k in OTOMATIK_AYARLAR) b.ayarlar[k] = OTOMATIK_AYARLAR[k];
    if (!b.ayarlar.sinavHaftalari) b.ayarlar.sinavHaftalari = [8, 16, 25, 33];
    if (b.ayarlar.kvkkNotu === undefined) b.ayarlar.kvkkNotu = true;
    delete b.uyarlamalar; delete b.uyarlamaElle; delete b.kararlar;
    b.kurul = b.kurul || { baskanUnvan: "Müdür Yardımcısı" };
    b.tasdik = b.tasdik || {};
    b.ders = b.ders || {};
    b.performans = b.performans || {};
    if (!b.performansElle || typeof b.performansElle !== "object") {
      // Eski kayıtlarda dolu performans metinleri öğretmenin elle yazdığı kabul edilir
      b.performansElle = {};
      if (b.surum !== 2) PERFORMANS_ALANLARI.forEach(function (a) { if (tr.bosluk(b.performans[a])) b.performansElle[a] = true; });
    }
    b.surum = 2;
    performansOtomatik(b);
    return b;
  }

  /* Performans düzeyi: öğretmenin düzenlemediği alanlar tanı ve derse göre otomatik doldurulur */
  function performansOtomatik(b) {
    var v = BEP.varsayilanPerformans(b);
    b.performans = b.performans || {};
    b.performansElle = b.performansElle || {};
    PERFORMANS_ALANLARI.forEach(function (a) {
      if (!b.performansElle[a] || !tr.bosluk(b.performans[a])) { b.performans[a] = v[a]; b.performansElle[a] = false; }
    });
  }
  function performansDuzenlendiMi(b) { return PERFORMANS_ALANLARI.some(function (a) { return b.performansElle && b.performansElle[a]; }); }

  /* ------------------------------------------------------------------ veri bağlama */
  function al(obj, yol) { return yol.split(".").reduce(function (o, k) { return o == null ? undefined : o[k]; }, obj); }
  function ata(obj, yol, deger) {
    var p = yol.split("."), o = obj;
    for (var i = 0; i < p.length - 1; i++) { if (o[p[i]] == null || typeof o[p[i]] !== "object") o[p[i]] = {}; o = o[p[i]]; }
    o[p[p.length - 1]] = deger;
  }
  function formuDoldur(kapsam) {
    $$("[data-alan]", kapsam).forEach(function (el) {
      var v = al(bep(), el.dataset.alan);
      if (el.type === "checkbox") el.checked = v === undefined ? el.dataset.alan === "ayarlar.kvkkNotu" : !!v;
      else el.value = v == null ? "" : v;
    });
  }
  function alanDegeri(el) {
    if (el.type === "checkbox") return el.checked;
    if (el.type === "number") return el.value === "" ? "" : String(Math.max(0, parseInt(el.value, 10) || 0));
    return el.value;
  }
  function olay(e) {
    var el = e.target;
    if (!el || !el.dataset || !el.dataset.alan) return;
    ata(bep(), el.dataset.alan, alanDegeri(el));
    degisti(el.dataset.alan);
  }
  document.addEventListener("input", olay);
  document.addEventListener("change", olay);

  function degisti(alan) {
    var b = bep();
    b.guncelleme = new Date().toISOString();
    kaydetGecikmeli();
    if (/^okul\.|^kurul\.(baskan|baskanUnvan|rehberOgretmen|tarih)$|^tasdik\.|^ders\.ogretmen$/.test(alan)) { okulHafizaKaydet(); ustBaslikGoster(); }
    if (/^ogrenci\.(ad|sinif|sube)$/.test(alan) || alan === "ders.saat") kayitListesiCiz();
    if (alan === "ders.saat") saatUyarisiGoster();
    if (/^ders\.ozel/.test(alan)) kayitListesiCiz();
    if (alan === "okul.tur" && b.ders.id && b.ders.id !== "__ozel__") {
      var d = BEP.dersBul(b.ders.id), sinif = (BEP.planBul(d, b.ders.planId) || {}).sinif;
      var oneri = BEP.planOner(d, sinif, b.okul.tur);
      if (oneri && oneri !== b.ders.planId) { b.ders.planId = oneri; }
    }
    if (alan === "ogrenci.yetersizlikMetni") kayitListesiCiz();
    if (/^performans\./.test(alan)) {
      // Öğretmenin düzenlediği alan artık otomatik değiştirilmez
      b.performansElle = b.performansElle || {};
      b.performansElle[alan.split(".")[1]] = true;
      $("#btnPerformansDoldur").hidden = false;
    } else if (/^ogrenci\.(ad|yetersizlik)$|^ders\.(id|planId|ozel\.ad)$/.test(alan)) {
      performansOtomatik(b);
    }
    adimDurumlari();
  }

  /* ------------------------------------------------------------------ kayıt listesi */
  function kayitEtiketi(b) {
    var ad = tr.bosluk(b.ogrenci && b.ogrenci.ad) || "Adsız öğrenci";
    var o = b.ogrenci || {};
    var ss = o.sinif ? (o.sinif === "H" ? "Hz" : o.sinif) + (o.sube ? "/" + tr.up(o.sube) : "") : "";
    var d = b.ders && b.ders.id === "__ozel__" ? (b.ders.ozel && b.ders.ozel.ad) || "Meslek dersi" : (BEP.dersBul(b.ders && b.ders.id) || {}).ad || "ders seçilmedi";
    return ad + (ss ? " (" + ss + ")" : "") + " – " + d;
  }
  function kayitListesiCiz() {
    var sel = $("#kayitSec");
    var liste = Object.keys(durum.kayitlar).map(function (k) { return durum.kayitlar[k]; })
      .sort(function (a, b) { return (b.guncelleme || "").localeCompare(a.guncelleme || ""); });
    sel.innerHTML = liste.map(function (b) { return '<option value="' + esc(b.id) + '"' + (b.id === durum.aktifId ? " selected" : "") + ">" + esc(kayitEtiketi(b)) + "</option>"; }).join("");
  }
  $("#kayitSec").addEventListener("change", function (e) {
    durum.aktifId = e.target.value; kaydet(); hepsiniCiz();
  });
  $("#btnYeni").addEventListener("click", function () {
    var b = yeniBep(); durum.kayitlar[b.id] = b; durum.aktifId = b.id; kaydet(); hepsiniCiz(); adimaGit(1);
    bildir("Yeni BEP oluşturuldu. Okul bilgileri hatırlandı.");
  });
  $("#btnSil").addEventListener("click", function () {
    if (!confirm("“" + kayitEtiketi(bep()) + "” kaydı bu bilgisayardan silinsin mi? Bu işlem geri alınamaz.")) return;
    delete durum.kayitlar[durum.aktifId];
    var kalan = Object.keys(durum.kayitlar);
    if (!kalan.length) { var b = yeniBep(); durum.kayitlar[b.id] = b; kalan = [b.id]; }
    durum.aktifId = kalan[0]; kaydet(); hepsiniCiz(); adimaGit(1);
  });
  $("#btnKopya").addEventListener("click", function () { kopyaDiyalogu(); });

  function kopyaDiyalogu() {
    var d = document.createElement("dialog");
    d.className = "diyalog";
    d.innerHTML = '<h2>BEP’i kopyala</h2><p class="aciklama">Kopyayı hangi amaçla kullanacaksınız?</p>' +
      '<div class="eylem-satiri"><button class="dugme birincil" data-k="ders">Aynı öğrenci – başka ders</button>' +
      '<button class="dugme ikincil" data-k="ogrenci">Aynı ders – başka öğrenci</button><button class="dugme ikincil" data-k="iptal">Vazgeç</button></div>';
    document.body.appendChild(d);
    d.addEventListener("click", function (e) {
      var k = e.target.dataset && e.target.dataset.k;
      if (!k) return;
      if (k !== "iptal") {
        var y = kopya(bep());
        y.id = uid(); y.olusturma = y.guncelleme = new Date().toISOString();
        if (k === "ders") {
          // Aynı öğrenci – başka ders: derse özgü performans metni yeni derse göre yeniden üretilir
          y.ders = yeniBep().ders; y.ders.ogretmen = bep().ders.ogretmen; y.plan = null; y.izleme = [];
          y.performansElle = y.performansElle || {}; y.performansElle.ders = false;
        } else {
          y.ogrenci = yeniBep().ogrenci; y.ogrenci.sinif = bep().ogrenci.sinif; y.plan = null; y.izleme = [];
          y.performans = {}; y.performansElle = {}; y.kurul.veli = ""; y.kurul.sinifRehber = "";
        }
        performansOtomatik(y);
        durum.kayitlar[y.id] = y; durum.aktifId = y.id; kaydet(); hepsiniCiz(); adimaGit(k === "ders" ? 3 : 2);
        bildir("Kopya oluşturuldu.");
      }
      d.close(); d.remove();
    });
    d.showModal();
  }

  /* ------------------------------------------------------------------ yedekleme */
  function indir(ad, veri, tip) {
    var blob = new Blob([veri], { type: tip });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = ad;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  $("#btnDisaAktar").addEventListener("click", function () {
    var b = bep();
    indir("BEP_Yedek_" + (tr.dosyaAdi(b.ogrenci.ad) || "ogrenci") + "_" + new Date().toISOString().slice(0, 10) + ".json", JSON.stringify(b, null, 1), "application/json");
    bildir("Yedek dosyası indirildi. Kişisel veri içerdiği için güvenli saklayınız.");
  });
  $("#iceAktarDosya").addEventListener("change", function (e) {
    var f = e.target.files[0];
    if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      try {
        var j = JSON.parse(r.result);
        var liste = j.kayitlar ? Object.keys(j.kayitlar).map(function (k) { return j.kayitlar[k]; }) : [j];
        var n = 0;
        liste.forEach(function (b) {
          if (!b || !b.ogrenci || !b.ders) return;
          if (durum.kayitlar[b.id]) b.id = uid();
          durum.kayitlar[b.id] = kayitDuzelt(b); durum.aktifId = b.id; n++;
        });
        if (!n) throw new Error("Geçerli BEP kaydı bulunamadı");
        kaydet(); hepsiniCiz(); bildir(n + " BEP kaydı yüklendi.");
      } catch (err) { bildir("Dosya okunamadı: " + err.message, "hata"); }
      e.target.value = "";
    };
    r.readAsText(f, "utf-8");
  });

  /* ------------------------------------------------------------------ adımlar */
  function adimaGit(n) {
    durum.adim = n;
    $$(".panel").forEach(function (p) { p.hidden = +p.dataset.panel !== n; });
    $$("#adimlar button").forEach(function (b) { b.classList.toggle("aktif", +b.dataset.adim === n); });
    $("#btnGeri").disabled = n === 1;
    $("#btnIleri").textContent = n === 6 ? "⬇ Word Belgesi İndir" : "İleri →";
    if (n === 3) dersFormuCiz();
    if (n === 4) performansCiz();
    if (n === 5) planAdimi();
    if (n === 6) onizlemeAdimi();
    adimDurumlari();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  $$("#adimlar button").forEach(function (b) { b.addEventListener("click", function () { adimaGit(+b.dataset.adim); }); });
  $("#btnGeri").addEventListener("click", function () { if (durum.adim > 1) adimaGit(durum.adim - 1); });
  $("#btnIleri").addEventListener("click", function () { if (durum.adim < 6) adimaGit(durum.adim + 1); else wordIndir(); });

  function adimDurumlari() {
    var b = bep();
    var tamam = {
      1: !!(tr.bosluk(b.okul.ad) && tr.bosluk(b.okul.il) && tr.bosluk(b.kurul.baskan)),
      2: !!(tr.bosluk(b.ogrenci.ad) && b.ogrenci.yetersizlik.length),
      3: !!(b.ders.id && (b.ders.id === "__ozel__" ? tr.bosluk(b.ders.ozel.ad) : b.ders.planId)),
      4: !!(b.ogrenci.yetersizlik.length && tr.bosluk(b.performans.gelisim) && tr.bosluk(b.performans.ders)),
      5: !!(b.plan && b.plan.satirlar && b.plan.satirlar.length)
    };
    $$("#adimlar button").forEach(function (btn) { btn.classList.toggle("tamam", !!tamam[+btn.dataset.adim]); });
  }

  /* ------------------------------------------------------------------ ADIM 1 */
  function ustBaslikGoster() {
    var b = bep();
    var s2 = BEP.ustBaslikSatiri(b.okul);
    var okulAd = tr.up(b.okul.ad || "");
    $("#ustBaslikOnizleme").innerHTML = "<b>Belge üst başlığı:</b> T.C. / " + esc(s2 || "… VALİLİĞİ") + " / " + esc(okulAd ? (/MÜDÜRLÜĞÜ$/.test(okulAd) ? okulAd : okulAd + " MÜDÜRLÜĞÜ") : "… MÜDÜRLÜĞÜ");
  }
  function yetersizlikListesiCiz() {
    var b = bep(), secili = b.ogrenci.yetersizlik || [];
    $("#yetersizlikListesi").innerHTML = BEP.YETERSIZLIKLER.map(function (y) {
      var i = secili.indexOf(y.id);
      return '<label><input type="checkbox" data-yet="' + y.id + '"' + (i >= 0 ? " checked" : "") + "> " + esc(y.ad) +
        (i >= 0 ? ' <span class="sira" title="Seçim sırası">' + (i + 1) + "</span>" : "") + "</label>";
    }).join("");
    $("#yetersizlikDigerKutu").hidden = secili.indexOf("diger") < 0;
  }
  $("#yetersizlikListesi").addEventListener("change", function (e) {
    var id = e.target.dataset.yet;
    if (!id) return;
    var b = bep(), l = b.ogrenci.yetersizlik || (b.ogrenci.yetersizlik = []);
    var i = l.indexOf(id);
    if (e.target.checked && i < 0) l.push(id);
    if (!e.target.checked && i >= 0) l.splice(i, 1);
    yetersizlikListesiCiz(); degisti("ogrenci.yetersizlik"); adimDurumlari();
  });

  // e-Okul aktarımı
  var eokulListe = [];
  $("#btnEokul").addEventListener("click", function () { $("#eokulDiyalog").showModal(); });
  $("#btnEokulAyristir").addEventListener("click", function () {
    eokulListe = BEP.eokulAyristir($("#eokulMetin").value);
    $("#eokulDurum").textContent = eokulListe.length ? eokulListe.length + " öğrenci bulundu." : "Öğrenci bulunamadı. Listenin tamamını kopyaladığınızdan emin olun.";
    $("#eokulSonuc").innerHTML = eokulListe.length ? "<table><thead><tr><th>Sınıf</th><th>No</th><th>Adı Soyadı</th><th>Tanı</th><th></th></tr></thead><tbody>" +
      eokulListe.map(function (s, i) {
        return "<tr><td>" + esc(s.sinif + "/" + s.sube) + "</td><td>" + esc(s.no) + "</td><td>" + esc(s.ad) + "</td><td>" + esc(s.engeller.join(", ")) +
          (s.uyari ? '<div class="uyari">⚠ ' + esc(s.uyari) + "</div>" : "") + '</td><td><button type="button" class="dugme ikincil kucuk" data-eokul="' + i + '">Bu öğrenciyi seç</button></td></tr>';
      }).join("") + "</tbody></table>" : "";
  });
  $("#eokulSonuc").addEventListener("click", function (e) {
    var i = e.target.dataset && e.target.dataset.eokul;
    if (i === undefined) return;
    var s = eokulListe[+i], b = bep();
    if (tr.bosluk(b.ogrenci.ad) && tr.bosluk(b.ogrenci.ad) !== s.ad && !confirm("Bu BEP’teki öğrenci bilgileri “" + s.ad + "” ile değiştirilsin mi?\n(Yeni öğrenci için önce “+ Yeni BEP”i kullanabilirsiniz.)")) return;
    b.ogrenci.ad = s.ad; b.ogrenci.no = s.no; b.ogrenci.sinif = s.sinif; b.ogrenci.sube = s.sube;
    b.ogrenci.yetersizlik = s.yetersizlik.slice();
    if (s.hizmet) b.ogrenci.hizmet = s.hizmet;
    $("#eokulDiyalog").close();
    degisti("ogrenci.ad"); formuDoldur(); yetersizlikListesiCiz(); adimDurumlari();
    bildir(s.ad + " aktarıldı." + (s.uyari ? " Not: e-Okul RAM kademe uyarısı var." : ""));
  });

  /* ------------------------------------------------------------------ ADIM 2 */
  var SINIF_SIRA = ["H", "9", "10", "11", "12", "S"];
  function dersSecimiCiz() {
    var gruplar = {};
    BEP.dersListesi().forEach(function (d) { (gruplar[d.grup] = gruplar[d.grup] || []).push(d); });
    var h = '<option value="">— Ders seçiniz —</option>';
    Object.keys(gruplar).forEach(function (g) {
      h += '<optgroup label="' + esc(g) + '">' + gruplar[g].map(function (d) { return '<option value="' + d.id + '">' + esc(d.ad) + "</option>"; }).join("") + "</optgroup>";
    });
    h += '<optgroup label="Diğer"><option value="__ozel__">Meslek dersi / listede olmayan ders (elle giriş)</option></optgroup>';
    $("#dersSec").innerHTML = h;
  }
  function programEtiketi(p) {
    if (p.program === "TYMM") return "Maarif Modeli – öğrenme çıktıları";
    if (p.program === "2018") return "Önceki program – kazanımlar";
    return "Elle girilen içerik";
  }
  function dersFormuCiz() {
    var b = bep(), d = b.ders;
    $("#dersSec").value = d.id || "";
    var ozel = d.id === "__ozel__";
    $("#ozelDersKart").hidden = !ozel;
    $("#sinifSec").parentElement.hidden = ozel;
    $("#planSec").parentElement.hidden = ozel;
    if (ozel) { ozelUniteCiz(); }
    var ders = ozel ? null : BEP.dersBul(d.id);
    if (ders) {
      var siniflar = SINIF_SIRA.filter(function (s) { return ders.planlar.some(function (p) { return p.sinif === s; }); });
      var plan = BEP.planBul(ders, d.planId);
      var sinif = plan ? plan.sinif : siniflar[0];
      $("#sinifSec").innerHTML = siniflar.map(function (s) { return '<option value="' + s + '"' + (s === sinif ? " selected" : "") + ">" + (s === "S" ? "Seçmeli ders" : BEP.sinifAdi(s)) + "</option>"; }).join("");
      var planlar = ders.planlar.filter(function (p) { return p.sinif === sinif; });
      $("#planSec").innerHTML = planlar.map(function (p) {
        var cozulmus = BEP.planBul(ders, p.id);
        return '<option value="' + p.id + '"' + (p.id === d.planId ? " selected" : "") + ">" + esc(p.etiket + " – " + programEtiketi(cozulmus) + " – haftalık " + cozulmus.saat + " saat") + "</option>";
      }).join("");
    } else {
      $("#sinifSec").innerHTML = ""; $("#planSec").innerHTML = "";
    }
    var ctx = BEP.baglam(b);
    $("#saatGir").placeholder = ctx.plan ? String(ctx.plan.saat) : "";
    formuDoldur($('[data-panel="2"]'));
    planBilgiCiz(ctx);
    saatUyarisiGoster();
  }
  function saatUyarisiGoster() {
    var b = bep(), kutu = $("#saatUyari");
    var mtal = b.okul.tur === "mtal" || b.okul.tur === "diger" || b.okul.tur === "aihl";
    var ctx = BEP.baglam(b);
    if (mtal && ctx.plan && b.ders.id !== "__ozel__" && !b.ders.saat) {
      kutu.hidden = false;
      kutu.textContent = "Resmî çerçeve planları Anadolu/Fen/Sosyal Bilimler liselerinin ders saatine göre hazırlanmıştır (bu plan: haftalık " + ctx.plan.saat + " saat). Okulunuzun haftalık ders çizelgesindeki saat farklıysa “Haftalık Ders Saati” alanına yazınız; konu sıralaması aynen korunur.";
    } else kutu.hidden = true;
  }
  function planBilgiCiz(ctx) {
    var kutu = $("#planBilgi");
    if (!ctx.plan) { kutu.innerHTML = ""; return; }
    var p = ctx.plan;
    var uniteler = p.uniteler.map(function (u) { return "<li>" + esc(u.ad) + (u.saat ? " <small>(" + u.saat + " ders saati)</small>" : "") + "</li>"; }).join("");
    var destekler = p.uniteler.filter(function (u) { return u.destek; }).map(function (u) { return "<li><b>" + esc(BEP.uniteSadeAd(u.ad, ctx.dil)) + ":</b> " + esc(u.destek) + "</li>"; }).join("");
    kutu.innerHTML = "<b>Kaynak:</b> " + esc(p.kaynak) + "<br><b>Program:</b> " + esc(programEtiketi(p)) +
      (p.program === "2018" ? " <small>(2026-2027’de 12. sınıflarda önceki öğretim programları uygulanmaya devam etmektedir.)</small>" : "") +
      (p.dagitim === "otomatik" ? "<br><small>Bu seçmeli ders için MEB haftalık plan yayımlamadığından üniteler, resmî ünite ders saatlerine göre haftalara orantılı dağıtılmıştır.</small>" : "") +
      "<br><b>Üniteler / temalar:</b><ul>" + uniteler + "</ul>" +
      (destekler ? '<details class="ek-ayar"><summary>Öğretim programındaki “Destekleme” önerileri (TYMM)</summary><ul>' + destekler + "</ul></details>" : "");
  }
  $("#dersSec").addEventListener("change", function (e) {
    var b = bep(), id = e.target.value;
    b.ders.id = id;
    if (id && id !== "__ozel__") {
      var ders = BEP.dersBul(id);
      var ogrSinif = b.ogrenci.sinif;
      var var_ = ders.planlar.some(function (p) { return p.sinif === ogrSinif; });
      var sinif = var_ ? ogrSinif : (ders.planlar.some(function (p) { return p.sinif === "S"; }) ? "S" : ders.planlar[0].sinif);
      b.ders.planId = BEP.planOner(ders, sinif, b.okul.tur);
      if (!var_ && sinif !== "S") bildir("Bu ders için " + BEP.sinifAdi(ogrSinif) + " planı yok; " + BEP.sinifAdi(sinif) + " seçildi.");
    } else b.ders.planId = "";
    b.ders.saat = "";
    degisti("ders.id"); dersFormuCiz(); kayitListesiCiz(); adimDurumlari();
  });
  $("#sinifSec").addEventListener("change", function (e) {
    var b = bep(), ders = BEP.dersBul(b.ders.id);
    b.ders.planId = BEP.planOner(ders, e.target.value, b.okul.tur); b.ders.saat = "";
    degisti("ders.planId"); dersFormuCiz();
  });
  $("#planSec").addEventListener("change", function (e) { bep().ders.planId = e.target.value; bep().ders.saat = ""; degisti("ders.planId"); dersFormuCiz(); });

  function ozelUniteCiz() {
    var oz = bep().ders.ozel;
    if (!oz.uniteler || !oz.uniteler.length) oz.uniteler = [{ ad: "", saat: "", kazanimlar: "" }];
    $("#ozelUniteler").innerHTML = '<label style="max-width:220px">Haftalık Ders Saati<input type="number" min="1" max="40" data-alan="ders.ozel.saat"></label>' +
      oz.uniteler.map(function (u, i) {
        return '<div class="ozel-unite"><label>Öğrenme birimi / ünite ' + (i + 1) + '<input data-alan="ders.ozel.uniteler.' + i + '.ad" placeholder="Örn. İş Sağlığı ve Güvenliği"></label>' +
          '<label>Ders saati<input type="number" min="1" data-alan="ders.ozel.uniteler.' + i + '.saat" placeholder="Örn. 12"></label>' +
          '<button type="button" class="sil-dugme" data-ozel-sil="' + i + '" title="Üniteyi sil">✕</button>' +
          '<label class="tam">Kazanımlar / öğrenme çıktıları (her satıra bir tane)<textarea rows="4" data-alan="ders.ozel.uniteler.' + i + '.kazanimlar" placeholder="Örn.&#10;İş kazalarının nedenlerini açıklar.&#10;Kişisel koruyucu donanımları kullanır."></textarea></label></div>';
      }).join("");
    formuDoldur($("#ozelDersKart"));
  }
  $("#btnOzelUniteEkle").addEventListener("click", function () { bep().ders.ozel.uniteler.push({ ad: "", saat: "", kazanimlar: "" }); ozelUniteCiz(); kaydetGecikmeli(); });
  $("#ozelUniteler").addEventListener("click", function (e) {
    var i = e.target.dataset && e.target.dataset.ozelSil;
    if (i === undefined) return;
    bep().ders.ozel.uniteler.splice(+i, 1); ozelUniteCiz(); kaydetGecikmeli();
  });

  /* ------------------------------------------------------------------ ADIM 4 – performans (otomatik) */
  function performansCiz() {
    var b = bep();
    performansOtomatik(b);
    var o = BEP.performansOnerileri(b);
    var dersAd = b.ders.id === "__ozel__" ? (b.ders.ozel.ad || "Ders") : ((BEP.dersBul(b.ders.id) || {}).ad || "Ders");
    $("#dersPerformansBaslik").textContent = dersAd.replace(/\s*\(.*\)$/, "") + " Alanı Performans Düzeyi " + o.alanEtiketi;
    var tanilar = BEP.tanilarMetni(b);
    $("#performansBilgi").innerHTML = (b.ogrenci.yetersizlik.length
      ? "Bu bölüm <b>" + esc(tanilar) + "</b> " + (b.ogrenci.yetersizlik.length > 1 ? "tanılarına" : "tanısına") + (b.ders.id ? " ve <b>" + esc(dersAd.replace(/\s*\(.*\)$/, "")) + "</b> dersine" : "") + " göre otomatik dolduruldu."
      : "Yetersizlik türü seçildiğinde bu bölüm tanıya göre otomatik doldurulur (2. adım).") +
      " Öğrencinize göre düzenleyebilirsiniz; düzenlediğiniz metinler korunur.";
    $("#btnPerformansDoldur").hidden = !performansDuzenlendiMi(b);
    formuDoldur($('[data-panel="4"]'));
    requestAnimationFrame(function () { $$('[data-panel="4"] textarea').forEach(otoYukseklik); });
    kaydetGecikmeli();
  }
  $("#btnPerformansDoldur").addEventListener("click", function () {
    var b = bep();
    if (!confirm("Düzenlediğiniz performans metinleri silinip tanıya göre yeniden doldurulsun mu?")) return;
    b.performansElle = {};
    performansOtomatik(b);
    performansCiz(); degisti("ogrenci.yetersizlik"); adimDurumlari();
    bildir("Performans düzeyi tanıya göre yeniden dolduruldu.");
  });

  /* ------------------------------------------------------------------ ADIM 5 – yıllık plan */
  function ayarSecimleriCiz() {
    var b = bep(), ctx = BEP.baglam(b);
    var destek = BEP.DESTEK_DUZEYLERI.filter(function (d) { return d.id === ctx.destek; })[0] || {};
    var olcut = BEP.OLCUTLER.filter(function (o) { return o.id === b.ayarlar.olcut; })[0] || {};
    var duzen = BEP.PLAN_DUZENLERI[b.ayarlar.duzen] || {};
    $("#otomatikAyarlar").innerHTML = "<b>Tanıya göre otomatik ayarlar:</b> " +
      "Destek düzeyi: <b>" + esc(destek.ad || "") + "</b> <small>(" + esc(destek.aciklama || "") + ")</small> • " +
      "KDA ölçütü: <b>" + esc(olcut.ad || "") + "</b> • KDA öznesi: <b>" + esc(ctx.ozne || "Öğrenci") + "</b> • " +
      "Tablo düzeni: <b>" + esc(duzen.ad || "") + "</b>";
    var sh = b.ayarlar.sinavHaftalari || [];
    $("#sinavHaftalari").innerHTML = [0, 1, 2, 3].map(function (i) {
      return '<input type="number" min="1" max="37" data-sinav="' + i + '" value="' + (sh[i] || "") + '" title="' + (i < 2 ? "1" : "2") + '. dönem ' + ((i % 2) + 1) + '. sınav haftası" aria-label="Sınav haftası ' + (i + 1) + '">';
    }).join("");
    formuDoldur($(".ayarlar-kart"));
  }
  $("#sinavHaftalari").addEventListener("input", function () {
    bep().ayarlar.sinavHaftalari = $$("#sinavHaftalari input").map(function (i) { return parseInt(i.value, 10); }).filter(function (n) { return n >= 1 && n <= 37; });
    degisti("ayarlar.sinavHaftalari");
  });

  function duzenlemeVarMi(b) { return !!(b.plan && b.plan.satirlar && b.plan.satirlar.some(function (s) { return s.duzenlendi && Object.keys(s.duzenlendi).length; })); }

  function planOlustur(koru) {
    var b = bep();
    if (!b.ders.id) { bildir("Önce 3. adımda ders seçiniz.", "hata"); return false; }
    var s = BEP.planiHazirla(b, { duzenlemeleriKoru: !!koru });
    if (s.hata) { bildir(s.hata, "hata"); return false; }
    kaydet(); adimDurumlari();
    return true;
  }
  function planAdimi() {
    ayarSecimleriCiz();
    var b = bep();
    if (!b.ders.id) { $("#planTablosu").innerHTML = ""; planUyarisi("Yıllık planın oluşturulabilmesi için 3. adımda ders seçiniz."); return; }
    if (!b.plan) planOlustur(false);
    else if (b.plan.imza !== BEP.planImzasi(b)) {
      if (!duzenlemeVarMi(b)) { planOlustur(false); bildir("Plan seçimlerinize göre güncellendi."); }
    }
    planTablosuCiz();
  }
  function planUyarisi(metin, dugmeler) {
    var u = $("#planUyari");
    if (!metin) { u.hidden = true; return; }
    u.hidden = false;
    u.innerHTML = esc(metin) + (dugmeler ? ' <span class="eylem-satiri">' + dugmeler + "</span>" : "");
  }
  $("#planUyari").addEventListener("click", function (e) {
    var k = e.target.dataset && e.target.dataset.yenile;
    if (!k) return;
    planOlustur(k === "koru"); planTablosuCiz(); bildir("Plan yenilendi.");
  });
  $("#btnPlanOlustur").addEventListener("click", function () {
    var b = bep(), koru = false;
    if (duzenlemeVarMi(b)) koru = confirm("Elle düzenlediğiniz hücreler korunsun mu?\n\nTamam: düzenlemeler korunur, diğer hücreler yenilenir.\nİptal: plan tamamen baştan oluşturulur.");
    if (planOlustur(koru)) { planTablosuCiz(); bildir("Yıllık plan oluşturuldu."); }
  });
  $("#sinavHaftalari").addEventListener("change", function () { if (durum.adim === 5) planDurumuGuncelle(); });

  function planDurumuGuncelle() {
    var b = bep();
    if (!b.plan) return;
    if (b.plan.imza !== BEP.planImzasi(b)) {
      if (!duzenlemeVarMi(b)) { planOlustur(false); planTablosuCiz(); return; }
      planUyarisi("Seçimleriniz değişti; yıllık planı yenilemeniz önerilir.", '<button type="button" class="dugme birincil kucuk" data-yenile="koru">Yenile (düzenlemelerimi koru)</button><button type="button" class="dugme ikincil kucuk" data-yenile="sifir">Baştan oluştur</button>');
    } else planUyarisi("");
    var ctx = BEP.baglam(b);
    var hafta = b.plan.satirlar.filter(function (s) { return s.tur === "hafta"; }).length;
    $("#planDurum").textContent = hafta + " hafta • " + b.plan.udalar.length + " uzun dönemli amaç • " + (ctx.plan ? ctx.plan.kaynak.replace(/\s*\(.*\)\s*$/, "") : "");
  }

  var PLAN_SUTUNLARI = {
    ornek: [["unite", "Ünite / Tema ve Konular"], ["kda", "BEP Amacı (UDA / KDA)"], ["yontem", "Yöntem ve Teknikler"], ["arac", "Araç-Gereçler"], ["olcme", "Ölçme-Değerlendirme ve Açıklamalar"]],
    mufredat: [["unite", "Ünite / Tema"], ["cikti", "Öğrenme Çıktısı / Kazanım (müfredat)"], ["kda", "BEP Amacı (UDA / KDA)"], ["yontem", "Yöntem ve Teknikler"], ["arac", "Araç-Gereçler"], ["olcme", "Ölçme-Değerlendirme ve Açıklamalar"]]
  };
  function planTablosuCiz() {
    var b = bep();
    if (!b.plan) { $("#planTablosu").innerHTML = ""; return; }
    var sutunlar = PLAN_SUTUNLARI[b.ayarlar.duzen] || PLAN_SUTUNLARI.ornek;
    var satirlar = b.plan.satirlar;
    var sinavlar = (b.ayarlar.sinavHaftalari || []).map(Number);
    var h = '<table class="plan"><thead><tr><th>Hafta</th>' + sutunlar.map(function (s) { return '<th class="sutun-genislik-' + s[0] + '">' + esc(s[1]) + "</th>"; }).join("") + "</tr></thead><tbody>";
    satirlar.forEach(function (s, i) {
      var aySonu = !satirlar[i + 1] || satirlar[i + 1].ay !== s.ay;
      if (s.tur === "tatil") {
        h += '<tr class="tatil' + (aySonu ? " ay-sonu" : "") + '"><td class="hafta-hucre"><span class="ay">' + esc(s.ay) + "</span><br>—</td><td colspan=\"" + sutunlar.length + "\">" + esc(s.ad + " • " + s.tarih + " • " + s.aciklama) + "</td></tr>";
        return;
      }
      var ozel = /^(OKUL TEMELLİ|SOSYAL ETKİNLİK)/.test(s.unite || "");
      h += '<tr class="' + (aySonu ? "ay-sonu " : "") + (ozel ? "ozel" : "") + '" data-i="' + i + '"><td class="hafta-hucre"><span class="ay">' + esc(s.ay) + "</span><br>" + s.no + ". Hafta<small>" + esc(s.tarih) + "</small>" +
        (sinavlar.indexOf(s.no) >= 0 ? '<span class="sinav-rozet">BEP sınavı</span>' : "") + "</td>";
      sutunlar.forEach(function (sut) {
        var a = sut[0], ed = s.duzenlendi && s.duzenlendi[a];
        h += '<td><textarea data-plan="' + i + '" data-plan-alan="' + a + '" class="' + (ed ? "duzenlendi" : "") + '" rows="' + (a === "kda" ? 4 : 3) + '">' + esc(s[a] || "") + "</textarea>";
        if (a === "kda" && !ozel) h += '<div class="kda-araclar"><select data-oneri-hafta="' + i + '"><option value="">Başka bir KDA önerisi seç…</option></select></div>';
        h += "</td>";
      });
      h += "</tr>";
    });
    $("#planTablosu").innerHTML = h + "</tbody></table>";
    requestAnimationFrame(function () { $$("#planTablosu textarea").forEach(otoYukseklik); });
    planDurumuGuncelle();
  }
  $("#planTablosu").addEventListener("input", function (e) {
    var t = e.target;
    if (!t.dataset || t.dataset.plan === undefined) return;
    var s = bep().plan.satirlar[+t.dataset.plan];
    s[t.dataset.planAlan] = t.value;
    s.duzenlendi = s.duzenlendi || {};
    s.duzenlendi[t.dataset.planAlan] = true;
    t.classList.add("duzenlendi");
    kaydetGecikmeli();
  });
  $("#planTablosu").addEventListener("focusin", function (e) {
    var t = e.target;
    if (!t.dataset || t.dataset.oneriHafta === undefined || t.options.length > 1) return;
    var s = bep().plan.satirlar[+t.dataset.oneriHafta];
    var secenekler = BEP.davranisSecenekleri(bep(), s.no);
    t.innerHTML = '<option value="">Başka bir KDA önerisi seç… (' + secenekler.length + ")</option>" + secenekler.map(function (x) { return '<option value="' + esc(x) + '">' + esc(tr.kisalt(x, 120)) + "</option>"; }).join("");
  });
  $("#planTablosu").addEventListener("change", function (e) {
    var t = e.target;
    if (!t.dataset || t.dataset.oneriHafta === undefined || !t.value) return;
    var i = +t.dataset.oneriHafta, s = bep().plan.satirlar[i];
    var on = (String(s.kda || "").match(/^(UDA\s*\d+\s*\/\s*KDA\s*[\d.]+\s*:\s*)/) || [""])[0];
    s.kda = on + BEP.kdaCumlesiOlustur(bep(), t.value.replace(/\.$/, ""), i);
    s.duzenlendi = s.duzenlendi || {}; s.duzenlendi.kda = true;
    var ta = $('textarea[data-plan="' + i + '"][data-plan-alan="kda"]');
    ta.value = s.kda; ta.classList.add("duzenlendi");
    t.value = "";
    kaydetGecikmeli();
  });

  /* ------------------------------------------------------------------ ADIM 6 */
  function kontroller() {
    var b = bep(), l = [];
    var ekle = function (tur, metin, adim) { l.push({ tur: tur, metin: metin, adim: adim }); };
    if (!tr.bosluk(b.ogrenci.ad)) ekle("hata", "Öğrencinin adı soyadı yazılmamış.", 2);
    if (!b.ogrenci.yetersizlik.length) ekle("hata", "Yetersizlik türü / eğitsel tanı seçilmemiş.", 2);
    if (!b.ders.id) ekle("hata", "Ders seçilmemiş.", 3);
    if (b.ders.id === "__ozel__" && !b.ders.ozel.uniteler.some(function (u) { return tr.bosluk(u.ad); })) ekle("hata", "Elle girilen ders için en az bir öğrenme birimi/ünite yazınız.", 3);
    if (!tr.bosluk(b.okul.ad) || !tr.bosluk(b.okul.il)) ekle("uyari", "Okul adı veya il bilgisi eksik (belge başlığında kullanılır).", 1);
    if (b.plan && b.plan.imza !== BEP.planImzasi(b)) ekle("uyari", "Seçimleriniz plan oluşturulduktan sonra değişmiş; 5. adımda planı yenilemeniz önerilir.", 5);
    ["gelisim", "ders", "guclu", "destek"].forEach(function (a) { if (!tr.bosluk(b.performans[a])) { ekle("uyari", "Performans düzeyi bölümünde boş alanlar var.", 4); } });
    var sh = (b.ayarlar.sinavHaftalari || []);
    if (sh.filter(function (h) { return h <= 18; }).length !== 2 || sh.filter(function (h) { return h > 18; }).length !== 2) ekle("uyari", "BEP yazılı sınavları: her dönemde 2 sınav haftası belirlenmesi önerilir (OKY Md. 45/1-a; 1. dönem 1-18, 2. dönem 19-36. haftalar).", 5);
    if (!tr.bosluk(b.ders.ogretmen)) ekle("uyari", "Ders öğretmeninin adı yazılmamış (imza bölümünde noktalı satır bırakılır).", 1);
    if (!tr.bosluk(b.kurul.baskan) || !tr.bosluk(b.kurul.rehberOgretmen)) ekle("uyari", "BEP geliştirme birimi üyelerinin adları eksik (imza bölümünde noktalı satır bırakılır).", 1);
    var uniq = {};
    l = l.filter(function (x) { if (uniq[x.metin]) return false; uniq[x.metin] = 1; return true; });
    if (!l.some(function (x) { return x.tur === "hata"; })) l.unshift({ tur: "tamam", metin: "Belge oluşturulmaya hazır. Word belgesini indirip son kontrolünüzü yapabilirsiniz." });
    return l;
  }
  function onizlemeAdimi() {
    var b = bep();
    performansOtomatik(b);
    if (b.ders.id && (!b.plan || (b.plan.imza !== BEP.planImzasi(b) && !duzenlemeVarMi(b)))) planOlustur(false);
    $("#kontrolListesi").innerHTML = kontroller().map(function (k) {
      return '<div class="kontrol ' + k.tur + '">' + (k.tur === "tamam" ? "✓" : k.tur === "hata" ? "✕" : "!") + " <span>" + esc(k.metin) + "</span>" +
        (k.adim ? '<button type="button" class="dugme ikincil kucuk" data-git="' + k.adim + '">' + k.adim + ". adıma git</button>" : "") + "</div>";
    }).join("");
    onizlemeCiz();
  }
  $("#kontrolListesi").addEventListener("click", function (e) { var g = e.target.dataset && e.target.dataset.git; if (g) adimaGit(+g); });
  function onizlemeCiz() {
    var b = bep();
    if (!b.ders.id) { $("#onizleme").innerHTML = '<p class="aciklama">Önizleme için ders seçiniz.</p>'; return; }
    try {
      var model = BEP.belgeModeli(b);
      $("#onizleme").innerHTML = BEP.onizlemeHtml(model);
      olcekUygula();
    } catch (err) {
      console.error(err);
      $("#onizleme").innerHTML = '<div class="uyari-kutusu hata-kutusu">Önizleme oluşturulamadı: ' + esc(err.message) + "</div>";
    }
  }
  function olcekUygula() { $("#onizleme").style.setProperty("--olcek", ($("#olcekAyar").value / 100).toFixed(2)); }
  $("#olcekAyar").addEventListener("input", olcekUygula);

  function engelVarMi() {
    var h = kontroller().filter(function (k) { return k.tur === "hata"; });
    if (h.length) { bildir(h[0].metin, "hata"); return true; }
    return false;
  }
  function belgeAdi() {
    var b = bep(), o = b.ogrenci;
    var ders = b.ders.id === "__ozel__" ? b.ders.ozel.ad : (BEP.dersBul(b.ders.id) || {}).ad;
    var ss = (o.sinif || "") + (o.sube ? "_" + o.sube : "");
    return tr.dosyaAdi([o.ad, ss, ders, "BEP_Plani"].filter(Boolean).join("_")) + ".docx";
  }
  function wordIndir() {
    if (engelVarMi()) return;
    var b = bep();
    performansOtomatik(b);
    if (!b.plan || (b.plan.imza !== BEP.planImzasi(b) && !duzenlemeVarMi(b))) planOlustur(false);
    try {
      var bayt = BEP.docxOlustur(BEP.belgeModeli(b));
      indir(belgeAdi(), bayt, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      bildir("Word belgesi indirildi: " + belgeAdi());
    } catch (err) {
      console.error(err);
      bildir("Belge oluşturulamadı: " + err.message, "hata");
    }
  }
  $("#btnWord").addEventListener("click", wordIndir);
  $("#btnYazdir").addEventListener("click", function () {
    if (engelVarMi()) return;
    var alan = $("#yazdirma-alani"), b = bep();
    performansOtomatik(b);
    if (b.ders.id && (!b.plan || (b.plan.imza !== BEP.planImzasi(b) && !duzenlemeVarMi(b)))) planOlustur(false);
    alan.innerHTML = BEP.onizlemeHtml(BEP.belgeModeli(b));
    setTimeout(function () { window.print(); }, 50);
  });

  /* ------------------------------------------------------------------ yardım */
  $("#btnYardim").addEventListener("click", function () {
    var m = (window.BEP_VERI && window.BEP_VERI.meta) || { kaynaklar: [] };
    var T = BEP.takvimBilgi("2026-2027");
    $("#yardimIcerik").innerHTML =
      "<h2>BEP Hazırlama Aracı – Nasıl kullanılır?</h2><ol>" +
      "<li><b>Okul ve BEP Birimi:</b> Okul bilgilerini ve BEP geliştirme birimi üyeleri ile tasdik tarihlerini girin (sonraki BEP’lerde hatırlanır; veli ve sınıf rehber öğretmeni her öğrenci için yazılır).</li>" +
      "<li><b>Öğrenci:</b> Öğrenciyi elle yazın ya da e-Okul “Özel Eğitim Gereksinimli Öğrenci Listesi”nden aktarın. Yetersizlik türünü RAM raporuna göre işaretleyin.</li>" +
      "<li><b>Ders:</b> Dersi ve sınıf düzeyini seçin. Haftalık konular ve öğrenme çıktıları MEB’in 2026-2027 resmî çerçeve yıllık planlarından gelir. Meslek dersleri için “elle giriş” seçeneğini kullanın.</li>" +
      "<li><b>Performans Düzeyi:</b> Tanıya ve derse göre otomatik doldurulur; isterseniz öğrencinize göre düzenleyin.</li>" +
      "<li><b>Yıllık Plan:</b> Destek düzeyi, ölçüt ve tablo düzeni tanıya göre otomatik belirlenir; plan otomatik oluşur. Her hücreyi düzenleyebilir, KDA için başka öneriler seçebilirsiniz. Sarı hücreler elle düzenlenmiştir.</li>" +
      "<li><b>Önizle ve İndir:</b> Uyarlamalar (Tablo 4.1–4.2), BEP birimi kararları (Tablo 4.3) ve izleme çizelgesi tanıya göre otomatik eklenir. Kontrol listesini inceleyin, Word belgesini indirin veya PDF olarak yazdırın.</li></ol>" +
      "<h2>Resmî takvim (" + esc(T.egitimYili) + ")</h2><ul><li>Ders yılı: " + T.dersBasi + " – " + T.dersSonu + " (36 öğretim haftası + 37. hafta sosyal etkinlik)</li><li>1. dönem ara tatili: 16-20 Kasım 2026 • Yarıyıl tatili: 25 Ocak – 5 Şubat 2027 • 2. dönem ara tatili: 8-12 Mart 2027</li></ul>" +
      "<h2>Kaynaklar</h2><ul>" + m.kaynaklar.map(function (k) { return '<li><a href="' + esc(k.url) + '" target="_blank" rel="noopener">' + esc(k.ad) + "</a></li>"; }).join("") +
      '<li><a href="https://www.meb.gov.tr/2026-2027-egitim-ogretim-yili-takvimi-aciklandi/haber/41057/tr" target="_blank" rel="noopener">MEB 2026-2027 Eğitim Öğretim Yılı Takvimi</a></li>' +
      '<li><a href="https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=24736&amp;MevzuatTur=7&amp;MevzuatTertip=5" target="_blank" rel="noopener">Özel Eğitim Hizmetleri Yönetmeliği</a> (Md. 20 BEP içeriği, 22-24 kaynaştırma ve değerlendirme, 47-48 BEP geliştirme birimi)</li>' +
      '<li><a href="https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=18812&amp;MevzuatTur=7&amp;MevzuatTertip=5" target="_blank" rel="noopener">Ortaöğretim Kurumları Yönetmeliği</a> (Md. 10/1-f, 43/1-g, 45/1-ğ, 51/6)</li>' +
      '<li><a href="https://orgm.meb.gov.tr/meb_iys_dosyalar/2022_09/20140845_BYREYSELLEYTYRYLMYY_EYYTYM_PROGRAMI_TUM_OYRETMENLER_YCYN_YOL_HARITASI.pdf" target="_blank" rel="noopener">ORGM – BEP: Tüm Öğretmenler İçin Yol Haritası</a> (KDA: birey + koşul + davranış + ölçüt)</li>' +
      '<li><a href="https://meslek.meb.gov.tr/dersbilgi" target="_blank" rel="noopener">MTEGM Ders Bilgi Formları (meslek dersleri)</a></li></ul>' +
      "<h2>Önemli notlar</h2><ul><li>2026-2027’de hazırlık, 9, 10 ve 11. sınıflarda Türkiye Yüzyılı Maarif Modeli programları; 12. sınıflarda önceki programlar uygulanmaktadır (OGM).</li>" +
      "<li>Resmî çerçeve planlar Anadolu/Fen/Sosyal Bilimler liseleri için yayımlanmıştır; MTAL ve diğer okullarda haftalık ders saatinizi 3. adımda düzeltebilirsiniz.</li>" +
      "<li>Üretilen amaçlar birer taslaktır; BEP geliştirme birimi tarafından öğrencinin performansına göre gözden geçirilmelidir.</li>" +
      "<li>Veriler yalnızca bu tarayıcıda saklanır. Bilgisayar değiştirirken “Yedekle” ile .json dosyası alın. BEP özel nitelikli kişisel veri içerir (KVKK).</li></ul>";
    $("#yardimDiyalog").showModal();
  });

  /* ------------------------------------------------------------------ başlangıç */
  function hepsiniCiz() {
    kayitListesiCiz();
    formuDoldur();
    ustBaslikGoster();
    yetersizlikListesiCiz();
    dersSecimiCiz();
    adimaGit(durum.adim || 1);
  }
  function basla() {
    if (!window.BEP_VERI) { document.body.insertAdjacentHTML("afterbegin", '<div class="uyari-kutusu hata-kutusu">Ders verileri yüklenemedi (data/dersler.js).</div>'); return; }
    var st = document.createElement("style");
    st.textContent = BEP.ONIZLEME_CSS;
    document.head.appendChild(st);
    yukle();
    if (!durum.aktifId || !durum.kayitlar[durum.aktifId]) {
      var ids = Object.keys(durum.kayitlar);
      if (ids.length) durum.aktifId = ids[0];
      else { var b = yeniBep(); durum.kayitlar[b.id] = b; durum.aktifId = b.id; }
    }
    hepsiniCiz();
    kaydet();
  }
  basla();
})();
