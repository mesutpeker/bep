/*
 * BEP Hazırlama Aracı — Arayüz
 * Veriler yalnızca bu sekmenin oturum deposunda (sessionStorage) tutulur: sayfa yenilenince
 * korunur, sekme/tarayıcı kapatılınca silinir. Aynı bilgisayarı kullanan sonraki kişi önceki
 * BEP'i görmez. Ağ isteği yapılmaz.
 */
(function () {
  "use strict";
  var BEP = window.BEP, tr = BEP.tr;
  var DEPO = "bep-hazirlama-oturum-v1";
  // Önceki sürümlerin localStorage'da kalıcı tuttuğu anahtarlar (açılışta silinir)
  var ESKI_KALICI_DEPOLAR = ["bep-hazirlama-kayitlari-v1", "bep-hazirlama-okul-v1"];
  var durum = { kayitlar: {}, aktifId: null, adim: 1 };

  function $(s, k) { return (k || document).querySelector(s); }
  function $$(s, k) { return Array.prototype.slice.call((k || document).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function uid() { return "bep-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7); }
  function bep() { return durum.kayitlar[durum.aktifId]; }
  function takvim() { return BEP.takvimBilgi(bep() ? bep().egitimYili : BEP.VARSAYILAN_YIL); }
  function otoYukseklik(t) { t.style.height = "auto"; t.style.height = Math.max(t.scrollHeight + 2, 40) + "px"; }
  document.addEventListener("input", function (e) { if (e.target && e.target.tagName === "TEXTAREA" && e.target.closest(".plan-duzenleyici")) otoYukseklik(e.target); });

  /* ------------------------------------------------------------------ bildirim */
  function bildir(metin, tur) {
    var d = document.createElement("div");
    d.textContent = metin;
    if (tur === "hata") d.className = "hata";
    $("#bildirim").appendChild(d);
    setTimeout(function () { d.remove(); }, tur === "hata" ? 6000 : 3200);
  }

  /* ------------------------------------------------------------------ depolama */
  function oturumDeposu() { try { return window.sessionStorage || null; } catch (e) { return null; } }
  function eskiKaliciVerileriSil() {
    try { ESKI_KALICI_DEPOLAR.forEach(function (k) { window.localStorage.removeItem(k); }); } catch (e) { /* depolama kapalı */ }
  }
  function yukle() {
    try {
      var j = JSON.parse((oturumDeposu() && oturumDeposu().getItem(DEPO)) || "{}");
      durum.kayitlar = j.kayitlar || {};
      durum.aktifId = j.aktifId;
    } catch (e) { durum.kayitlar = {}; }
    Object.keys(durum.kayitlar).forEach(function (k) {
      // Uyarlanamayan bozuk kayıt uygulamanın açılmasını engellemesin
      try { kayitDuzelt(durum.kayitlar[k]); } catch (e) { if (window.console) console.error("Kayıt uyarlanamadı:", k, e); delete durum.kayitlar[k]; }
    });
  }
  var kayitZamanlayici = null;
  function kaydet() {
    try {
      oturumDeposu().setItem(DEPO, JSON.stringify({ kayitlar: durum.kayitlar, aktifId: durum.aktifId }));
      var s = new Date();
      var saat = ("0" + s.getHours()).slice(-2) + ":" + ("0" + s.getMinutes()).slice(-2);
      // Dar ekranda (telefon) kısa metin gösterilir
      $("#kayitDurumu").innerHTML = '<span class="uzun">✓ Bu sekmede tutuluyor ' + saat + " • sekme kapatılınca silinir</span>" +
        '<span class="kisa" title="Bilgiler bu sekmede tutulur; sekme kapatılınca silinir">✓ Kaydedildi ' + saat + "</span>";
    } catch (e) {
      $("#kayitDurumu").textContent = "⚠ Tarayıcı bu sayfada kayda izin vermiyor; bilgiler yalnızca sayfa açıkken korunur (yenilemeyin).";
    }
  }
  function kaydetGecikmeli() { clearTimeout(kayitZamanlayici); kayitZamanlayici = setTimeout(kaydet, 400); }

  /* ------------------------------------------------------------------ yeni kayıt */
  // Arayüzde seçilmeyen sabit ayarlar (destek düzeyi ve ölçüt 3. adımda seçilebilir)
  var OTOMATIK_AYARLAR = { ozne: "ad", duzen: "mufredat" };
  // Artık toplanmayan kişisel alanlar (veri en aza indirme) ve arayüzden kaldırılan bölümler
  var KALDIRILAN_OGRENCI_ALANLARI = ["tc", "cinsiyet", "dogumTarihi", "dogumYeri", "alan", "ramKurum", "ramTarih", "ramNo", "okulDisiDestek"];

  /* Boş BEP. "onceki" verilirse aynı oturumda sıradaki öğrenci için okul ve BEP birimi
     bilgileri (öğrenciye özgü veli ve sınıf rehber öğretmeni hariç) aktarılır. */
  function yeniBep(onceki) {
    var T = BEP.takvimBilgi(BEP.VARSAYILAN_YIL);
    var b = {
      id: uid(), surum: 2, olusturma: new Date().toISOString(), guncelleme: new Date().toISOString(), egitimYili: T.egitimYili,
      okul: { il: "", ilce: "", ad: "", tur: "anadolu", hazirlikSinifi: false, mudur: "", baslikSatiri2: "" },
      ogrenci: { ad: "", no: "", sinif: "9", sube: "", yetersizlik: [], yetersizlikMetni: "",
        hizmet: "Tam Zamanlı Kaynaştırma / Bütünleştirme", bepBaslangic: T.dersBasiIso, bepBitis: T.dersSonuIso, cihaz: "" },
      ders: { id: "", planId: "", planElle: false, saat: "", ogretmen: "", ozel: { ad: "", sinif: "9", saat: 2, uniteler: [{ ad: "", saat: "", kazanimlar: "" }] } },
      performans: { gelisim: "", ders: "", guclu: "", destek: "", davranis: "" },
      ayarlar: { destek: "", olcut: "80", ozne: "ad", sinavHaftalari: [8, 16, 25, 33], duzen: "mufredat", donemSayfa: false, kvkkNotu: true },
      plan: null, izleme: [],
      kurul: { baskan: "", baskanUnvan: "Müdür Yardımcısı", sinifRehber: "", rehberOgretmen: "", veli: "", tarih: "" },
      tasdik: { tarih: "", uygulamaTarihi: "" }
    };
    if (onceki) {
      b.okul = JSON.parse(JSON.stringify(onceki.okul || b.okul));
      b.tasdik = JSON.parse(JSON.stringify(onceki.tasdik || b.tasdik));
      ["baskan", "baskanUnvan", "rehberOgretmen", "tarih"].forEach(function (k) { if (onceki.kurul && onceki.kurul[k] !== undefined) b.kurul[k] = onceki.kurul[k]; });
      b.ders.ogretmen = (onceki.ders && onceki.ders.ogretmen) || "";
      b.ayarlar.kvkkNotu = !onceki.ayarlar || onceki.ayarlar.kvkkNotu !== false;
    }
    performansOtomatik(b);
    return b;
  }

  /* Kayıtta eksik kalan alanları varsayılanlarla tamamlar (diziler ve dolu değerler korunur) */
  function eksikleriTamamla(hedef, varsayilan) {
    Object.keys(varsayilan).forEach(function (k) {
      var v = varsayilan[k];
      if (v && typeof v === "object" && !Array.isArray(v)) {
        if (!hedef[k] || typeof hedef[k] !== "object" || Array.isArray(hedef[k])) hedef[k] = {};
        eksikleriTamamla(hedef[k], v);
      } else if (hedef[k] === undefined || hedef[k] === null) hedef[k] = v;
    });
  }

  /* Eski sürümlerde kaydedilmiş BEP'leri yeni yapıya uyarlar */
  function kayitDuzelt(b) {
    if (!b || typeof b !== "object") throw new Error("Geçersiz kayıt");
    var v = yeniBep();
    delete v.id; delete v.plan;
    eksikleriTamamla(b, v);
    if (!b.id) b.id = uid();
    if (!BEP.TAKVIMLER[b.egitimYili]) b.egitimYili = BEP.VARSAYILAN_YIL;
    KALDIRILAN_OGRENCI_ALANLARI.forEach(function (k) { delete b.ogrenci[k]; });
    if (!Array.isArray(b.ogrenci.yetersizlik)) b.ogrenci.yetersizlik = [];
    b.ayarlar = b.ayarlar || {};
    for (var k in OTOMATIK_AYARLAR) b.ayarlar[k] = OTOMATIK_AYARLAR[k];
    // "" = tanıya göre otomatik destek düzeyi
    if (!BEP.DESTEK_DUZEYLERI.some(function (d) { return d.id === b.ayarlar.destek; })) b.ayarlar.destek = "";
    if (!BEP.OLCUTLER.some(function (o) { return o.id === b.ayarlar.olcut; })) b.ayarlar.olcut = "80";
    if (!Array.isArray(b.ayarlar.sinavHaftalari)) b.ayarlar.sinavHaftalari = [8, 16, 25, 33];
    if (!Array.isArray(b.izleme)) b.izleme = [];
    if (b.plan && (typeof b.plan !== "object" || !Array.isArray(b.plan.satirlar))) b.plan = null;
    if (!Array.isArray(b.ders.ozel.uniteler)) b.ders.ozel.uniteler = [{ ad: "", saat: "", kazanimlar: "" }];
    delete b.uyarlamalar; delete b.uyarlamaElle; delete b.kararlar;
    // Performans düzeyi artık arayüzde düzenlenmez; her zaman tanı ve derse göre üretilir
    delete b.performansElle;
    b.surum = 2;
    performansOtomatik(b);
    return b;
  }

  /* Performans düzeyi: tanı (yetersizlik türü) ve derse göre otomatik doldurulur */
  function performansOtomatik(b) { b.performans = BEP.varsayilanPerformans(b); }

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
    var eski = al(bep(), el.dataset.alan);
    ata(bep(), el.dataset.alan, alanDegeri(el));
    degisti(el.dataset.alan, eski);
  }
  document.addEventListener("input", olay);
  document.addEventListener("change", olay);

  /* Öğrencinin sınıfı ile seçili planın sınıfı farklı mı? (Seçmeli ve elle girilen dersler hariç) */
  function sinifUyusmazligi(b) {
    if (!b.ders.id || b.ders.id === "__ozel__") return null;
    var plan = BEP.planBul(BEP.dersBul(b.ders.id), b.ders.planId);
    if (!plan || plan.sinif === "S" || !plan.sinif || plan.sinif === b.ogrenci.sinif) return null;
    return { ogrenci: b.ogrenci.sinif, plan: plan.sinif };
  }

  function degisti(alan, eski) {
    var b = bep();
    b.guncelleme = new Date().toISOString();
    kaydetGecikmeli();
    if (/^okul\.|^kurul\.(baskan|baskanUnvan|rehberOgretmen|tarih)$|^tasdik\.|^ders\.ogretmen$/.test(alan)) ustBaslikGoster();
    if (alan === "ders.saat") { saatUyarisiGoster(); planEtiketleriniGuncelle(); if (durum.adim === 3) ayarSecimleriCiz(); }
    if (/^ayarlar\.(destek|olcut)$/.test(alan) && durum.adim === 3) { ayarSecimleriCiz(); planDurumuGuncelle(); }
    var ders = b.ders.id && b.ders.id !== "__ozel__" ? BEP.dersBul(b.ders.id) : null;
    // Okul türü / hazırlık sınıfı değişince plan, öğretmen elle başka plan seçmediyse yeniden önerilir
    if ((alan === "okul.tur" || alan === "okul.hazirlikSinifi") && ders && (!b.ders.planElle || alan === "okul.hazirlikSinifi")) {
      var sinif = (BEP.planBul(ders, b.ders.planId) || {}).sinif;
      var oneri = BEP.planOnerBep(b, sinif);
      if (oneri && oneri !== b.ders.planId) { b.ders.planId = oneri; b.ders.saat = ""; }
      if (alan === "okul.hazirlikSinifi") b.ders.planElle = false;
    }
    // Öğrencinin sınıfı değişince plan, önceki sınıfa göre seçilmişse yeni sınıfa taşınır
    if (alan === "ogrenci.sinif" && ders && !b.ders.planElle) {
      var mevcut = BEP.planBul(ders, b.ders.planId);
      if (mevcut && mevcut.sinif === eski && ders.planlar.some(function (p) { return p.sinif === b.ogrenci.sinif; })) {
        b.ders.planId = BEP.planOnerBep(b, b.ogrenci.sinif); b.ders.saat = "";
        bildir("Ders planı " + BEP.sinifAdi(b.ogrenci.sinif) + " planı olarak güncellendi.");
      }
    }
    if ((alan === "okul.tur" || alan === "okul.hazirlikSinifi") && durum.adim === 2) dersFormuCiz();
    if (/^ogrenci\.(ad|yetersizlik|yetersizlikMetni|sinif)$|^ders\.(id|planId|ozel\.ad)$/.test(alan)) performansOtomatik(b);
    adimDurumlari();
  }

  /* ------------------------------------------------------------------ dosya indirme */
  function indir(ad, veri, tip) {
    var blob = new Blob([veri], { type: tip });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = ad;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  /* ------------------------------------------------------------------ adımlar */
  // 1 Öğrenci • 2 Ders • 3 Yıllık Plan • 4 Okul ve BEP Birimi • 5 Önizle ve İndir
  var SON_ADIM = 5;
  function adimaGit(n) {
    durum.adim = n;
    $$(".panel").forEach(function (p) { p.hidden = +p.dataset.panel !== n; });
    $$("#adimlar button").forEach(function (b) {
      var aktif = +b.dataset.adim === n;
      b.classList.toggle("aktif", aktif);
      if (aktif) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current");
    });
    $("#btnGeri").disabled = n === 1;
    $("#btnIleri").textContent = n === SON_ADIM ? "⬇ Word Belgesi İndir" : "İleri →";
    if (n === 2) dersFormuCiz();
    if (n === 3) planAdimi();
    if (n === 5) onizlemeAdimi();
    adimDurumlari();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  $$("#adimlar button").forEach(function (b) { b.addEventListener("click", function () { adimaGit(+b.dataset.adim); }); });
  $("#btnGeri").addEventListener("click", function () { if (durum.adim > 1) adimaGit(durum.adim - 1); });
  $("#btnIleri").addEventListener("click", function () { if (durum.adim < SON_ADIM) adimaGit(durum.adim + 1); else wordIndir(); });

  function adimDurumlari() {
    var b = bep();
    var tamam = {
      1: !!(tr.bosluk(b.ogrenci.ad) && b.ogrenci.yetersizlik.length),
      2: !!(b.ders.id && (b.ders.id === "__ozel__" ? tr.bosluk(b.ders.ozel.ad) : b.ders.planId)),
      3: !!(b.plan && b.plan.satirlar && b.plan.satirlar.length),
      4: !!(tr.bosluk(b.okul.ad) && tr.bosluk(b.okul.il) && tr.bosluk(b.kurul.baskan))
    };
    $$("#adimlar button").forEach(function (btn) { btn.classList.toggle("tamam", !!tamam[+btn.dataset.adim]); });
  }

  /* ------------------------------------------------------------------ ADIM 4 – okul ve BEP birimi */
  function ustBaslikGoster() {
    var b = bep();
    var s2 = BEP.ustBaslikSatiri(b.okul);
    var okulAd = tr.up(b.okul.ad || "");
    $("#ustBaslikOnizleme").innerHTML = "<b>Belge üst başlığı:</b> T.C. / " + esc(s2 || "… VALİLİĞİ") + " / " + esc(okulAd ? (/MÜDÜRLÜĞÜ$/.test(okulAd) ? okulAd : okulAd + " MÜDÜRLÜĞÜ") : "… MÜDÜRLÜĞÜ");
  }

  /* ------------------------------------------------------------------ ADIM 1 – öğrenci */
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

  /* ------------------------------------------------------------------ ADIM 2 – ders */
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
    // Hazırlık sınıfı seçeneği yalnız hazırlıklı/hazırlıksız plan varyantı olan derslerde gösterilir (İngilizce)
    $("#hazirlikKutu").hidden = !(ders && ders.planlar.some(function (p) { return p.okul === "hazirlikli"; }));
    if (ders) {
      var siniflar = SINIF_SIRA.filter(function (s) { return ders.planlar.some(function (p) { return p.sinif === s; }); });
      var plan = BEP.planBul(ders, d.planId);
      var sinif = plan ? plan.sinif : siniflar[0];
      $("#sinifSec").innerHTML = siniflar.map(function (s) { return '<option value="' + s + '"' + (s === sinif ? " selected" : "") + ">" + (s === "S" ? "Seçmeli ders" : BEP.sinifAdi(s)) + "</option>"; }).join("");
      var planlar = ders.planlar.filter(function (p) { return p.sinif === sinif; });
      $("#planSec").innerHTML = planlar.map(function (p) {
        return '<option value="' + p.id + '"' + (p.id === d.planId ? " selected" : "") + ">" + esc(planSecenekEtiketi(b, ders, p)) + "</option>";
      }).join("");
    } else {
      $("#sinifSec").innerHTML = ""; $("#planSec").innerHTML = "";
    }
    var ctx = BEP.baglam(b);
    $("#saatGir").placeholder = ctx.plan ? String(BEP.okulTuruSaati(b) || ctx.plan.saat) : "";
    formuDoldur($('[data-panel="2"]'));
    planBilgiCiz(ctx);
    saatUyarisiGoster();
    sinifUyarisiGoster();
  }
  function sinifUyarisiGoster() {
    var u = sinifUyusmazligi(bep()), kutu = $("#sinifUyari");
    kutu.hidden = !u;
    if (u) kutu.textContent = "Öğrencinin sınıfı (" + BEP.sinifAdi(u.ogrenci) + ") ile seçilen planın sınıf düzeyi (" + BEP.sinifAdi(u.plan) + ") farklı. Öğrenci için bilinçli olarak alt/üst sınıf programı seçilmediyse “Sınıf Düzeyi”ni değiştirin.";
  }
  /* Plan seçeneği etiketi: öğrenciye uygulanacak haftalık saati gösterir
     (elle girilen saat > okul türünün resmî saati > çerçeve planın saati) */
  function planSecenekEtiketi(b, ders, p) {
    var cozulmus = BEP.planBul(ders, p.id);
    var saat = parseInt(b.ders.saat, 10) || BEP.okulTuruSaati({ okul: b.okul, ders: { id: b.ders.id, planId: p.id } }) || cozulmus.saat;
    return p.etiket + " – " + programEtiketi(cozulmus) + " – haftalık " + saat + " saat" +
      (saat !== cozulmus.saat ? " (çerçeve plan: " + cozulmus.saat + " saat)" : "");
  }
  function planEtiketleriniGuncelle() {
    var b = bep(), ders = BEP.dersBul(b.ders.id);
    if (!ders) return;
    $$("#planSec option").forEach(function (o) {
      var p = BEP.planBul(ders, o.value);
      if (p) o.textContent = planSecenekEtiketi(b, ders, p);
    });
  }
  function saatUyarisiGoster() {
    var b = bep(), kutu = $("#saatUyari");
    var mtal = b.okul.tur === "mtal" || b.okul.tur === "diger" || b.okul.tur === "aihl";
    var ctx = BEP.baglam(b), okulSaat = BEP.okulTuruSaati(b);
    if (okulSaat && !b.ders.saat) {
      kutu.hidden = false;
      kutu.textContent = "Okulunuzun haftalık ders çizelgesine göre bu ders " + ctx.plan.sinif + ". sınıfta haftalık " + okulSaat + " saattir; plan " + okulSaat + " saate göre hazırlanır (resmî çerçeve plan: haftalık " + ctx.plan.saat + " saat). Konu sıralaması aynen korunur.";
    } else if (mtal && ctx.plan && b.ders.id !== "__ozel__" && !b.ders.saat) {
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
      (p.program === "2018" ? " <small>(" + esc(ctx.yil) + "’de 12. sınıflarda önceki öğretim programları uygulanmaya devam etmektedir.)</small>" : "") +
      (p.dagitim === "otomatik" ? "<br><small>Bu seçmeli ders için MEB haftalık plan yayımlamadığından üniteler, resmî ünite ders saatlerine göre haftalara orantılı dağıtılmıştır.</small>" : "") +
      "<br><b>Üniteler / temalar:</b><ul>" + uniteler + "</ul>" +
      (destekler ? '<details class="ek-ayar"><summary>Öğretim programındaki “Destekleme” önerileri (TYMM)</summary><ul>' + destekler + "</ul></details>" : "");
  }
  $("#dersSec").addEventListener("change", function (e) {
    var b = bep(), id = e.target.value;
    b.ders.id = id;
    b.ders.planElle = false;
    if (id && id !== "__ozel__") {
      var ders = BEP.dersBul(id);
      var ogrSinif = b.ogrenci.sinif;
      var var_ = ders.planlar.some(function (p) { return p.sinif === ogrSinif; });
      var sinif = var_ ? ogrSinif : (ders.planlar.some(function (p) { return p.sinif === "S"; }) ? "S" : ders.planlar[0].sinif);
      b.ders.planId = BEP.planOnerBep(b, sinif);
      if (!var_ && sinif !== "S") bildir("Bu ders için " + BEP.sinifAdi(ogrSinif) + " planı yok; " + BEP.sinifAdi(sinif) + " seçildi.");
    } else b.ders.planId = "";
    b.ders.saat = "";
    degisti("ders.id"); dersFormuCiz(); adimDurumlari();
  });
  $("#sinifSec").addEventListener("change", function (e) {
    var b = bep();
    b.ders.planId = BEP.planOnerBep(b, e.target.value); b.ders.saat = ""; b.ders.planElle = false;
    degisti("ders.planId"); dersFormuCiz();
  });
  // Öğretmenin elle seçtiği plan varyantı, okul türü değişince geri alınmaz
  $("#planSec").addEventListener("change", function (e) { bep().ders.planId = e.target.value; bep().ders.saat = ""; bep().ders.planElle = true; degisti("ders.planId"); dersFormuCiz(); });

  function ozelUniteCiz() {
    var oz = bep().ders.ozel;
    if (!oz.uniteler || !oz.uniteler.length) oz.uniteler = [{ ad: "", saat: "", kazanimlar: "" }];
    $("#ozelUniteler").innerHTML = '<label style="max-width:220px">Haftalık Ders Saati<input type="number" min="1" max="40" data-alan="ders.ozel.saat"></label>' +
      (oz.uniteler.length > 36 ? '<p class="uyari-kutusu">36’dan fazla öğrenme birimi girildi; bazı haftalarda iki birim birlikte planlanır.</p>' : "") +
      oz.uniteler.map(function (u, i) {
        return '<div class="ozel-unite"><label>Öğrenme birimi / ünite ' + (i + 1) + '<input data-alan="ders.ozel.uniteler.' + i + '.ad" autocomplete="off" placeholder="Örn. İş Sağlığı ve Güvenliği"></label>' +
          '<label>Ders saati<input type="number" min="1" data-alan="ders.ozel.uniteler.' + i + '.saat" placeholder="Örn. 12"></label>' +
          '<button type="button" class="sil-dugme" data-ozel-sil="' + i + '" title="Üniteyi sil" aria-label="' + (i + 1) + '. üniteyi sil">✕</button>' +
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

  /* ------------------------------------------------------------------ ADIM 3 – yıllık plan */
  /* Haftalık ders saati 6 ve üzeri olan derslerde dönem başına üçüncü sınav yapılabilir (OKY Md. 45/1-a) */
  function ucuncuSinavOlur(b) { return BEP.baglam(b).saat >= 6; }
  function ayarSecimleriCiz() {
    var b = bep(), ctx = BEP.baglam(b), T = takvim();
    var destekBul = function (id) { return BEP.DESTEK_DUZEYLERI.filter(function (d) { return d.id === id; })[0] || {}; };
    var destek = destekBul(ctx.destek), oto = destekBul(BEP.otomatikDestek(b));
    var duzen = BEP.PLAN_DUZENLERI.mufredat;
    $("#destekSec").innerHTML = '<option value="">Otomatik – tanıya göre (' + esc(oto.ad || "") + ")</option>" +
      BEP.DESTEK_DUZEYLERI.map(function (d) { return '<option value="' + d.id + '">' + esc(d.ad) + "</option>"; }).join("");
    $("#olcutSec").innerHTML = BEP.OLCUTLER.map(function (o) { return '<option value="' + o.id + '">' + esc(o.ad + (o.id === "80" ? " – önerilen" : "")) + "</option>"; }).join("");
    $("#otomatikAyarlar").innerHTML = (ctx.zengin
      ? "<b>Zenginleştirme:</b> Özel yetenekli öğrencinin planı sadeleştirme yerine ileri düzey kaynak, araştırma ve proje görevleriyle zenginleştirilir (ÖEHY Md. 19/2)."
      : "<b>" + esc(destek.ad || "") + ":</b> " + esc(destek.aciklama || "")) +
      "<br><small>KDA öznesi: <b>" + esc(ctx.ozne || "Öğrenci") + "</b> • Tablo düzeni: <b>" + esc(duzen.ad || "") + "</b>" +
      " • Destek düzeyi veya ölçüt değişince plan yeniden oluşturulur.</small>";
    // Sınav haftaları dönemlere göre: 1. dönem 1–donemSon, 2. dönem donemSon+1–sonÖğretimHaftası
    var sh = BEP.sinavHaftalariTemiz(b.ayarlar.sinavHaftalari, T.sonOgretimHaftasi);
    var d1 = sh.filter(function (h) { return h <= T.donemSonHaftasi; }), d2 = sh.filter(function (h) { return h > T.donemSonHaftasi; });
    var ucuncu = ucuncuSinavOlur(b) || d1.length > 2 || d2.length > 2;
    function girisler(donem, liste, min, max) {
      return '<span class="sinav-donem"><small>' + donem + '. dönem</small>' + [0, 1, 2].map(function (i) {
        var gizli = i === 2 && !ucuncu;
        return '<input type="number" min="' + min + '" max="' + max + '" data-sinav="' + donem + "-" + i + '" value="' + (liste[i] || "") + '"' + (gizli ? " hidden" : "") +
          ' title="' + donem + ". dönem " + (i + 1) + '. sınav haftası (' + min + "–" + max + ')" aria-label="' + donem + ". dönem " + (i + 1) + '. BEP sınavı haftası">';
      }).join("") + "</span>";
    }
    $("#sinavHaftalari").innerHTML = girisler(1, d1, 1, T.donemSonHaftasi) + girisler(2, d2, T.donemSonHaftasi + 1, T.sonOgretimHaftasi);
    $("#sinavAciklama").textContent = "(dönem başına 2 sınav" + (ucuncuSinavOlur(b) ? "; haftalık " + ctx.saat + " saatlik derste 3. sınav da yapılabilir" : "") + " – OKY Md. 45/1-a)";
    formuDoldur($(".ayarlar-kart"));
  }
  $("#sinavHaftalari").addEventListener("input", function () {
    // Tekrarlı girişler kontrol listesinde uyarılsın diye ham sırayla saklanır (üretici tekrarları ayıklar)
    bep().ayarlar.sinavHaftalari = $$("#sinavHaftalari input").map(function (i) { return parseInt(i.value, 10); }).filter(function (n) { return n >= 1 && n <= 37; });
    degisti("ayarlar.sinavHaftalari");
  });

  /* Elle düzenleme: plan hücreleri ya da UDA cümleleri (izleme çizelgesi) */
  function duzenlemeVarMi(b) {
    return !!(b.plan && b.plan.satirlar && (b.plan.satirlar.some(function (s) { return s.duzenlendi && Object.keys(s.duzenlendi).length; }) ||
      (b.izleme || []).some(function (u) { return u.duzenlendi; })));
  }
  /* Plan başka bir ders/plan için mi oluşturulmuş? (Elle düzenlemeler o zaman korunamaz) */
  function kaynakDegisti(b) { return !!(b.plan && b.plan.kaynak && b.plan.kaynak !== BEP.planKaynagi(b)); }

  function planOlustur(koru) {
    var b = bep();
    if (!b.ders.id) { bildir("Önce 2. adımda ders seçiniz.", "hata"); return false; }
    var s = BEP.planiHazirla(b, { duzenlemeleriKoru: !!koru });
    if (s.hata) { bildir(s.hata, "hata"); return false; }
    if (s.duzenlemelerAtildi) bildir("Ders veya plan değiştiği için önceki elle düzenlemeler yeni plana aktarılmadı.");
    kaydet(); adimDurumlari();
    return true;
  }
  function planAdimi() {
    ayarSecimleriCiz();
    var b = bep();
    if (!b.ders.id) { $("#planTablosu").innerHTML = ""; planUyarisi("Yıllık planın oluşturulabilmesi için 2. adımda ders seçiniz."); return; }
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
    if (duzenlemeVarMi(b) && !kaynakDegisti(b)) koru = confirm("Elle düzenlediğiniz hücreler korunsun mu?\n\nTamam: düzenlemeler korunur, diğer hücreler yenilenir.\nİptal: plan tamamen baştan oluşturulur.");
    if (planOlustur(koru)) { planTablosuCiz(); bildir("Yıllık plan oluşturuldu."); }
  });
  $("#sinavHaftalari").addEventListener("change", function () { if (durum.adim === 3) planDurumuGuncelle(); });

  function planDurumuGuncelle() {
    var b = bep();
    if (!b.plan) return;
    if (b.plan.imza !== BEP.planImzasi(b) || kaynakDegisti(b)) {
      if (!duzenlemeVarMi(b)) { planOlustur(false); planTablosuCiz(); return; }
      if (kaynakDegisti(b)) planUyarisi("Ders veya plan değişti; bu tablo önceki ders için oluşturulmuştu. Elle düzenlemeler yeni derse aktarılamaz, planı baştan oluşturun.", '<button type="button" class="dugme birincil kucuk" data-yenile="sifir">Baştan oluştur</button>');
      else planUyarisi("Seçimleriniz değişti; yıllık planı yenilemeniz önerilir.", '<button type="button" class="dugme birincil kucuk" data-yenile="koru">Yenile (düzenlemelerimi koru)</button><button type="button" class="dugme ikincil kucuk" data-yenile="sifir">Baştan oluştur</button>');
    } else planUyarisi("");
    var ctx = BEP.baglam(b);
    var hafta = b.plan.satirlar.filter(function (s) { return s.tur === "hafta"; }).length;
    $("#planDurum").textContent = hafta + " hafta • " + b.plan.udalar.length + " uzun dönemli amaç • " + (ctx.plan ? ctx.plan.kaynak.replace(/\s*\(.*\)\s*$/, "") : "");
  }

  var PLAN_SUTUNLARI = [["unite", "Ünite / Tema"], ["cikti", "Öğrenme Çıktısı / Kazanım (müfredat)"], ["kda", "BEP Amacı (UDA / KDA)"], ["yontem", "Yöntem ve Teknikler"], ["arac", "Araç-Gereçler"], ["olcme", "Ölçme-Değerlendirme ve Açıklamalar"]];
  function udaMetni(b, no) {
    var u = (b.izleme || []).filter(function (x) { return x.no === no; })[0] || (b.plan.udalar || []).filter(function (x) { return x.no === no; })[0];
    return u ? u.metin : "";
  }
  function planTablosuCiz() {
    var b = bep();
    if (!b.plan) { $("#planTablosu").innerHTML = ""; return; }
    var sutunlar = PLAN_SUTUNLARI;
    var satirlar = b.plan.satirlar;
    var sinavlar = BEP.baglam(b).sinavHaftalari;
    var izlemeDuzenli = {};
    (b.izleme || []).forEach(function (u) { if (u.duzenlendi) izlemeDuzenli[u.no] = true; });
    var h = '<table class="plan"><thead><tr><th scope="col">Hafta</th>' + sutunlar.map(function (s) { return '<th scope="col" class="sutun-genislik-' + s[0] + '">' + esc(s[1]) + "</th>"; }).join("") + "</tr></thead><tbody>";
    satirlar.forEach(function (s, i) {
      var aySonu = !satirlar[i + 1] || satirlar[i + 1].ay !== s.ay;
      if (s.tur === "tatil") {
        h += '<tr class="tatil' + (aySonu ? " ay-sonu" : "") + '"><td class="hafta-hucre"><span class="ay">' + esc(s.ay) + "</span><br>—</td><td colspan=\"" + sutunlar.length + "\">" + esc(s.ad + " • " + s.tarih + " • " + s.aciklama) + "</td></tr>";
        return;
      }
      var ozel = /^(OKUL TEMELLİ|SOSYAL ETKİNLİK)/.test(s.unite || "");
      h += '<tr class="' + (aySonu ? "ay-sonu " : "") + (ozel ? "ozel " : "") + (s.bepDisi ? "bep-disi" : "") + '" data-i="' + i + '"><th scope="row" class="hafta-hucre"><span class="ay">' + esc(s.ay) + "</span><br>" + s.no + ". Hafta<small>" + esc(s.tarih) + "</small>" +
        (sinavlar.indexOf(s.no) >= 0 && !s.bepDisi ? '<span class="sinav-rozet">BEP sınavı</span>' : "") + "</th>";
      sutunlar.forEach(function (sut) {
        var a = sut[0], ed = s.duzenlendi && s.duzenlendi[a];
        h += "<td>";
        // UDA'nın ilk haftasında UDA cümlesi (düzenlenebilir; dönem sonu izleme çizelgesinde de kullanılır)
        if (a === "kda") (s.udaBasi || []).forEach(function (no) {
          h += '<label class="uda-kutu"><span>UDA ' + no + '</span><textarea data-uda="' + no + '" class="' + (izlemeDuzenli[no] ? "duzenlendi" : "") + '" rows="3" aria-label="UDA ' + no + ' metni">' + esc(udaMetni(b, no)) + "</textarea></label>";
        });
        h += '<textarea data-plan="' + i + '" data-plan-alan="' + a + '" class="' + (ed ? "duzenlendi" : "") + '" rows="' + (a === "kda" ? 4 : 3) + '" aria-label="' + s.no + ". hafta – " + esc(sut[1]) + '">' + esc(s[a] || "") + "</textarea>";
        if (a === "kda" && !ozel && !s.bepDisi) h += '<div class="kda-araclar"><select data-oneri-hafta="' + i + '" aria-label="' + s.no + '. hafta için başka KDA önerisi"><option value="">Başka bir KDA önerisi seç…</option></select></div>';
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
    if (!t.dataset) return;
    if (t.dataset.uda !== undefined) {
      var b = bep(), no = +t.dataset.uda;
      var u = (b.izleme || []).filter(function (x) { return x.no === no; })[0];
      if (u) { u.metin = t.value; u.duzenlendi = true; }
      t.classList.add("duzenlendi");
      kaydetGecikmeli();
      return;
    }
    if (t.dataset.plan === undefined) return;
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
    // İki üniteli haftada öneri ilk KDA satırının yerine geçer; diğer satır korunur
    var satirlar = String(s.kda || "").split("\n");
    var on = (satirlar[0].match(/^(UDA\s*\d+\s*\/\s*KDA\s*[\d.]+\s*:\s*)/) || [""])[0];
    satirlar[0] = on + BEP.kdaCumlesiOlustur(bep(), t.value.replace(/\.$/, ""), i);
    s.kda = satirlar.join("\n");
    s.duzenlendi = s.duzenlendi || {}; s.duzenlendi.kda = true;
    var ta = $('textarea[data-plan="' + i + '"][data-plan-alan="kda"]');
    ta.value = s.kda; ta.classList.add("duzenlendi"); otoYukseklik(ta);
    t.value = "";
    kaydetGecikmeli();
  });

  /* ------------------------------------------------------------------ ADIM 5 – önizle ve indir */
  function tarihGecerli(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s || ""); }
  function trTarih(s) { return BEP.tarih.isoToTR(s); }
  function kontroller() {
    var b = bep(), l = [], T = takvim();
    var ekle = function (tur, metin, adim) { l.push({ tur: tur, metin: metin, adim: adim }); };
    if (!tr.bosluk(b.ogrenci.ad)) ekle("hata", "Öğrencinin adı soyadı yazılmamış.", 1);
    if (!b.ogrenci.yetersizlik.length) ekle("hata", "Yetersizlik türü / eğitsel tanı seçilmemiş.", 1);
    if (!b.ders.id) ekle("hata", "Ders seçilmemiş.", 2);
    if (b.ders.id === "__ozel__" && !b.ders.ozel.uniteler.some(function (u) { return tr.bosluk(u.ad); })) ekle("hata", "Elle girilen ders için en az bir öğrenme birimi/ünite yazınız.", 2);
    if (kaynakDegisti(b)) ekle("hata", "Yıllık plan başka bir ders/plan için oluşturulmuş; 3. adımda planı yeniden oluşturun.", 3);
    else if (b.plan && b.plan.imza !== BEP.planImzasi(b)) ekle("uyari", "Seçimleriniz plan oluşturulduktan sonra değişmiş; 3. adımda planı yenilemeniz önerilir.", 3);
    var u = sinifUyusmazligi(b);
    if (u) ekle("uyari", "Öğrencinin sınıfı (" + BEP.sinifAdi(u.ogrenci) + ") ile planın sınıf düzeyi (" + BEP.sinifAdi(u.plan) + ") farklı. Bilinçli bir tercih değilse 2. adımda sınıf düzeyini değiştirin.", 2);
    if (b.ders.id === "__ozel__" && b.ders.ozel.uniteler.filter(function (x) { return tr.bosluk(x.ad); }).length > 36) ekle("uyari", "36’dan fazla öğrenme birimi girildi; bazı haftalarda iki birim birlikte planlanır.", 2);
    // BEP yazılı sınavları (OKY Md. 45/1-a): dönem başına 2; haftalık 6+ saatlik derslerde 3. sınav yapılabilir
    var ham = (b.ayarlar.sinavHaftalari || []).map(Number);
    var sh = BEP.sinavHaftalariTemiz(ham, T.sonOgretimHaftasi);
    var ust = ucuncuSinavOlur(b) ? 3 : 2;
    var d1 = sh.filter(function (h) { return h <= T.donemSonHaftasi; }).length, d2 = sh.filter(function (h) { return h > T.donemSonHaftasi; }).length;
    if (d1 < 2 || d2 < 2 || d1 > ust || d2 > ust) ekle("uyari", "BEP yazılı sınavları: her dönemde " + (ust === 3 ? "2 (bu derste en çok 3)" : "2") + " sınav haftası belirlenmelidir (OKY Md. 45/1-a; 1. dönem 1-" + T.donemSonHaftasi + ", 2. dönem " + (T.donemSonHaftasi + 1) + "-" + T.sonOgretimHaftasi + ". haftalar).", 3);
    if (ham.length !== sh.length) ekle("uyari", "Aynı sınav haftası birden çok kez girilmiş ya da " + T.sonOgretimHaftasi + ". haftadan sonraki bir hafta yazılmış; sınav haftalarını kontrol edin.", 3);
    // Tarih tutarlılığı
    var o = b.ogrenci, ku = b.kurul, td = b.tasdik;
    if (tarihGecerli(o.bepBaslangic) && tarihGecerli(o.bepBitis) && o.bepBitis < o.bepBaslangic) ekle("hata", "BEP bitiş tarihi başlangıç tarihinden önce olamaz.", 1);
    if ((tarihGecerli(o.bepBaslangic) && (o.bepBaslangic < T.dersBasiIso || o.bepBaslangic > T.dersSonuIso)) || (tarihGecerli(o.bepBitis) && (o.bepBitis > T.dersSonuIso || o.bepBitis < T.dersBasiIso)))
      ekle("uyari", "BEP başlangıç/bitiş tarihleri " + T.egitimYili + " ders yılı (" + T.dersBasi + " – " + T.dersSonu + ") dışında.", 1);
    if (b.plan && b.plan.satirlar.some(function (s) { return s.tur === "hafta" && s.bepDisi && sh.indexOf(s.no) >= 0; })) ekle("uyari", "Bazı BEP sınav haftaları BEP uygulama döneminin dışında kalıyor; sınav haftalarını BEP başlangıç/bitiş tarihlerine göre seçin.", 3);
    if (b.plan && b.plan.satirlar.length && b.plan.satirlar.every(function (s) { return s.tur !== "hafta" || s.bepDisi || /^(OKUL TEMELLİ|SOSYAL ETKİNLİK)/.test(s.unite || ""); })) ekle("hata", "BEP başlangıç/bitiş tarihleri hiçbir öğretim haftasını kapsamıyor.", 1);
    if (tarihGecerli(ku.tarih) && tarihGecerli(td.tarih) && td.tarih < ku.tarih) ekle("uyari", "Müdür onay tarihi (" + trTarih(td.tarih) + ") BEP birimi toplantı tarihinden (" + trTarih(ku.tarih) + ") önce olamaz.", 4);
    if (tarihGecerli(td.uygulamaTarihi) && tarihGecerli(td.tarih) && td.uygulamaTarihi < td.tarih) ekle("uyari", "Uygulamaya başlama tarihi (" + trTarih(td.uygulamaTarihi) + ") müdür onay tarihinden (" + trTarih(td.tarih) + ") önce olamaz.", 4);
    if (tarihGecerli(td.uygulamaTarihi) && tarihGecerli(o.bepBitis) && td.uygulamaTarihi > o.bepBitis) ekle("uyari", "Uygulamaya başlama tarihi BEP bitiş tarihinden sonra.", 4);
    if (!tr.bosluk(b.okul.ad) || !tr.bosluk(b.okul.il)) ekle("uyari", "Okul adı veya il bilgisi eksik (belge başlığında kullanılır).", 4);
    if (!tr.bosluk(b.ders.ogretmen)) ekle("uyari", "Ders öğretmeninin adı yazılmamış (imza bölümünde noktalı satır bırakılır).", 4);
    if (!tr.bosluk(b.kurul.baskan) || !tr.bosluk(b.kurul.rehberOgretmen)) ekle("uyari", "BEP geliştirme birimi üyelerinin adları eksik (imza bölümünde noktalı satır bırakılır).", 4);
    var uniq = {};
    l = l.filter(function (x) { if (uniq[x.metin]) return false; uniq[x.metin] = 1; return true; });
    if (!l.some(function (x) { return x.tur === "hata"; })) l.unshift({ tur: "tamam", metin: "Belge oluşturulmaya hazır. Word belgesini indirip son kontrolünüzü yapabilirsiniz." });
    return l;
  }
  /* Plan, seçimlere göre eskimişse ve elle düzenleme yoksa yeniden üretilir */
  function planiTazele(b) {
    if (b.ders.id && (!b.plan || ((b.plan.imza !== BEP.planImzasi(b) || kaynakDegisti(b)) && !duzenlemeVarMi(b)))) planOlustur(false);
  }
  function onizlemeAdimi() {
    var b = bep();
    performansOtomatik(b);
    planiTazele(b);
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
      // Sayfalar tarayıcıda gerçek ölçümle yeniden yerleştirilir (taşan içerik bir sonraki sayfaya akar)
      if (typeof BEP.sayfalariYerlestir === "function") BEP.sayfalariYerlestir($("#onizleme"));
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
    var b = bep();
    performansOtomatik(b);
    planiTazele(b);
    if (engelVarMi()) return;
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
    var b = bep();
    performansOtomatik(b);
    planiTazele(b);
    if (engelVarMi()) return;
    var model = BEP.belgeModeli(b);
    if (typeof BEP.yazdir === "function") { BEP.yazdir(model); return; }
    $("#yazdirma-alani").innerHTML = BEP.onizlemeHtml(model);
    setTimeout(function () { window.print(); }, 50);
  });

  /* ------------------------------------------------------------------ yeni BEP / temizle */
  function bastanBasla(b, mesaj) {
    durum.kayitlar = {}; durum.kayitlar[b.id] = b; durum.aktifId = b.id;
    kaydet(); hepsiniCiz(); adimaGit(1);
    bildir(mesaj);
  }
  $("#btnYeniBep").addEventListener("click", function () {
    if (!confirm("Bu BEP’teki öğrenci, ders ve plan bilgileri silinecek; okul ve BEP birimi bilgileri sıradaki öğrenci için korunacak.\n\nWord belgesini indirdiyseniz devam edin.")) return;
    bastanBasla(yeniBep(bep()), "Yeni BEP başlatıldı. Okul ve BEP birimi bilgileri korundu.");
  });
  $("#btnTemizle").addEventListener("click", function () {
    if (!confirm("Bu sekmedeki tüm bilgiler (öğrenci, ders, plan, okul ve BEP birimi) silinecek.\n\nWord belgesini indirdiyseniz devam edin.")) return;
    try { oturumDeposu().removeItem(DEPO); } catch (e) { /* depolama kapalı */ }
    eskiKaliciVerileriSil();
    bastanBasla(yeniBep(), "Tüm bilgiler temizlendi.");
  });

  /* ------------------------------------------------------------------ yardım */
  $("#btnYardim").addEventListener("click", function () {
    var m = (window.BEP_VERI && window.BEP_VERI.meta) || { kaynaklar: [] };
    var T = takvim();
    $("#yardimIcerik").innerHTML =
      "<h2>BEP Hazırlama Aracı – Nasıl kullanılır?</h2><ol>" +
      "<li><b>Öğrenci:</b> Öğrencinin bilgilerini yazın; yetersizlik türünü RAM raporuna göre işaretleyin. BEP yıl içinde başlıyorsa başlangıç tarihini yazın; önceki haftalara BEP amacı yazılmaz.</li>" +
      "<li><b>Ders:</b> Okul türünü, dersi ve sınıf düzeyini seçin. Haftalık konular ve öğrenme çıktıları MEB’in " + esc(T.egitimYili) + " resmî çerçeve yıllık planlarından gelir. Meslek dersleri için “elle giriş” seçeneğini kullanın.</li>" +
      "<li><b>Yıllık Plan:</b> Destek düzeyi tanıya göre otomatik belirlenir, KDA ölçütü %80’dir; ikisini de öğrencinize göre değiştirebilirsiniz. Her uzun dönemli amacın (UDA) cümlesi ilk haftasında görünür ve düzenlenebilir; kısa dönemli amaçlar (KDA) haftalara basamaklı dağıtılır. Her hücreyi düzenleyebilir, KDA için başka öneriler seçebilirsiniz. Sarı hücreler elle düzenlenmiştir.</li>" +
      "<li><b>Okul ve BEP Birimi:</b> Okul bilgilerini ve BEP geliştirme birimi üyeleri ile tasdik tarihlerini girin (bir sonraki BEP için hatırlanır; veli ve sınıf rehber öğretmeni her öğrenci için yazılır).</li>" +
      "<li><b>Önizle ve İndir:</b> Mevcut performans düzeyi tanıya ve derse göre otomatik doldurulur. Uyarlamalar (Tablo 4.1–4.2; birden fazla tanıda tüm tanıların düzenlemeleri), BEP birimi kararları (Tablo 4.3) ve izleme çizelgesi tanıya göre otomatik eklenir. Kontrol listesini inceleyin, Word belgesini indirin veya PDF olarak yazdırın.</li></ol>" +
      "<h2>Resmî takvim (" + esc(T.egitimYili) + ")</h2><ul><li>Ders yılı: " + T.dersBasi + " – " + T.dersSonu + " (" + T.sonOgretimHaftasi + " öğretim haftası + " + (T.sonOgretimHaftasi + 1) + ". hafta sosyal etkinlik; 1. dönem 1-" + T.donemSonHaftasi + ". haftalar)</li><li>" +
      T.tatiller.map(function (t) { return esc(tr.ilkHarfBuyuk(tr.low(t.ad))) + ": " + esc(t.tarih); }).join(" • ") + "</li></ul>" +
      "<h2>Kaynaklar</h2><ul>" + m.kaynaklar.map(function (k) { return '<li><a href="' + esc(k.url) + '" target="_blank" rel="noopener">' + esc(k.ad) + "</a></li>"; }).join("") +
      '<li><a href="https://www.meb.gov.tr/2026-2027-egitim-ogretim-yili-takvimi-aciklandi/haber/41057/tr" target="_blank" rel="noopener">MEB ' + esc(T.egitimYili) + ' Eğitim Öğretim Yılı Takvimi</a></li>' +
      '<li><a href="https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=24736&amp;MevzuatTur=7&amp;MevzuatTertip=5" target="_blank" rel="noopener">Özel Eğitim Hizmetleri Yönetmeliği</a> (Md. 19/2 zenginleştirme, 20 BEP içeriği, 22-25 kaynaştırma, değerlendirme ve destek eğitim odası, 47-48 BEP geliştirme birimi)</li>' +
      '<li><a href="https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=18812&amp;MevzuatTur=7&amp;MevzuatTertip=5" target="_blank" rel="noopener">Ortaöğretim Kurumları Yönetmeliği</a> (Md. 10/1-f, 43/1-g, 45/1-a, 45/1-ğ, 51/6)</li>' +
      '<li><a href="https://orgm.meb.gov.tr/meb_iys_dosyalar/2022_09/20140845_BYREYSELLEYTYRYLMYY_EYYTYM_PROGRAMI_TUM_OYRETMENLER_YCYN_YOL_HARITASI.pdf" target="_blank" rel="noopener">ORGM – BEP: Tüm Öğretmenler İçin Yol Haritası</a> (KDA: birey + koşul + davranış + ölçüt)</li>' +
      '<li><a href="https://meslek.meb.gov.tr/dersbilgi" target="_blank" rel="noopener">MTEGM Ders Bilgi Formları (meslek dersleri)</a></li></ul>' +
      "<h2>Önemli notlar</h2><ul><li>" + esc(T.egitimYili) + "’de hazırlık, 9, 10 ve 11. sınıflarda Türkiye Yüzyılı Maarif Modeli programları; 12. sınıflarda önceki programlar uygulanmaktadır (OGM).</li>" +
      "<li>Resmî çerçeve planlar Anadolu/Fen/Sosyal Bilimler liseleri için yayımlanmıştır; MTAL ve diğer okullarda haftalık ders saatinizi 2. adımda düzeltebilirsiniz (MTAL’de Türk Dili ve Edebiyatı 10-12. sınıflarda otomatik olarak 4 saat alınır).</li>" +
      "<li>Üretilen amaçlar birer taslaktır; BEP geliştirme birimi tarafından öğrencinin performansına göre gözden geçirilmelidir.</li>" +
      "<li>Bilgiler yalnızca bu sekmede tutulur; sayfa yenilenince korunur, sekme ya da tarayıcı kapatılınca silinir. Aynı bilgisayarı sonra kullanan kişi önceki BEP’i görmez. İşiniz bitince 5. adımdaki “Tüm bilgileri temizle” düğmesini de kullanabilirsiniz. BEP özel nitelikli kişisel veri içerir (KVKK).</li></ul>";
    $("#yardimDiyalog").showModal();
  });

  /* ------------------------------------------------------------------ başlangıç */
  function hepsiniCiz() {
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
    // Eğitim yılı tek yerden (takvim.js) gelir
    $("#egitimYiliEtiket").textContent = BEP.VARSAYILAN_YIL;
    document.title = "BEP Hazırlama Aracı – Lise (" + BEP.VARSAYILAN_YIL + ")";
    eskiKaliciVerileriSil();
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
