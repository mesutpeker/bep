/*
 * BEP Hazırlama Aracı — Kütüphane
 * Türkçe metin yardımcıları, yetersizlik türü profilleri, ders grupları,
 * yöntem/materyal/ölçme önerileri ve hazır performans ifadeleri.
 *
 * Mevzuat dayanakları:
 *   Özel Eğitim Hizmetleri Yönetmeliği (RG 07.07.2018/30471) Md. 4, 20, 22, 23, 24, 47, 48
 *   Ortaöğretim Kurumları Yönetmeliği (RG 07.09.2013/28758) Md. 10/1-f, 43/1-g, 45/1-ğ, 51/6, 168
 *   ORGM "Bireyselleştirilmiş Eğitim Programı: Tüm Öğretmenler İçin Yol Haritası" (2022)
 */
(function (kok) {
  "use strict";
  var BEP = (kok.BEP = kok.BEP || {});

  /* ======================================================================
   * Türkçe metin yardımcıları
   * ==================================================================== */
  var SESLI = "aeıioöuüâîû";
  var KALIN = "aıouâû";
  var ISTISNA_IR = ["al", "bil", "bul", "dur", "gel", "gör", "kal", "ol", "öl", "san", "var", "ver", "vur"];
  var OZEL_AD_BASLARI = ["Hz.", "Allah", "Atatürk", "Mustafa", "Türk", "Türkiye", "Türkçe", "Osmanlı", "İslam", "Kur’an", "Kur'an",
    "Cumhuriyet", "Anadolu", "Avrupa", "Asya", "Afrika", "Amerika", "Millî", "Milli", "Selçuklu", "Bizans", "Roma", "Arap", "İngiliz",
    "Fransız", "Rus", "Alman", "Yunan", "Mısır", "Mezopotamya", "Orta Asya", "Orta Çağ", "İlk Çağ", "Yeni Çağ", "Güneş", "Dünya",
    "Peygamber", "Muhammed", "İstanbul", "Ankara", "Lozan", "Sevr", "Mondros", "Çanakkale", "TBMM", "Ege", "Karadeniz", "Akdeniz",
    "Marmara", "Mevlana", "Yunus", "Fatih", "Kanuni", "Nutuk", "Gençliğe", "İstiklal", "İstiklâl", "Kurtuluş", "Birinci", "İkinci",
    "Hristiyan", "Yahudi", "Müslüman", "Budist", "Hindu", "Sünnet", "Kur’an-ı", "Hicri", "Miladi", "Hint", "Çin", "Japon", "Balkan", "Endülüs", "Abbasi", "Emevi", "Göktürk", "Uygur", "Hun", "Karahanlı",
    "Gazneli", "Harezm", "Memlük", "Safevi", "Rum", "Hicaz", "Mekke", "Medine", "Taif", "Ebu", "Ali", "Ömer", "Osman", "Hatice",
    "Ayşe", "Fatıma", "Kâbe", "Kabe", "Ramazan", "Kurban", "Atatürkçülük", "Türkistan", "Anayasa", "Avrasya", "Ortadoğu"];

  function up(s) { return String(s || "").toLocaleUpperCase("tr-TR"); }
  function low(s) { return String(s || "").toLocaleLowerCase("tr-TR"); }
  function bosluk(s) { return String(s || "").replace(/\s+/g, " ").trim(); }

  function baslikDuzeni(s, dil) {
    var kucuk = { "ve": 1, "ile": 1, "ya": 1, "da": 1, "de": 1, "veya": 1, "ki": 1, "and": 1, "of": 1, "the": 1, "in": 1, "&": 1 };
    var loc = dil === "en" ? "en-US" : "tr-TR";
    return bosluk(String(s || "").replace(/\s*&\s*/g, " & ")).split(" ").map(function (w, i) {
      if (/^\(?[IVXLC]+\.?\)?$/.test(w)) return w; // Romen rakamı
      var lw = w.toLocaleLowerCase(loc);
      if (i > 0 && kucuk[lw]) return lw;
      // Kelimenin ve tire/eğik çizgi sonrası parçaların ilk harfi büyük; kesme işaretinden sonrası küçük (İslam’da)
      var out = "", buyut = true;
      for (var k = 0; k < lw.length; k++) {
        var c = lw.charAt(k);
        if (/[A-Za-zÇĞİÖŞÜçğıöşüâîûÂÎÛ]/.test(c)) {
          out += buyut ? c.toLocaleUpperCase(loc) : c;
          buyut = false;
        } else {
          out += c;
          if (c === "-" || c === "/" || c === "“" || c === "\"") buyut = true;
        }
      }
      return out;
    }).join(" ");
  }

  function ilkHarfBuyuk(s) {
    s = String(s || "");
    return s ? s.charAt(0).toLocaleUpperCase("tr-TR") + s.slice(1) : s;
  }

  function ozelAdMi(kelime) {
    if (!kelime) return false;
    if (/[’']/.test(kelime)) return true; // Türkçede kesme işareti yalnız özel adlarda
    if (/^[A-ZÇĞİÖŞÜ]{2,}/.test(kelime) && kelime.length <= 6) return true; // kısaltma
    for (var i = 0; i < OZEL_AD_BASLARI.length; i++) {
      if (kelime.indexOf(OZEL_AD_BASLARI[i].split(" ")[0]) === 0) return true;
    }
    return false;
  }

  function ilkHarfKucuk(s) {
    s = String(s || "").trim();
    if (!s) return s;
    var kelimeler = s.split(/\s+/), ilk = kelimeler[0];
    if (ozelAdMi(ilk)) return s;
    // "Fatır suresi", "Kosova Savaşı", "Karlofça Antlaşması" gibi özel ad tamlamaları
    if (/^(suresi|sûresi|ayeti|ayetleri|Savaşı|Muharebesi|Antlaşması|Devleti|Beyliği|Hanlığı|İmparatorluğu|Kongresi|Cemiyeti|Fethi|Kuşatması|Ayaklanması|Fermanı|Kanunu|Bildirisi)$/.test(kelimeler[1] || "")) return s;
    // İkinci kelime de büyük harfle başlıyorsa (ör. "Mohaç Meydan Muharebesi", "Orta Asya") özel ad kabul et
    if (/^[A-ZÇĞİÖŞÜÂÎÛ][a-zçğıöşüâîû]/.test(kelimeler[1] || "") && /^[A-ZÇĞİÖŞÜÂÎÛ]/.test(ilk)) return s;
    return s.charAt(0).toLocaleLowerCase("tr-TR") + s.slice(1);
  }

  function cumleSonu(s) {
    s = bosluk(s).replace(/[;,:]+$/, "");
    if (!s) return s;
    if (!/[.!?…)]$/.test(s)) s += ".";
    return s;
  }

  function sonSesli(s) {
    for (var i = s.length - 1; i >= 0; i--) if (SESLI.indexOf(s[i]) >= 0) return s[i];
    return "e";
  }
  function heceSayisi(s) {
    var n = 0;
    for (var i = 0; i < s.length; i++) if (SESLI.indexOf(s[i]) >= 0) n++;
    return n;
  }
  function genisZamanEki(kok) {
    var son = kok.slice(-1);
    if (SESLI.indexOf(son) >= 0) return "r";
    var v = sonSesli(kok);
    var genis = function () { // -ar/-er
      return KALIN.indexOf(v) >= 0 ? "ar" : "er";
    };
    var dar = function () { // -ır/-ir/-ur/-ür
      if ("aıâ".indexOf(v) >= 0) return "ır";
      if ("ei î".indexOf(v) >= 0) return "ir";
      if ("ouû".indexOf(v) >= 0) return "ur";
      return "ür";
    };
    if (heceSayisi(kok) <= 1) return ISTISNA_IR.indexOf(kok) >= 0 ? dar() : genis();
    return dar();
  }

  function fiilCekimle(kelime) {
    // "yönetebilme" -> "yönetir", "açıklayabilme" -> "açıklar", "edebilme" -> "eder"
    var m = kelime.match(/^([A-Za-zÇĞİÖŞÜçğıöşüâîû]+?)(ebilme|abilme)$/);
    if (!m) return null;
    var kok = m[1];
    if (/[aeıioöuüâîû]y$/.test(kok)) kok = kok.slice(0, -1); // kaynaştırma y'si
    if (/ed$/.test(kok)) return kok + "er"; // et- > ed-er (ifade eder, keşfeder, hisseder)
    if (kok === "gid" || kok === "güd") return kok + "er";
    if (kok === "tad") return "tadar";
    return kok + genisZamanEki(kok);
  }

  /** "…metinlerde okumayı yönetebilme" -> "…metinlerde okumayı yönetir" (geniş zaman, 3. tekil) */
  function yeterliliktenGenisZamana(ifade) {
    var s = bosluk(ifade).replace(/[.;:]+$/, "");
    if (!/(ebilme|abilme)$/.test(s)) return null;
    // Bağlaçla sıralanan tüm "-ebilme" fiillerini çekimle (", ", " ve ", " ya da ")
    return s.replace(/([A-Za-zÇĞİÖŞÜçğıöşüâîû]+(?:ebilme|abilme))(?=$|,|\s+ve\s|\s+ya da\s|\s+veya\s)/g, function (w) {
      return fiilCekimle(w) || w;
    });
  }

  function adSoyadAyir(ad) {
    var p = bosluk(ad).split(" ");
    if (p.length <= 1) return { ad: p[0] || "", soyad: "" };
    return { ad: p.slice(0, -1).join(" "), soyad: p[p.length - 1] };
  }
  function ilkAd(adSoyad) {
    var a = bosluk(adSoyad).split(" ")[0] || "";
    return a ? baslikDuzeni(a) : "";
  }
  function adSoyadBicim(adSoyad) {
    // "Deniz Örnekoğlu" -> "Deniz ÖRNEKOĞLU"
    var x = adSoyadAyir(adSoyad);
    if (!x.soyad) return baslikDuzeni(x.ad);
    return baslikDuzeni(x.ad) + " " + up(x.soyad);
  }
  function dosyaAdi(s) {
    var tablo = { "ç": "c", "Ç": "C", "ğ": "g", "Ğ": "G", "ı": "i", "İ": "I", "ö": "o", "Ö": "O", "ş": "s", "Ş": "S", "ü": "u", "Ü": "U", "â": "a", "î": "i", "û": "u" };
    return String(s || "").replace(/[çÇğĞıİöÖşŞüÜâîû]/g, function (c) { return tablo[c]; })
      .replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  }
  function kisalt(s, n) {
    s = bosluk(s);
    if (s.length <= n) return s;
    var k = s.slice(0, n);
    var i = k.lastIndexOf(" ");
    return (i > n * 0.6 ? k.slice(0, i) : k).replace(/[,;:\-–]+$/, "") + "…";
  }

  BEP.tr = {
    up: up, low: low, bosluk: bosluk, baslikDuzeni: baslikDuzeni, ilkHarfBuyuk: ilkHarfBuyuk,
    ilkHarfKucuk: ilkHarfKucuk, cumleSonu: cumleSonu, yeterliliktenGenisZamana: yeterliliktenGenisZamana,
    ilkAd: ilkAd, adSoyadBicim: adSoyadBicim, dosyaAdi: dosyaAdi, kisalt: kisalt, ozelAdMi: ozelAdMi
  };

  /* ======================================================================
   * Destek düzeyi ve ölçüt seçenekleri (ORGM 2022: KDA = birey + koşul + davranış + ölçüt)
   * ==================================================================== */
  BEP.DESTEK_DUZEYLERI = [
    { id: "yogun", ad: "Yoğun destek", aciklama: "Model olma, aşamalı yardım ve somut materyalle; amaçlar temel düzeyde sadeleştirilir." },
    { id: "orta", ad: "Orta düzey destek", aciklama: "Görsel ipucu, yönlendirici soru ve sadeleştirilmiş materyalle." },
    { id: "hafif", ad: "Hafif destek", aciklama: "Kısa ipucu ve ek süreyle; amaçlar sınıf düzeyine yakın tutulur." }
  ];
  BEP.OLCUTLER = [
    { id: "80", metin: "%80 – 4/5", ad: "%80 (5 denemenin 4’ünde)" },
    { id: "75", metin: "%75 – 3/4", ad: "%75 (4 denemenin 3’ünde)" },
    { id: "70", metin: "%70 – 7/10", ad: "%70 (10 denemenin 7’sinde)" },
    { id: "60", metin: "%60 – 3/5", ad: "%60 (5 denemenin 3’ünde)" },
    { id: "100", metin: "%100 – 5/5", ad: "%100 (5 denemenin tamamında)" },
    { id: "yok", metin: "", ad: "KDA metnine ölçüt ekleme" }
  ];

  /* ======================================================================
   * Yetersizlik türleri (e-Okul özel eğitim listesindeki adlandırmalar esas alınmıştır)
   * ==================================================================== */
  var ORTAK_SINAV_BASI = {
    baslik: "Yasal Dayanak ve Değerlendirme Esası",
    aciklama: "Öğrencinin başarısı sınıfın genel ölçütlerine göre değil, BEP’inde yer alan uzun ve kısa dönemli amaçlara göre değerlendirilecektir (Özel Eğitim Hizmetleri Yönetmeliği Md. 24/1-a; Ortaöğretim Kurumları Yönetmeliği Md. 43/1-g ve 45/1-ğ)."
  };
  var AYRI_SINAV = {
    baslik: "Ayrı BEP Sınavı Hazırlanması",
    aciklama: "Yazılı sınavlarda öğrenciye BEP amaçlarına göre hazırlanmış, uyarlanmış sınav kâğıdı uygulanacak; soru-cevap anahtarı bu amaçlar dikkate alınarak hazırlanacaktır."
  };

  BEP.YETERSIZLIKLER = [
    {
      id: "zihinsel_hafif", ad: "Hafif Düzeyde Zihinsel Yetersizlik", kisa: "hafif düzeyde zihinsel yetersizlik",
      varsayilanDestek: "orta", yabanciDilMuafiyeti: true,
      davranis: "Sınıf içinde belirgin bir davranış problemi gözlenmemektedir; uzun süren ve soyut içerikli etkinliklerde dikkat dağınıklığı ve görevden kopma görülebilmektedir.",
      kosul: {
        yogun: ["öğretmen model olduğunda", "somut materyallerle desteklendiğinde", "aşamalı yardım verildiğinde"],
        orta: ["görsel ipuçlarıyla desteklendiğinde", "yönlendirici sorular sorulduğunda", "sadeleştirilmiş materyal verildiğinde", "örnek bir uygulamayı inceledikten sonra"],
        hafif: ["kısa bir ipucu verildiğinde", "örneği inceledikten sonra", "ek süre tanındığında"]
      },
      yontem: ["Doğrudan Öğretim", "Aşamalı Yardımla Öğretim", "Model Olma", "Gösterip Yaptırma", "Somutlaştırma", "Tekrar ve Pekiştirme", "Akran Desteği"],
      materyal: ["Somut Materyaller", "Resimli Kartlar", "Sade Çalışma Kâğıdı", "Görsel Şema"],
      gelisim: [
        "{ad}, okul ve sınıf kurallarına uyan, öğretmen ve arkadaşlarıyla olumlu iletişim kuran bir öğrencidir.",
        "Soyut kavramları anlamada ve çok basamaklı yönergeleri takip etmede desteğe ihtiyaç duymaktadır.",
        "Somut, görsel ve günlük yaşamla ilişkilendirilen içerikleri daha kolay kavramakta ve akılda tutmaktadır.",
        "Dikkat süresi kısa olup uzun etkinliklerde görevlerin bölünmesi ve kısa aralar verilmesi verimini artırmaktadır.",
        "Başarılı olduğu durumlarda sözel pekiştirece olumlu tepki vermekte, motivasyonu belirgin biçimde artmaktadır."
      ],
      guclu: [
        "Okula devam ve ders araç-gereçlerini getirme konusunda sorumluluk sahibidir.",
        "Görsel materyallerden (resimli kartlar, kavram şemaları, akıllı tahta uygulamaları) yüksek verim almaktadır.",
        "Akranlarıyla iş birliğine açıktır; grup çalışmalarında kendisine verilen görevi yerine getirmeye gayret gösterir.",
        "Tekrar ve pekiştirme ile öğrendiği bilgileri kalıcı hâle getirebilmektedir."
      ],
      destek: [
        "Soyut kavramları anlama ve uzun metinlerdeki örtük anlamları çıkarma.",
        "Çok basamaklı görevleri/problemleri bağımsız olarak tamamlama.",
        "Öğrendiklerini sözlü ve yazılı olarak düzenli biçimde ifade etme.",
        "Ders süresince dikkatini sürdürme ve görevi zamanında tamamlama."
      ],
      sinif: [
        { baslik: "Fiziksel Düzen ve Oturma Yeri", aciklama: "Tahtayı ve öğretmeni doğrudan görebileceği ön-orta sıraya oturtulacak; kapı/pencere gibi dikkat dağıtıcı yerlerden uzak tutulacaktır. Yanına destekleyici ve anlayışlı bir akran yerleştirilecektir." },
        { baslik: "Öğretim Süreci ve Yöntemler", aciklama: "Somuttan soyuta, basitten karmaşığa ilkesi benimsenecektir. Yönergeler kısa, açık ve basamaklandırılarak verilecek; görev tamamlandıkça yeni adıma geçilecektir." },
        { baslik: "Ders Materyali ve İçerik", aciklama: "Ağır dilli metinler sadeleştirilecek, çalışma kâğıtları 12-14 punto büyüklüğünde ve ferah aralıklı hazırlanacaktır. Akıllı tahta, resimli şemalar ve somut materyaller sık kullanılacaktır." },
        { baslik: "Akran Desteği ve Motivasyon", aciklama: "İkili çalışmalarda sabırlı akranlarla eşleştirilecek; küçük başarıları dahi anında sözel övgüyle pekiştirilerek derse katılım motivasyonu korunacaktır." },
        { baslik: "Zaman ve Ödev Düzenlemesi", aciklama: "Sınıf içi etkinliklerde ve ödev teslimlerinde öğrencinin hızına uygun ek süre tanınacak; ödevler kısa ve parçalara bölünmüş olarak verilecektir." }
      ],
      sinav: [
        ORTAK_SINAV_BASI, AYRI_SINAV,
        { baslik: "Soru Tipi, Sayısı ve Zorluk", aciklama: "Soru sayısı 5-8 ile sınırlandırılacaktır. Uzun cevaplı ve soyut sorular yerine çoktan seçmeli (3 seçenekli), doğru-yanlış, eşleştirme ve boşluk doldurma soruları kullanılacaktır." },
        { baslik: "Sınav Süresi ve Ortamı", aciklama: "Sınav süresinde %25-%50 oranında ek süre tanınacak; gerektiğinde dikkat dağıtıcı uyaranlardan arındırılmış ayrı bir ortam sağlanacaktır." },
        { baslik: "Format ve Okuma Desteği", aciklama: "Sınav kâğıdı 12-14 punto, ferah aralıklı ve görsellerle desteklenmiş olarak hazırlanacak; anlaşılmayan soru kökleri öğretmen tarafından sesli okunup açıklanabilecektir." }
      ]
    },
    {
      id: "zihinsel_orta", ad: "Orta Düzeyde Zihinsel Yetersizlik", kisa: "orta düzeyde zihinsel yetersizlik",
      varsayilanDestek: "yogun", yabanciDilMuafiyeti: true,
      davranis: "Belirgin bir davranış problemi gözlenmemektedir; rutin değişikliklerinde ve zorlandığı görevlerde yetişkin desteğine ihtiyaç duyabilmektedir.",
      kosul: {
        yogun: ["öğretmen model olduğunda", "sözel ve fiziksel ipucu verildiğinde", "somut nesneler kullanıldığında"],
        orta: ["resimli kartlarla desteklendiğinde", "sözel ipucu verildiğinde", "modeli izledikten sonra"],
        hafif: ["görsel ipucu verildiğinde", "kısa bir sözel hatırlatma yapıldığında"]
      },
      yontem: ["Aşamalı Yardımla Öğretim", "Eş Zamanlı İpucuyla Öğretim", "Model Olma", "Gösterip Yaptırma", "Somut Materyalle Öğretim", "Tekrar ve Pekiştirme"],
      materyal: ["Somut Nesneler", "Resimli Kartlar", "Görsel Program", "Uyarlanmış Çalışma Kâğıdı"],
      gelisim: [
        "{ad}, kendisine yöneltilen kısa ve tek basamaklı yönergeleri yerine getirebilmektedir.",
        "Temel kavramları somut nesneler ve resimlerle öğrenmekte; soyut içeriklerde yoğun desteğe ihtiyaç duymaktadır.",
        "Günlük yaşam becerileriyle ilişkilendirilen etkinliklere istekli katılmaktadır.",
        "Sosyal ortamlarda yetişkin ve akran desteğiyle uyum sağlayabilmektedir."
      ],
      guclu: [
        "Rutin ve kurallara uyma konusunda istekli ve düzenlidir.",
        "Somut ve uygulamalı etkinliklerde başarılı olmaktadır.",
        "Övgü ve küçük ödüllerle motivasyonu belirgin biçimde artmaktadır."
      ],
      destek: [
        "Temel akademik becerileri (okuma-yazma, dört işlem) işlevsel düzeyde kullanma.",
        "Öğrendiği becerileri farklı ortamlara genelleme.",
        "İletişim ve kendini ifade etme becerileri."
      ],
      sinif: [
        { baslik: "Fiziksel Düzen ve Oturma Yeri", aciklama: "Öğretmene yakın, dikkat dağıtıcı uyaranlardan uzak bir sıraya oturtulacak; çalışma alanı sade tutulacaktır." },
        { baslik: "Öğretim Süreci ve Yöntemler", aciklama: "Amaçlar işlevsel ve günlük yaşamla ilişkili seçilecek; aşamalı yardımla öğretim ve model olma teknikleri kullanılarak beceriler küçük adımlara bölünecektir." },
        { baslik: "Ders Materyali ve İçerik", aciklama: "Somut nesneler, resimli kartlar ve görsel program kullanılacak; çalışma kâğıtları büyük puntolu, az maddeli ve görselli hazırlanacaktır." },
        { baslik: "Akran Desteği ve Motivasyon", aciklama: "Akran rehberliğiyle grup etkinliklerine katılımı sağlanacak; her doğru davranışı anında sözel ve sembolik pekiştireçlerle ödüllendirilecektir." },
        { baslik: "Destek Eğitim Koordinasyonu", aciklama: "Destek eğitim odası öğretmeniyle iş birliği yapılarak sınıf içi amaçlar destek eğitim odasında pekiştirilecektir." }
      ],
      sinav: [
        ORTAK_SINAV_BASI, AYRI_SINAV,
        { baslik: "Soru Tipi ve Sayısı", aciklama: "Değerlendirme az sayıda (3-5) resimli eşleştirme, işaretleme ve doğru-yanlış sorusuyla ya da gözleme dayalı performans görevleriyle yapılacaktır." },
        { baslik: "Sınav Süresi ve Ortamı", aciklama: "Sınav ayrı ve sakin bir ortamda, bire bir uygulanabilecek; öğrencinin ihtiyacına göre süre esnek tutulacaktır." },
        { baslik: "Okuma ve Yanıt Desteği", aciklama: "Sorular öğretmen tarafından okunacak; öğrencinin sözlü, işaretleyerek veya göstererek yanıt vermesine izin verilecektir." }
      ]
    },
    {
      id: "oog", ad: "Özel Öğrenme Güçlüğü", kisa: "özel öğrenme güçlüğü",
      varsayilanDestek: "hafif",
      davranis: "Belirgin bir davranış problemi gözlenmemektedir; yoğun okuma-yazma gerektiren görevlerde kaçınma, kaygı ve isteksizlik görülebilmektedir.",
      kosul: {
        yogun: ["metin sesli okunduğunda", "adımları gösteren yönerge kartıyla", "çok duyulu materyallerle desteklendiğinde"],
        orta: ["metin sesli okunarak desteklendiğinde", "görsel şema verildiğinde", "büyük puntolu metin kullanıldığında", "işlem adımlarını gösteren kartla"],
        hafif: ["ek süre tanındığında", "yönerge sözlü olarak da verildiğinde", "strateji kartı verildiğinde"]
      },
      yontem: ["Çok Duyulu Öğretim", "Kavram Haritası", "Hatırlatıcı Stratejiler", "Görev Analizi", "Bilgisayar Destekli Öğretim", "Doğrudan Öğretim"],
      materyal: ["Renk Kodlu Çalışma Kâğıdı", "Strateji / Formül Kartı", "Büyük Puntolu Materyal", "Okuma Cetveli"],
      gelisim: [
        "{ad}, zihinsel kapasite bakımından yaşıtlarıyla benzer olup okuma, yazma ve/veya matematiksel işlemlerde akranlarının gerisinde performans göstermektedir.",
        "Sesli okumada hece/harf atlama ve akıcılık sorunları; yazılı anlatımda harf karıştırma ve yazım hataları gözlenmektedir.",
        "Sözlü anlatımı ve sınıf içi tartışmalara katılımı yazılı anlatımına göre daha güçlüdür.",
        "Uzun yazılı yönergeleri takip etmekte zorlanmakta; sözlü ve görsel desteklerle daha başarılı olmaktadır.",
        "Başarısızlık yaşadığı durumlarda kaygı ve özgüven düşüklüğü gözlenebilmektedir."
      ],
      guclu: [
        "Sözlü ifade becerisi gelişmiştir; ders içi tartışmalara istekli katılır.",
        "Görsel-mekânsal düşünme, şekil ve şemaları yorumlama becerisi güçlüdür.",
        "Dinleyerek öğrenmede başarılıdır; anlatılanları akılda tutabilir.",
        "Yaratıcı fikirler üretebilmekte ve uygulamalı etkinliklerde başarılı olmaktadır."
      ],
      destek: [
        "Okuma akıcılığı ve okuduğunu anlama.",
        "Yazılı anlatımda yazım-noktalama kurallarına uyma ve düşüncelerini düzenli aktarma.",
        "İşlem adımlarını doğru sırayla uygulama ve işlem hatalarını kontrol etme.",
        "Not tutma, zamanı yönetme ve ödevleri planlama."
      ],
      sinif: [
        { baslik: "Fiziksel Düzen ve Oturma Yeri", aciklama: "Tahtayı rahat görebileceği ön sıralara oturtulacak; tahtadan uzun metin yazdırılmayacak, ders notları fotokopi veya dijital olarak verilecektir." },
        { baslik: "Yönerge ve Öğretim Süreci", aciklama: "Yazılı yönergeler sözlü olarak da tekrar edilecek; yeni bilgiler çok duyulu (görsel-işitsel-dokunsal) yollarla, kavram haritaları ve örneklerle sunulacaktır." },
        { baslik: "Ders Materyali ve İçerik", aciklama: "Metinler büyük punto, geniş satır aralığı ve sade yazı tipiyle hazırlanacak; okuma cetveli, renk kodlu notlar ve sesli materyaller kullanılacaktır." },
        { baslik: "Teknoloji ve Araç Desteği", aciklama: "Uygun derslerde hesap makinesi, formül kartı, sesli okuma/yazım denetimi gibi yardımcı araçların kullanımına izin verilecektir." },
        { baslik: "Motivasyon ve Geri Bildirim", aciklama: "Hatalar düzeltilirken olumlu ve yapıcı geri bildirim verilecek; güçlü yönlerini gösterebileceği sözlü ve görsel görevlerle özgüveni desteklenecektir." }
      ],
      sinav: [
        ORTAK_SINAV_BASI,
        { baslik: "Okuyucu Desteği", aciklama: "İhtiyaç duyduğunda sınav soruları öğretmen tarafından sesli okunacak; uzun soru kökleri sadeleştirilecektir." },
        { baslik: "Sınav Süresi", aciklama: "Yazılı sınavlarda standart sürenin %25-%50’si oranında ek süre tanınacaktır." },
        { baslik: "Yazım ve İmla Toleransı", aciklama: "Ölçülen kazanım yazım-noktalama değilse yazım ve imla hataları nedeniyle puan kırılmayacaktır." },
        { baslik: "Format ve Soru Düzeni", aciklama: "Sorular büyük puntolu, her sayfada az soru olacak biçimde ve görsellerle desteklenerek hazırlanacak; gerektiğinde sözlü yanıt seçeneği sunulacaktır." }
      ]
    },
    {
      id: "dehb", ad: "Dikkat Eksikliği ve Hiperaktivite Bozukluğu", kisa: "dikkat eksikliği ve hiperaktivite bozukluğu",
      varsayilanDestek: "hafif",
      davranis: "Sırasını beklemede, ders süresince oturarak çalışmayı sürdürmede ve yönergeleri tamamlamadan göreve başlamamada güçlük yaşamaktadır; söz kesme ve dürtüsel tepkiler zaman zaman gözlenmektedir.", davranisSorunu: true,
      kosul: {
        yogun: ["görev kısa adımlara bölündüğünde", "öğretmenin yakın gözetiminde", "tek basamaklı yönergeler verildiğinde"],
        orta: ["görev kısa adımlara bölündüğünde", "kontrol listesi kullanıldığında", "tek basamaklı yönerge verildiğinde"],
        hafif: ["kısa molalarla desteklendiğinde", "kontrol listesi kullanıldığında", "yönergeyi tekrar ettikten sonra"]
      },
      yontem: ["Görev Analizi", "Yapılandırılmış Kısa Görevler", "Oyunlaştırma", "Anında Geri Bildirim", "Olumlu Davranış Desteği", "Akran Eşleştirme"],
      materyal: ["Zamanlayıcı", "Görev Kontrol Listesi", "Renkli Kodlama", "Kısa Çalışma Kartları"],
      gelisim: [
        "{ad}, dikkatini uzun süre aynı göreve yöneltmekte zorlanmakta, dış uyaranlardan kolayca etkilenmektedir.",
        "Kısa süreli, hareket içeren ve somut etkinliklerde daha başarılıdır.",
        "Yönergeleri tamamlamadan göreve başlama ve sırasını beklemede güçlük gibi dürtüsel davranışlar zaman zaman gözlenmektedir.",
        "Anında geri bildirim ve olumlu pekiştirme ile görev tamamlama oranı artmaktadır."
      ],
      guclu: [
        "Enerjik, meraklı ve yeni etkinliklere isteklidir.",
        "Uygulamalı ve hareketli etkinliklere aktif katılım gösterir.",
        "Sözlü tartışmalarda özgün fikirler ortaya koyar.",
        "Teknoloji ve görsel içeriklere ilgisi yüksektir."
      ],
      destek: [
        "Dikkatini sürdürme ve başladığı görevi tamamlama.",
        "Planlama, organizasyon ve zaman yönetimi.",
        "Sırasını bekleme ve dürtülerini kontrol etme.",
        "Ödev ve ders materyallerini takip etme."
      ],
      sinif: [
        { baslik: "Fiziksel Düzen ve Oturma Yeri", aciklama: "Öğretmene yakın, kapı ve pencereden uzak bir sıraya, model olabilecek sakin bir akranın yanına oturtulacaktır." },
        { baslik: "Görev Yapısı ve Yönergeler", aciklama: "Görevler kısa parçalara bölünecek; yönergeler göz teması kurularak, tek seferde tek yönerge olacak biçimde verilecek ve öğrenciye tekrar ettirilecektir." },
        { baslik: "Hareket ve Mola İhtiyacı", aciklama: "Uzun etkinliklerde kısa molalar verilecek; materyal dağıtma, tahta silme gibi kontrollü hareket fırsatları sunulacaktır." },
        { baslik: "Organizasyon Desteği", aciklama: "Görev kontrol listesi, zamanlayıcı ve renk kodlu dosyalama kullanılacak; ödevler ajandaya yazdırılarak takip edilecektir." },
        { baslik: "Olumlu Davranış Desteği", aciklama: "Beklenen davranışlar açıkça tanımlanacak, olumlu davranışlar anında pekiştirilecek; gerektiğinde davranış sözleşmesi uygulanacaktır." }
      ],
      sinav: [
        ORTAK_SINAV_BASI,
        { baslik: "Sınav Ortamı", aciklama: "Gerektiğinde sınav, dikkat dağıtıcı uyaranlardan arındırılmış ayrı ve sessiz bir ortamda uygulanacaktır." },
        { baslik: "Sınav Süresi ve Mola", aciklama: "Standart sürenin %25-%50’si oranında ek süre tanınacak; uzun sınavlarda kısa molaya izin verilecektir." },
        { baslik: "Soru Düzeni", aciklama: "Sorular bölümlere ayrılacak, her sayfada az soru bulunacak; yönergelerdeki anahtar kelimeler kalın yazılarak vurgulanacaktır." },
        { baslik: "Kontrol Hatırlatması", aciklama: "Sınav sonunda yanıtlarını kontrol etmesi için sözlü hatırlatma yapılacaktır." }
      ]
    },
    {
      id: "otizm", ad: "Otizm Spektrum Bozukluğu", kisa: "otizm spektrum bozukluğu",
      varsayilanDestek: "orta", yabanciDilMuafiyeti: true,
      davranis: "Rutin değişikliklerinde, beklenmedik durumlarda ve yoğun duyusal uyaranlarda (gürültü, kalabalık) kaygı ve uyum güçlüğü gösterebilmektedir; önceden bilgilendirildiğinde uyumu artmaktadır.", davranisSorunu: true,
      kosul: {
        yogun: ["görsel yönerge ve model sunulduğunda", "adımlar görsel olarak sıralandığında", "bire bir yapılandırılmış çalışmada"],
        orta: ["görsel yönerge sunulduğunda", "yapılandırılmış çalışma kâğıdıyla", "adımlar görsel olarak sıralandığında"],
        hafif: ["yazılı yönerge verildiğinde", "değişiklikler önceden bildirildiğinde"]
      },
      yontem: ["Yapılandırılmış Öğretim", "Görsel Destekler", "Video Model", "Sosyal Öykü", "Doğrudan Öğretim", "Akran Aracılı Öğretim"],
      materyal: ["Görsel Program / Kartlar", "Video Model", "Yapılandırılmış Föy", "Sosyal Öykü"],
      gelisim: [
        "{ad}, sosyal etkileşim ve iletişimde (göz teması, sırayla konuşma, mecazları anlama) desteğe ihtiyaç duymaktadır.",
        "Rutinlerin değişmesi ve beklenmedik durumlar kaygısını artırabilmektedir.",
        "Görsel ve yapılandırılmış biçimde sunulan bilgileri daha kolay işlemektedir.",
        "İlgi duyduğu konularda ayrıntılı bilgiye sahiptir; bu ilgiler öğrenmede motivasyon aracı olarak kullanılabilir.",
        "Bazı duyusal uyaranlara (gürültü, kalabalık) karşı hassasiyet gösterebilmektedir."
      ],
      guclu: [
        "Kurallara ve rutinlere uyum gösterir.",
        "Görsel hafızası ve ayrıntıya dikkati güçlüdür.",
        "İlgi alanlarında derin bilgi sahibidir.",
        "Yapılandırılmış görevleri titizlikle tamamlar."
      ],
      destek: [
        "Grup çalışmalarında sosyal etkileşim ve iş birliği.",
        "Mecaz ve soyut ifadeleri anlama.",
        "Plan ve rutin değişikliklerine uyum sağlama.",
        "Duygularını uygun yollarla ifade etme."
      ],
      sinif: [
        { baslik: "Yapılandırılmış Ortam", aciklama: "Ders akışı görsel program ile sunulacak; plan ve ortam değişiklikleri önceden bildirilecektir." },
        { baslik: "Fiziksel Düzen ve Oturma Yeri", aciklama: "Sabit, sakin ve dikkat dağıtıcı uyaranlardan uzak bir oturma yeri belirlenecek; gerektiğinde kısa sakinleşme molası verilecektir." },
        { baslik: "Yönerge ve İletişim", aciklama: "Yönergeler kısa, somut ve görsel destekli verilecek; mecaz ve kinayeli ifadelerden kaçınılacaktır." },
        { baslik: "Sosyal Beceri Desteği", aciklama: "Akran rehberliği ve sosyal öykülerle grup çalışmalarına katılımı desteklenecek; roller açıkça tanımlanacaktır." },
        { baslik: "Motivasyon", aciklama: "İlgi alanlarıyla ilişkilendirilmiş etkinlikler ve somut pekiştireçler kullanılacaktır." }
      ],
      sinav: [
        ORTAK_SINAV_BASI,
        { baslik: "Sınav Ortamı", aciklama: "Sınav sakin ve tanıdık bir ortamda uygulanacak; sınav tarihi ve düzeni önceden görsel olarak bildirilecektir." },
        { baslik: "Soru Biçimi", aciklama: "Sorular açık, somut ve görsel destekli olacak; mecazlı ifadeler ve çok aşamalı soru kökleri kullanılmayacaktır." },
        { baslik: "Sınav Süresi", aciklama: "Standart sürenin %25-%50’si oranında ek süre tanınacaktır." },
        { baslik: "Yanıt Biçimi", aciklama: "Gerektiğinde işaretleme, eşleştirme ve kısa yanıt gibi alternatif yanıt biçimleri kullanılacaktır." }
      ]
    },
    {
      id: "isitme", ad: "İşitme Yetersizliği", kisa: "işitme yetersizliği",
      varsayilanDestek: "orta", yabanciDilMuafiyeti: true,
      davranis: "Belirgin bir davranış problemi gözlenmemektedir; iletişimin kesildiği ya da konuşmayı takip edemediği durumlarda etkinlikten uzaklaşma görülebilmektedir.",
      kosul: {
        yogun: ["görsel ve yazılı destek sağlandığında", "bire bir çalışmada yazılı yönerge verildiğinde"],
        orta: ["görsel ve yazılı destek sağlandığında", "yazılı yönerge verildiğinde", "anahtar kelimeler tahtaya yazıldığında"],
        hafif: ["yazılı yönerge verildiğinde", "altyazılı içerik kullanıldığında"]
      },
      yontem: ["Görsel Destekli Anlatım", "Gösterip Yaptırma", "Yazılı Yönergeler", "Kavram Haritası", "Akran Desteği"],
      materyal: ["Altyazılı Video", "Görsel Kartlar", "Yazılı Yönerge Kartı", "FM Sistemi (varsa)"],
      gelisim: [
        "{ad}, konuşmacının yüzünü gördüğünde ve ortam gürültüsü az olduğunda iletişimi belirgin biçimde artmaktadır.",
        "Kelime dağarcığı ve dil bilgisi yapılarında akranlarının gerisinde olabilmekte; soyut ifadeleri anlamada desteğe ihtiyaç duymaktadır.",
        "Görsel öğrenme kanalını etkin kullanmaktadır.",
        "İşitme cihazını/koklear implantını düzenli kullanmaktadır (varsa)."
      ],
      guclu: [
        "Görsel dikkati ve gözlem becerisi güçlüdür.",
        "Yazılı ve görsel materyallerle etkili öğrenir.",
        "Uygulamalı etkinliklerde başarılıdır.",
        "Akranlarıyla olumlu ilişkiler kurar."
      ],
      destek: [
        "Sözel yönergeleri ve dinleme metinlerini anlama.",
        "Kelime dağarcığını geliştirme.",
        "Sözlü ifade ve telaffuz.",
        "Grup tartışmalarını takip etme."
      ],
      sinif: [
        { baslik: "Fiziksel Düzen ve Oturma Yeri", aciklama: "Öğretmenin yüzünü ve tahtayı net görebileceği, gürültü kaynaklarından uzak ön sıraya oturtulacak; ışık kaynağı öğretmenin arkasında olmayacaktır." },
        { baslik: "İletişim Düzenlemesi", aciklama: "Öğretmen yüzü öğrenciye dönük, doğal hızda ve açık konuşacak; önemli bilgiler ve ödevler tahtaya yazılacaktır." },
        { baslik: "Ders Materyali ve İçerik", aciklama: "Videolar altyazılı kullanılacak; anlatımlar görsel ve yazılı materyallerle desteklenecektir." },
        { baslik: "Cihaz ve Teknoloji", aciklama: "İşitme cihazının/FM sisteminin derslerde çalışır durumda olması takip edilecektir." },
        { baslik: "Akran Desteği", aciklama: "Not paylaşımı ve grup çalışmalarında akran desteği sağlanacak; sınıf içi tartışmalarda konuşan kişi gösterilecektir." }
      ],
      sinav: [
        ORTAK_SINAV_BASI,
        { baslik: "Yönerge Düzenlemesi", aciklama: "Sınav yönergeleri ve açıklamalar yazılı olarak verilecektir." },
        { baslik: "Dinleme Bölümleri", aciklama: "Dinleme becerisini ölçen bölümler yazılı metin/altyazı ile uyarlanacak ya da BEP geliştirme birimi kararıyla eşdeğer etkinlikle değiştirilecektir." },
        { baslik: "Sınav Süresi", aciklama: "Gerektiğinde %25 oranında ek süre tanınacaktır." },
        { baslik: "Dil Düzeyi", aciklama: "Soru kökleri sade ve kısa cümlelerle yazılacak; değerlendirmede dil bilgisi hataları ölçülen kazanım dışında ise dikkate alınmayacaktır." }
      ]
    },
    {
      id: "gorme", ad: "Görme Yetersizliği", kisa: "görme yetersizliği",
      varsayilanDestek: "orta",
      davranis: "Belirgin bir davranış problemi gözlenmemektedir; görsel materyale erişemediği etkinliklerde katılımı azalabilmektedir.",
      kosul: {
        yogun: ["kabartma materyal kullanıldığında", "görseller sözel olarak betimlendiğinde"],
        orta: ["büyütülmüş materyal verildiğinde", "görseller sözel olarak betimlendiğinde"],
        hafif: ["büyük puntolu materyal verildiğinde", "ek süre tanındığında"]
      },
      yontem: ["Sözel Betimleme", "Dokunsal/Somut Materyal", "Dinleyerek Öğrenme", "Akran Desteği", "Teknoloji Destekli Öğretim"],
      materyal: ["Büyük Puntolu Metin", "Büyüteç", "Kabartma Şekiller", "Sesli Materyal"],
      gelisim: [
        "{ad}, normal puntolu basılı materyalleri okumakta zorlanmakta, büyütülmüş materyallerle çalışmaktadır.",
        "Tahtadaki yazıları uzaktan takip etmekte güçlük çekmektedir.",
        "Dinleyerek öğrenme ve sözel bellek becerileri güçlüdür.",
        "Okul ortamında bağımsız hareket etmeye uyum sağlamıştır."
      ],
      guclu: ["Dinleyerek öğrenmede başarılıdır.", "Sözel ifadesi güçlüdür.", "Hafızası iyidir.", "Sorumluluk sahibidir."],
      destek: ["Basılı materyallere erişim.", "Grafik, tablo ve şekilleri yorumlama.", "Tahtadan bilgi aktarma.", "Yazma hızı."],
      sinif: [
        { baslik: "Fiziksel Düzen ve Oturma Yeri", aciklama: "Tahtaya yakın, ışığı uygun ve yansımasız bir yere oturtulacak; sınıf düzeni sabit tutulacaktır." },
        { baslik: "Ders Materyali ve İçerik", aciklama: "Materyaller öğrencinin ihtiyacına göre 18-24 punto, yüksek kontrastlı veya kabartma olarak hazırlanacak; dijital erişilebilir metinler sağlanacaktır." },
        { baslik: "Sözel Betimleme", aciklama: "Tahtaya yazılanlar sesli okunacak; resim, grafik ve şekiller sözel olarak betimlenecektir." },
        { baslik: "Teknoloji ve Araç Desteği", aciklama: "Büyüteç, ekran büyütücü veya ekran okuyucu gibi yardımcı teknolojilerin kullanımına izin verilecektir." },
        { baslik: "Akran Desteği", aciklama: "Not paylaşımı ve okul içi hareketlerde akran desteği sağlanacaktır." }
      ],
      sinav: [
        ORTAK_SINAV_BASI,
        { baslik: "Sınav Formatı", aciklama: "Sınav kâğıdı büyütülmüş (18-24 punto) veya kabartma olarak hazırlanacaktır." },
        { baslik: "Görsel İçerikli Sorular", aciklama: "Resim, şekil ve grafik içeren sorular kabartma olarak, betimlenerek veya bu soruların yerine eş değer sorular hazırlanarak değerlendirilecektir (Özel Eğitim Hizmetleri Yönetmeliği Md. 24/1-d)." },
        { baslik: "Sınav Süresi", aciklama: "Standart sürenin %25-%50’si oranında ek süre tanınacaktır." },
        { baslik: "Okuyucu-İşaretleyici Desteği", aciklama: "Gerektiğinde soruların okunması ve yanıtların işaretlenmesi için destek sağlanacaktır." }
      ]
    },
    {
      id: "bedensel", ad: "Bedensel Yetersizlik", kisa: "bedensel yetersizlik",
      varsayilanDestek: "hafif",
      davranis: "Belirgin bir davranış problemi gözlenmemektedir; yorgunluk dönemlerinde etkinliklere katılımı azalabilmektedir.",
      kosul: {
        yogun: ["uyarlanmış araç-gereç sağlandığında", "sözlü yanıt vermesine izin verildiğinde"],
        orta: ["sözlü ya da işaretleyerek yanıt vermesine izin verildiğinde", "erişilebilir materyal sağlandığında"],
        hafif: ["ek süre tanındığında", "uyarlanmış araç-gereç kullanıldığında"]
      },
      yontem: ["Doğrudan Öğretim", "Teknoloji Destekli Öğretim", "Uyarlanmış Uygulama", "Akran Desteği"],
      materyal: ["Bilgisayar / Tablet", "Kalın Kalem Tutacağı", "Eğimli Çalışma Yüzeyi", "Fotokopi Ders Notları"],
      gelisim: [
        "{ad}, ince ve/veya kaba motor becerilerde sınırlılıklar nedeniyle uzun süre yazı yazmada yorgunluk ve hız düşüklüğü yaşamaktadır.",
        "Bilişsel olarak akranlarıyla benzer düzeyde olup uygun düzenlemelerle ders etkinliklerine katılabilmektedir.",
        "Okul içinde ulaşım ve erişimde desteğe ihtiyaç duyabilmektedir."
      ],
      guclu: ["Akademik ilgisi ve merakı yüksektir.", "Sözel ifadesi güçlüdür.", "Sorumluluk sahibidir.", "Teknoloji kullanımında beceriklidir."],
      destek: ["Yazma hızı ve süresi.", "Motor beceri gerektiren uygulamalı etkinliklere katılım.", "Fiziksel erişim.", "Yorgunluk yönetimi."],
      sinif: [
        { baslik: "Fiziksel Erişim ve Oturma Yeri", aciklama: "Sınıf ve ders ortamları erişilebilir olacak; öğrenci kapıya yakın, rahat hareket edebileceği bir yere oturtulacaktır." },
        { baslik: "Yazma Desteği", aciklama: "Ders notları fotokopi/dijital olarak verilecek; bilgisayar, tablet veya kalem tutacağı gibi araçların kullanımına izin verilecektir." },
        { baslik: "Uygulamalı Etkinlikler", aciklama: "Motor beceri gerektiren etkinlikler öğrencinin yapabileceği biçimde uyarlanacak; velinin yazılı talebiyle uygulamalı bölümlerden muafiyet uygulanabilecektir (Md. 24/1-e)." },
        { baslik: "Mola ve Dinlenme", aciklama: "Yorgunluk durumuna göre kısa molalar verilecek ve görev süreleri esnek tutulacaktır." },
        { baslik: "Akran Desteği", aciklama: "Materyal taşıma ve sınıf içi hareketlerde akran desteği sağlanacaktır." }
      ],
      sinav: [
        ORTAK_SINAV_BASI,
        { baslik: "Sınav Süresi", aciklama: "Yazma güçlüğü dikkate alınarak standart sürenin %25-%50’si oranında ek süre tanınacaktır." },
        { baslik: "Yanıt Biçimi", aciklama: "Yazma yerine işaretleme, sözlü yanıt veya bilgisayar kullanımına izin verilecektir." },
        { baslik: "Uygulamalı Sınavlar", aciklama: "Motor beceri gerektiren derslerin uygulamalı bölümlerinden velinin yazılı talebiyle muaf tutulabilecektir (Özel Eğitim Hizmetleri Yönetmeliği Md. 24/1-e)." },
        { baslik: "Sınav Ortamı", aciklama: "Sınav, öğrencinin erişebileceği ve uygun oturma düzeninin sağlandığı bir ortamda yapılacaktır." }
      ]
    },
    {
      id: "dil_konusma", ad: "Dil ve Konuşma Güçlüğü", kisa: "dil ve konuşma güçlüğü",
      varsayilanDestek: "hafif",
      davranis: "Belirgin bir davranış problemi gözlenmemektedir; sözlü katılım gerektiren durumlarda çekingenlik ve kaçınma gösterebilmektedir.",
      kosul: {
        yogun: ["yanıt için yeterli süre tanındığında", "model konuşmayı dinledikten sonra"],
        orta: ["yanıt vermesi için yeterli süre tanındığında", "önceden hazırlanma fırsatı verildiğinde"],
        hafif: ["önceden hazırlanma fırsatı verildiğinde", "küçük grup içinde"]
      },
      yontem: ["Model Olma", "Prova ile Hazırlık", "Küçük Grup Çalışması", "Görsel Destekler"],
      materyal: ["Konuşma Kartları", "Görsel İpucu Kartları", "Ses Kaydı", "Yazılı Destek Notları"],
      gelisim: [
        "{ad}, konuşmasında sesletim ve/veya akıcılık güçlüğü yaşamaktadır.",
        "Sözlü ifade gerektiren durumlarda heyecan ve çekingenlik yaşayabilmektedir.",
        "Yazılı anlatım ve okuduğunu anlama becerileri sözlü anlatımına göre daha güçlüdür."
      ],
      guclu: ["Yazılı ifadesi güçlüdür.", "Dinleme ve anlama becerisi iyidir.", "Görsel materyallerle etkili öğrenir.", "Sorumluluk sahibidir."],
      destek: ["Sözlü ifade ve sunum.", "Sınıf önünde konuşma özgüveni.", "Kelime bulma ve konuşma akıcılığı."],
      sinif: [
        { baslik: "İletişim Ortamı", aciklama: "Öğrencinin konuşmasını tamamlaması için yeterli süre tanınacak, sözü kesilmeyecek; sınıfta alay ve olumsuz tepkilerin önüne geçilecektir." },
        { baslik: "Sözlü Etkinlik Uyarlaması", aciklama: "Sunum ve sözlü etkinlikler önceden hazırlanma fırsatıyla, küçük grupta veya kısa süreli olarak yaptırılacak; gerektiğinde yazılı/görsel alternatif sunulacaktır." },
        { baslik: "Ders Materyali", aciklama: "Konuşma kartları, görsel ipuçları ve model konuşma kayıtları kullanılacaktır." },
        { baslik: "Motivasyon", aciklama: "Konuşma girişimleri olumlu geri bildirimle desteklenecek; güçlü olduğu yazılı ve görsel görevlerle başarı yaşantıları sağlanacaktır." }
      ],
      sinav: [
        ORTAK_SINAV_BASI,
        { baslik: "Sözlü Değerlendirmeler", aciklama: "Sözlü yoklamalar yerine yazılı veya alternatif yanıt biçimleri kullanılabilecek; konuşma becerisi hazırlıklı ve kısa sunumlarla değerlendirilecektir." },
        { baslik: "Süre Esnekliği", aciklama: "Sözlü yanıt gerektiren bölümlerde süre esnek tutulacaktır." }
      ]
    },
    {
      id: "duygusal", ad: "Duygusal ve Davranış Bozukluğu", kisa: "duygusal ve davranış bozukluğu",
      varsayilanDestek: "orta",
      davranis: "Duygularını düzenlemede ve öfkesini uygun yollarla ifade etmede güçlük yaşamaktadır; akran ilişkilerinde zaman zaman çatışma ve kurallara uymama davranışları gözlenmektedir.", davranisSorunu: true,
      kosul: {
        yogun: ["olumlu davranışları pekiştirildiğinde", "kurallar görsel olarak hatırlatıldığında"],
        orta: ["olumlu davranışları pekiştirildiğinde", "kurallar görsel olarak hatırlatıldığında", "kısa molalarla desteklendiğinde"],
        hafif: ["olumlu geri bildirim verildiğinde", "seçim hakkı tanındığında"]
      },
      yontem: ["Olumlu Davranış Desteği", "Davranış Sözleşmesi", "Akran Desteği", "Yapılandırılmış Etkinlikler", "Anında Geri Bildirim"],
      materyal: ["Görsel Sınıf Kuralları", "Davranış Takip Çizelgesi", "Pekiştireç Listesi", "Kısa Görev Kartları"],
      gelisim: [
        "{ad}, duygularını düzenleme ve öfkesini uygun yollarla ifade etmede desteğe ihtiyaç duymaktadır.",
        "Kurallar ve beklentiler net olduğunda ve olumlu davranışları pekiştirildiğinde uyumu artmaktadır.",
        "Akran ilişkilerinde zaman zaman çatışmalar yaşayabilmektedir."
      ],
      guclu: ["Bire bir ilişkide iş birliğine açıktır.", "İlgi duyduğu etkinliklere istekle katılır.", "Sorumluluk verildiğinde başarılı olur."],
      destek: ["Duygu düzenleme.", "Kurallara uyma ve sınıf içi davranış.", "Akranlarla olumlu ilişki kurma."],
      sinif: [
        { baslik: "Sınıf Kuralları ve Beklentiler", aciklama: "Sınıf kuralları görsel olarak asılacak; beklenen davranışlar açık ve olumlu ifadelerle tanımlanacaktır." },
        { baslik: "Olumlu Davranış Desteği", aciklama: "Olumlu davranışlar anında pekiştirilecek; gerektiğinde davranış sözleşmesi ve davranış takip çizelgesi kullanılacaktır." },
        { baslik: "Sakinleşme ve Mola", aciklama: "Öfke/kaygı anlarında önceden belirlenmiş sakinleşme alanı ve kısa mola hakkı tanınacaktır." },
        { baslik: "Oturma Düzeni", aciklama: "Öğretmene yakın ve model olabilecek akranların yanında oturtulacaktır." },
        { baslik: "Aile ile İş Birliği", aciklama: "Davranışlar ve gelişim düzenli olarak aileyle paylaşılacak; okul-ev tutarlılığı sağlanacaktır." }
      ],
      sinav: [
        ORTAK_SINAV_BASI,
        { baslik: "Sınav Ortamı", aciklama: "Gerektiğinde sınav ayrı ve sakin bir ortamda uygulanacaktır." },
        { baslik: "Sınav Süresi ve Mola", aciklama: "Ek süre ve kısa mola hakkı tanınacaktır." }
      ]
    },
    {
      id: "suregen", ad: "Süreğen Hastalık", kisa: "süreğen hastalık",
      varsayilanDestek: "hafif",
      davranis: "Belirgin bir davranış problemi gözlenmemektedir; tedavi süreçlerine bağlı yorgunluk dönemlerinde derse katılımı azalabilmektedir.",
      kosul: {
        yogun: ["telafi etkinlikleri ve bire bir destekle", "kısa ve esnek görevlerle"],
        orta: ["telafi çalışma kâğıdıyla desteklendiğinde", "esnek süre tanındığında"],
        hafif: ["esnek süre tanındığında", "kaçırdığı konu özeti verildiğinde"]
      },
      yontem: ["Telafi Çalışmaları", "Bireysel Destek", "Uzaktan Erişilebilir Materyal", "Akran Desteği"],
      materyal: ["Konu Özet Föyü", "Dijital İçerikler (EBA)", "Telafi Çalışma Kâğıdı"],
      gelisim: [
        "{ad}, süreğen hastalığı nedeniyle tedavi süreçlerine bağlı devamsızlık ve yorgunluk dönemleri yaşayabilmektedir.",
        "Okula devam ettiği dönemlerde derslere istekli katılmaktadır."
      ],
      guclu: ["Öğrenmeye isteklidir.", "Sorumluluk sahibidir."],
      destek: ["Devamsızlık dönemlerinde kaçırılan konuları telafi etme.", "Yorgunluğa bağlı dikkat düşüklüğünü yönetme."],
      sinif: [
        { baslik: "Esnek Devam ve Telafi", aciklama: "Tedavi süreçlerine bağlı devamsızlıklarda kaçırılan konular için telafi materyali ve bireysel destek sağlanacaktır." },
        { baslik: "Sağlık Önlemleri", aciklama: "İlaç/mola ihtiyaçları ve acil durum planı okul yönetimi ve aileyle birlikte belirlenecektir." },
        { baslik: "Görev ve Ödev Düzenlemesi", aciklama: "Ödev ve görev süreleri öğrencinin sağlık durumuna göre esnek tutulacaktır." },
        { baslik: "Evde/Hastanede Eğitim Koordinasyonu", aciklama: "Gerektiğinde evde veya hastanede eğitim hizmetiyle eş güdüm sağlanacaktır." }
      ],
      sinav: [
        ORTAK_SINAV_BASI,
        { baslik: "Sınav Zamanlaması", aciklama: "Sağlık durumuna bağlı olarak sınava giremediğinde mazeret sınavı düzenlenecektir." },
        { baslik: "Süre ve Mola", aciklama: "Gerektiğinde ek süre ve kısa mola hakkı tanınacaktır." }
      ]
    },
    {
      id: "ozel_yetenek", ad: "Özel Yetenekli", kisa: "özel yetenek",
      varsayilanDestek: "hafif", zenginlestirme: true,
      davranis: "Belirgin bir davranış problemi gözlenmemektedir; ilgisini çekmeyen ve tekrara dayalı etkinliklerde sıkılma ve dikkat dağınıklığı görülebilmektedir.",
      kosul: {
        yogun: ["ileri düzey kaynaklardan yararlanarak", "bağımsız araştırma projesiyle"],
        orta: ["ileri düzey kaynaklardan yararlanarak", "bağımsız araştırma projesiyle"],
        hafif: ["ileri düzey kaynaklardan yararlanarak", "disiplinler arası bir bakışla"]
      },
      yontem: ["Proje Tabanlı Öğrenme", "Araştırma-Sorgulama", "Problem Çözme", "Mentorluk"],
      materyal: ["İleri Düzey Kaynaklar", "Bilimsel Makaleler / Veri Setleri", "Dijital Üretim Araçları"],
      gelisim: [
        "{ad}, yaşıtlarına göre daha hızlı öğrenmekte, soyut fikirleri kolayca kavramaktadır.",
        "İlgi alanlarında bağımsız çalışmayı sevmekte ve yüksek performans göstermektedir."
      ],
      guclu: ["Yaratıcı ve özgün düşünür.", "Merak düzeyi ve öğrenme hızı yüksektir."],
      destek: ["Sosyal-duygusal gelişim ve akranlarla iş birliği.", "Mükemmeliyetçilik ve başarısızlıkla baş etme."],
      sinif: [
        { baslik: "Zenginleştirme", aciklama: "Programdaki zenginleştirme önerileri ve ileri düzey görevlerle öğrenme derinleştirilecektir." },
        { baslik: "Proje ve Araştırma", aciklama: "İlgi alanlarına yönelik bağımsız araştırma ve proje çalışmaları planlanacaktır." },
        { baslik: "Grup Çalışmaları", aciklama: "Akranlarıyla iş birliğine dayalı görevlerle sosyal becerileri desteklenecektir." }
      ],
      sinav: [
        { baslik: "Değerlendirme Esası", aciklama: "Öğrenci, BEP’inde yer alan zenginleştirilmiş amaçlara göre değerlendirilecektir." },
        { baslik: "Alternatif Değerlendirme", aciklama: "Proje, ürün dosyası ve performans görevleri dereceli puanlama anahtarlarıyla değerlendirilecektir." }
      ]
    },
    {
      id: "diger", ad: "Diğer (elle yazınız)", kisa: "özel eğitim ihtiyacı",
      varsayilanDestek: "orta",
      davranis: "Sınıf içinde belirgin bir davranış problemi gözlenmemektedir.",
      kosul: {
        yogun: ["öğretmen rehberliğinde ve model olunarak", "aşamalı yardımla"],
        orta: ["görsel ipuçlarıyla desteklendiğinde", "yönlendirici sorular sorulduğunda"],
        hafif: ["kısa bir ipucu verildiğinde", "ek süre tanındığında"]
      },
      yontem: ["Doğrudan Öğretim", "Model Olma", "Soru-Cevap", "Akran Desteği"],
      materyal: ["Uyarlanmış Çalışma Kâğıdı", "Görsel Destek", "Akıllı Tahta"],
      gelisim: ["{ad}, uygun düzenlemeler yapıldığında ders etkinliklerine katılabilmektedir."],
      guclu: ["Öğrenmeye isteklidir."],
      destek: ["Ders kazanımlarını bireysel hızında edinme."],
      sinif: [
        { baslik: "Fiziksel Düzen ve Oturma Yeri", aciklama: "Öğrencinin ihtiyacına uygun, öğretmeni ve tahtayı rahat görebileceği bir yere oturtulacaktır." },
        { baslik: "Öğretim Süreci", aciklama: "Yönergeler kısa ve açık verilecek; içerik öğrencinin performansına göre sadeleştirilecektir." },
        { baslik: "Materyal", aciklama: "Uyarlanmış ve görsellerle desteklenmiş materyaller kullanılacaktır." }
      ],
      sinav: [ORTAK_SINAV_BASI, AYRI_SINAV, { baslik: "Sınav Süresi", aciklama: "Gerektiğinde ek süre tanınacaktır." }]
    }
  ];

  BEP.yetersizlikBul = function (id) {
    for (var i = 0; i < BEP.YETERSIZLIKLER.length; i++) if (BEP.YETERSIZLIKLER[i].id === id) return BEP.YETERSIZLIKLER[i];
    return BEP.YETERSIZLIKLER[BEP.YETERSIZLIKLER.length - 1];
  };

  /* ======================================================================
   * Ders grupları
   * ==================================================================== */
  var GRUP_ESLEME = {
    "turk-dili-ve-edebiyati": "tde",
    "matematik": "mat", "temel-matematik": "mat", "matematik-uygulamalari": "mat",
    "fizik": "fen", "kimya": "fen", "biyoloji": "fen", "astronomi": "fen", "iklim-cevre": "fen",
    "tarih": "sos", "inkilap-tarihi": "sos", "cografya": "cog", "cagdas-turk-dunya-tarihi": "sos", "turk-kultur-medeniyet-tarihi": "sos",
    "demokrasi-insan-haklari": "sos", "islam-bilim-tarihi": "sos",
    "felsefe": "fel", "psikoloji": "fel", "sosyoloji": "fel", "mantik": "fel", "sosyal-bilim-calismalari": "sos",
    "ingilizce": "ing", "aihl-arapca": "arp", "aihl-mesleki-arapca": "arp",
    "din-kulturu": "din", "peygamberimizin-hayati": "din", "kuran-i-kerim": "kur", "temel-dini-bilgiler": "din",
    "aihl-kuran": "kur", "aihl-temel-dini-bilgiler": "din", "aihl-fikih": "din", "aihl-hadis": "din", "aihl-siyer": "din",
    "aihl-akaid": "din", "aihl-tefsir": "din", "aihl-hitabet": "din", "aihl-dinler-tarihi": "din", "aihl-kelam": "din", "aihl-islam-kultur": "din",
    "beden-egitimi-ve-spor": "bes", "gorsel-sanatlar": "gor", "muzik": "muz"
  };
  var TEMA_KULLANAN = { "turk-dili-ve-edebiyati": 1, "matematik": 1, "temel-matematik": 1, "kimya": 1, "biyoloji": 1, "beden-egitimi-ve-spor": 1, "muzik": 1, "gorsel-sanatlar": 1, "ingilizce": 1, "sosyal-bilim-calismalari": 1, "kuran-i-kerim": 1 };

  BEP.dersGrubu = function (dersId) { return GRUP_ESLEME[dersId] || "mes"; };
  BEP.birimTuru = function (dersId, program, uniteAdi) {
    var u = up(uniteAdi || "");
    if (/TEMA|THEME/.test(u)) return "tema";
    if (/ÜNİTE|UNIT/.test(u)) return "unite";
    if (program === "2018") return "unite";
    return TEMA_KULLANAN[dersId] ? "tema" : "unite";
  };

  /* Haftanın beceri türünü sezer (yöntem/materyal seçimi ve şablon için) */
  BEP.beceriSez = function (grup, hafta) {
    var t = up((hafta.k || "") + " " + ((hafta.c || []).map(function (c) { return c[0] + " " + c[1]; }).join(" ")));
    if (grup === "tde") {
      if (/YAZMA|TDE\s?4\.|B\.\d/.test(t)) return "yazma";
      if (/KONUŞMA|SÖZLÜ İLETİŞİM|TDE\s?3\.|C\.\d/.test(t)) return "konusma";
      if (/DİNLEME|İZLEME|TDE\s?1\./.test(t)) return "dinleme";
      if (/DİL BİLGİSİ/.test(t)) return "dilbilgisi";
      return "okuma";
    }
    if (grup === "ing" || grup === "arp") {
      var kodlar = (hafta.c || []).map(function (c) { return c[0]; }).join(" ");
      if (/\.S\d|SPEAK|KONUŞMA/.test(up(kodlar + " " + t))) return "konusma";
      if (/\.W\d|WRIT|YAZMA/.test(up(kodlar + " " + t))) return "yazma";
      if (/\.R\d|READ|OKUMA/.test(up(kodlar + " " + t))) return "okuma";
      if (/\.L\d|LISTEN|DİNLEME/.test(up(kodlar + " " + t))) return "dinleme";
      return "kelime";
    }
    return "genel";
  };

  BEP.DERS_GRUPLARI = {
    tde: {
      ad: "Türk Dili ve Edebiyatı",
      alanEtiketi: "(Okuma, Anlama, Yazma, Dil Bilgisi)",
      yontem: {
        okuma: ["Model Okuma", "Eşli Okuma", "Soru-Cevap Tekniği", "Hikâye/Metin Haritası", "Buldurma Tekniği", "Tekrarlı Okuma"],
        dinleme: ["Dinleme Kılavuzu", "Soru-Cevap Tekniği", "Not Alma Şablonu", "Görselleştirme"],
        konusma: ["Model Olma", "Prova ile Hazırlık", "Akranla Eşli Çalışma", "Rol Oynama (Dramatizasyon)"],
        yazma: ["Güdümlü Yazma", "Yazma Şablonu ile Çalışma", "Beyin Fırtınası", "Kelime Havuzu Kullanımı"],
        dilbilgisi: ["Doğrudan Anlatım", "Gösterip Yaptırma", "Alıştırma ve Tekrar", "Pekiştirme"],
        genel: ["Doğrudan Öğretim", "Soru-Cevap Tekniği", "Model Olma"]
      },
      materyal: {
        okuma: ["Sadeleştirilmiş Metin", "Kelime Kartları", "Metin Haritası Şablonu", "Akıllı Tahta"],
        dinleme: ["Ses / Video Kaydı (EBA)", "Dinleme Kontrol Kartı", "Görsel Destekli Metin"],
        konusma: ["Konuşma Kartları", "Görsel İpucu Kartları", "Zamanlayıcı"],
        yazma: ["Yazma Şablonu", "Kelime Havuzu Föyü", "Yazım Kılavuzu Föyü"],
        dilbilgisi: ["Yazım Kılavuzu Föyü", "Cümle Şeritleri", "Çalışma Kâğıdı"],
        genel: ["Ders Kitabı", "Sade Metinler", "Akıllı Tahta"]
      },
      performans: [
        { etiket: "OKUMA & ANLAMA", yogun: "Kısa ve sade metinleri öğretmen desteğiyle okuyabilmekte; okuduğu metinle ilgili 5N1K sorularını görsel ipuçları ve yönlendirici sorularla yanıtlayabilmektedir.", orta: "Sınıf düzeyindeki sade metinleri hecelemeden okuyabilmekte; olay metinlerinde 5N1K sorularını doğru yanıtlamakta, soyut ve sembolik metinlerde ana fikri bulmada yönlendirici ipuçlarına ihtiyaç duymaktadır.", hafif: "Sınıf düzeyindeki metinleri akıcı okuyabilmekte; ana fikir ve yardımcı fikirleri büyük ölçüde belirleyebilmekte, edebî sanatları ve örtük anlamları çözümlemede kısa ipuçlarına ihtiyaç duymaktadır." },
        { etiket: "YAZMA & DİL BİLGİSİ", yogun: "Düşüncelerini 1-2 kısa cümleyle, model cümleler ve kelime havuzu desteğiyle yazabilmektedir. Cümle başı büyük harf ve nokta kullanımında hatırlatmaya ihtiyaç duymaktadır.", orta: "Düşüncelerini 3-4 cümlelik basit ve kurallı cümlelerle yazabilmektedir. Temel yazım kurallarını (büyük harf, -de/-da bağlacı) ve temel noktalama işaretlerini çoğunlukla doğru uygulamaktadır.", hafif: "Paragraf düzeyinde yazılar yazabilmekte; yazım ve noktalama kurallarını büyük ölçüde doğru uygulamakta, düşüncelerini mantıksal sırayla düzenlemede kısa geri bildirimlerle başarılı olmaktadır." },
        { etiket: "SÖZLÜ İLETİŞİM", yogun: "Kısa ve tanıdık konularda tek cümlelik yanıtlar verebilmekte; sınıf önünde konuşmada yoğun desteğe ihtiyaç duymaktadır.", orta: "Saygılı ve net yanıt vermektedir. Sınıf önünde uzun konuşmalarda çekingenlik yaşamakta; akran desteği ve hazırlıklı kısa sunumlarda kendini rahat ifade edebilmektedir.", hafif: "Hazırlıklı konuşmalarda kendini açık ve düzenli ifade edebilmekte; hazırlıksız konuşmalarda heyecanını kontrol etmede desteğe ihtiyaç duymaktadır." }
      ]
    },
    mat: {
      ad: "Matematik",
      alanEtiketi: "(Sayılar ve İşlemler, Problem Çözme, Geometri ve Veri)",
      yontem: { genel: ["Doğrudan Öğretim", "Örnek Çözüm Modellemesi", "Somuttan Soyuta Öğretim", "Görev Analizi", "Gösterip Yaptırma", "Tekrar ve Pekiştirme", "Akranla Eşli Çalışma", "Soru-Cevap"] },
      materyal: { genel: ["Somut Materyaller", "Adım / Formül Kartları", "Hesap Makinesi", "GeoGebra", "Kareli Kâğıt, Sayı Doğrusu", "Uyarlanmış Çalışma Kâğıdı", "Akıllı Tahta"] },
      performans: [
        { etiket: "SAYILAR VE İŞLEMLER", yogun: "Dört işlemi somut materyal ve hesap makinesi desteğiyle yapabilmekte; çok basamaklı işlemlerde adım adım rehberliğe ihtiyaç duymaktadır.", orta: "Dört işlemi doğru yapabilmekte; üslü-köklü ve cebirsel ifadeler gibi soyut konularda örnek çözüm ve görsel modellerle desteklendiğinde başarılı olmaktadır.", hafif: "Sınıf düzeyindeki temel işlemleri büyük ölçüde bağımsız yapabilmekte; işlem hatalarını kontrol etmede kısa hatırlatmalara ihtiyaç duymaktadır." },
        { etiket: "PROBLEM ÇÖZME", yogun: "Tek adımlı, günlük yaşamdan problemleri resimli ve somut desteklerle çözebilmektedir.", orta: "Bir-iki adımlı problemleri, verilenler-istenenler tablosu ve örnek çözüm desteğiyle çözebilmektedir.", hafif: "Çok adımlı problemlerde çözüm stratejisini belirlemede kısa ipuçlarıyla başarılı olmaktadır." },
        { etiket: "GEOMETRİ VE VERİ", yogun: "Temel geometrik şekilleri tanıyıp adlandırabilmekte; ölçme ve grafik okumada yoğun desteğe ihtiyaç duymaktadır.", orta: "Temel geometrik kavramları ve basit grafikleri (sütun/çizgi) görsel destekle yorumlayabilmektedir.", hafif: "Geometrik ilişkileri ve veri gösterimlerini büyük ölçüde doğru yorumlayabilmektedir." }
      ]
    },
    fen: {
      ad: "Fen Bilimleri",
      alanEtiketi: "(Temel Kavramlar, Deney-Gözlem, Grafik-Tablo Okuma)",
      yontem: { genel: ["Deney ve Gösteri", "Doğrudan Öğretim", "Simülasyon ile Öğretim", "Gözlem", "Kavram Haritası", "Soru-Cevap", "Akranla Eşli Deney", "Somutlaştırma"] },
      materyal: { genel: ["Deney Malzemeleri", "Simülasyon (PhET, EBA)", "Kavram Kartları", "Video / Animasyon", "Modeller", "Uyarlanmış Çalışma Kâğıdı", "Akıllı Tahta"] },
      performans: [
        { etiket: "TEMEL KAVRAMLAR", yogun: "Günlük yaşamla ilişkilendirilmiş temel bilimsel kavramları resim ve modellerle tanıyabilmektedir.", orta: "Temel bilimsel kavramları görsel ve somut örneklerle açıklayabilmekte; soyut ve formül gerektiren konularda desteğe ihtiyaç duymaktadır.", hafif: "Sınıf düzeyindeki kavramları büyük ölçüde açıklayabilmekte; kavramlar arası ilişki kurmada kısa ipuçlarına ihtiyaç duymaktadır." },
        { etiket: "DENEY VE GÖZLEM", yogun: "Deney ve gösterileri izlemekte; güvenlik kurallarına öğretmen rehberliğinde uymaktadır.", orta: "Basit deneyleri adım kartlarıyla ve akran desteğiyle yapabilmekte, gözlemlerini kısa cümlelerle ifade edebilmektedir.", hafif: "Deney adımlarını büyük ölçüde bağımsız uygulamakta, sonuçları yorumlamada kısa yönlendirmelere ihtiyaç duymaktadır." },
        { etiket: "GRAFİK VE TABLO", yogun: "Basit tablolardan bilgi okumada yoğun desteğe ihtiyaç duymaktadır.", orta: "Basit tablo ve grafiklerden doğrudan bilgi okuyabilmektedir.", hafif: "Grafik ve tablolardaki ilişkileri büyük ölçüde yorumlayabilmektedir." }
      ]
    },
    sos: {
      ad: "Sosyal Bilimler",
      alanEtiketi: "(Olay-Olgu Bilgisi, Zaman-Mekân İlişkisi, Kaynak Kullanımı)",
      yontem: { genel: ["Doğrudan Anlatım", "Zaman Şeridi ile Çalışma", "Harita Okuma", "Örnek Olay", "Belgesel/Video İzleme", "Soru-Cevap", "Kavram Haritası", "Akranla Eşli Çalışma"] },
      materyal: { genel: ["Zaman Şeridi", "Tarihî Harita", "Görsel Kartlar", "Belgesel Kesitleri (EBA)", "Sade Kaynak Metin", "Akıllı Tahta"] },
      performans: [
        { etiket: "OLAY-OLGU BİLGİSİ", yogun: "Temel tarihî/toplumsal olayları resimli kartlar ve kısa anlatımlarla tanıyabilmektedir.", orta: "Önemli olay ve kavramları sadeleştirilmiş metinler ve görsellerle açıklayabilmektedir.", hafif: "Olayların neden-sonuç ilişkilerini büyük ölçüde kurabilmektedir." },
        { etiket: "ZAMAN-MEKÂN İLİŞKİSİ", yogun: "Olayları zaman şeridinde öğretmen desteğiyle sıralayabilmektedir.", orta: "Zaman şeridi ve harita desteğiyle olayları kronolojik sıraya koyabilmekte ve yerleri haritada gösterebilmektedir.", hafif: "Zaman ve mekân ilişkilerini büyük ölçüde doğru kurabilmektedir." },
        { etiket: "KAYNAK KULLANIMI", yogun: "Görsel kaynaklardan basit bilgiler çıkarmada yoğun desteğe ihtiyaç duymaktadır.", orta: "Sadeleştirilmiş kaynak metinlerden yönlendirici sorularla bilgi çıkarabilmektedir.", hafif: "Kaynaklardan bilgi toplayıp kısa değerlendirmeler yapabilmektedir." }
      ]
    },
    cog: {
      ad: "Coğrafya",
      alanEtiketi: "(Harita Okuma, Doğal ve Beşerî Sistemler, Çevre)",
      yontem: { genel: ["Harita ve Küre ile Çalışma", "Doğrudan Anlatım", "Gözlem / Alan Gezisi", "Örnek Olay", "Video ile Öğretim", "Kavram Haritası", "Soru-Cevap"] },
      materyal: { genel: ["Fiziki ve Siyasi Haritalar", "Küre", "Görsel Kartlar", "CBS Uygulamaları", "Belgesel Kesitleri (EBA)", "Akıllı Tahta"] },
      performans: [
        { etiket: "HARİTA OKUMA", yogun: "Harita üzerinde Türkiye’yi ve yaşadığı ili öğretmen desteğiyle gösterebilmektedir.", orta: "Lejant ve renk kodlarını kullanarak haritadan basit bilgiler okuyabilmektedir.", hafif: "Farklı harita türlerini büyük ölçüde doğru yorumlayabilmektedir." },
        { etiket: "DOĞAL VE BEŞERÎ SİSTEMLER", yogun: "Temel coğrafi kavramları (iklim, nüfus vb.) görsellerle tanıyabilmektedir.", orta: "Temel coğrafi süreçleri görsel ve örneklerle açıklayabilmektedir.", hafif: "Doğal ve beşerî sistemler arasındaki ilişkileri büyük ölçüde kurabilmektedir." },
        { etiket: "ÇEVRE VE TOPLUM", yogun: "Çevreyi koruma davranışlarını örneklerle tanıyabilmektedir.", orta: "Çevre sorunlarını ve çözüm önerilerini görsellerle açıklayabilmektedir.", hafif: "Çevre sorunlarının nedenlerini ve sonuçlarını büyük ölçüde değerlendirebilmektedir." }
      ]
    },
    fel: {
      ad: "Felsefe Grubu",
      alanEtiketi: "(Kavram Bilgisi, Akıl Yürütme, Görüş Bildirme)",
      yontem: { genel: ["Doğrudan Anlatım", "Örnek Olay", "Soru-Cevap", "Tartışma (Yönlendirilmiş)", "Kavram Haritası", "Günlük Yaşamdan Örnekleme"] },
      materyal: { genel: ["Sade Okuma Metni", "Kavram Kartları", "Görsel Şemalar", "Video Kesitleri", "Akıllı Tahta"] },
      performans: [
        { etiket: "KAVRAM BİLGİSİ", yogun: "Temel kavramları günlük yaşam örnekleriyle ve görsellerle tanıyabilmektedir.", orta: "Temel kavramları sadeleştirilmiş tanım ve örneklerle açıklayabilmektedir.", hafif: "Kavramları büyük ölçüde doğru kullanabilmekte, kavramlar arası ilişki kurmada kısa ipuçlarına ihtiyaç duymaktadır." },
        { etiket: "AKIL YÜRÜTME", yogun: "Basit neden-sonuç ilişkilerini öğretmen rehberliğinde kurabilmektedir.", orta: "Somut örnekler üzerinden basit akıl yürütmeler yapabilmektedir.", hafif: "Argümanların temel yapısını büyük ölçüde fark edebilmektedir." },
        { etiket: "GÖRÜŞ BİLDİRME", yogun: "Kısa ve tek cümlelik görüş bildirebilmektedir.", orta: "Bir konu hakkındaki görüşünü 2-3 cümleyle ve bir gerekçeyle ifade edebilmektedir.", hafif: "Görüşlerini gerekçeleriyle düzenli biçimde ifade edebilmektedir." }
      ]
    },
    ing: {
      ad: "İngilizce",
      alanEtiketi: "(Kelime Bilgisi, Dinleme-Konuşma, Okuma-Yazma)",
      yontem: {
        dinleme: ["Total Fiziksel Tepki (TPR)", "Dinle-İşaretle Etkinliği", "Şarkı ve Video ile Öğretim", "Tekrar"],
        konusma: ["Model Diyalog", "Rol Oynama", "Kalıp Cümle Çalışması", "Akranla Eşli Konuşma"],
        okuma: ["Görsel Destekli Okuma", "Eşleştirme Etkinliği", "Soru-Cevap", "Anahtar Kelime Bulma"],
        yazma: ["Model Cümleyle Yazma", "Boşluk Doldurma", "Kelime Havuzu ile Yazma"],
        kelime: ["Kelime Kartlarıyla Öğretim", "Total Fiziksel Tepki (TPR)", "Oyunlaştırma", "Tekrar ve Pekiştirme"],
        genel: ["Görsel Kartlarla Öğretim", "Oyunlaştırma", "Model Olma"]
      },
      materyal: {
        dinleme: ["Yavaşlatılmış Ses Kaydı", "Resimli Dinleme Kartı", "Video (altyazılı)"],
        konusma: ["Diyalog Kartları", "Görsel İpucu Kartları", "Ses Kaydı"],
        okuma: ["Görselli Kısa Metin", "Kelime Kartları", "Görsel Sözlük"],
        yazma: ["Cümle Kalıbı Kartları", "Kelime Havuzu", "Uyarlanmış Çalışma Kâğıdı"],
        kelime: ["Kelime Kartları", "Görsel Sözlük", "Şarkı / Video", "Akıllı Tahta"],
        genel: ["Ders Kitabı", "Flashcards", "Akıllı Tahta"]
      },
      performans: [
        { etiket: "KELİME BİLGİSİ", yogun: "Sık kullanılan temel kelimeleri (selamlaşma, renkler, sayılar, okul eşyaları) görsellerle eşleştirebilmektedir.", orta: "Temaya ait temel kelimeleri görsel desteğiyle tanıyıp kullanabilmektedir.", hafif: "Sınıf düzeyindeki kelimelerin çoğunu tanıyıp cümle içinde kullanabilmektedir." },
        { etiket: "DİNLEME-KONUŞMA", yogun: "Kısa ve yavaş söylenen basit yönergeleri görsel destekle anlayabilmekte; tek kelimelik yanıtlar verebilmektedir.", orta: "Kısa dinleme metinlerinde temel bilgileri bulabilmekte; model diyaloglardaki kalıp cümleleri kullanabilmektedir.", hafif: "Basit konuşmaları anlayabilmekte ve kısa diyaloglara katılabilmektedir." },
        { etiket: "OKUMA-YAZMA", yogun: "Görselle desteklenmiş tek kelimeleri okuyabilmekte; kelimeleri model üzerinden yazabilmektedir.", orta: "Görselli kısa metinleri okuyup basit sorulara yanıt verebilmekte; model cümlelerle 2-3 basit cümle yazabilmektedir.", hafif: "Kısa metinleri anlayabilmekte ve basit paragraflar yazabilmektedir." }
      ]
    },
    arp: {
      ad: "Arapça",
      alanEtiketi: "(Kelime Bilgisi, Dinleme-Konuşma, Okuma-Yazma)",
      yontem: { genel: ["Kelime Kartlarıyla Öğretim", "Model Diyalog", "Tekrar ve Pekiştirme", "Eşleştirme Etkinliği", "Oyunlaştırma"] },
      materyal: { genel: ["Kelime Kartları", "Ses Kayıtları", "Görsel Sözlük", "Uyarlanmış Çalışma Kâğıdı", "Akıllı Tahta"] },
      performans: [
        { etiket: "KELİME BİLGİSİ", yogun: "Temel kelimeleri görsellerle eşleştirebilmektedir.", orta: "Temaya ait temel kelimeleri görsel destekle tanıyıp söyleyebilmektedir.", hafif: "Sınıf düzeyindeki kelimelerin çoğunu kullanabilmektedir." },
        { etiket: "DİNLEME-KONUŞMA", yogun: "Kısa selamlaşma kalıplarını model eşliğinde tekrar edebilmektedir.", orta: "Basit kalıp cümlelerle kısa diyaloglara katılabilmektedir.", hafif: "Kısa diyalogları anlayıp yanıt verebilmektedir." },
        { etiket: "OKUMA-YAZMA", yogun: "Harfleri ve kısa kelimeleri model üzerinden okuyup yazabilmektedir.", orta: "Kısa cümleleri okuyabilmekte ve model cümlelerle yazabilmektedir.", hafif: "Kısa metinleri okuyup anlayabilmektedir." }
      ]
    },
    din: {
      ad: "Din Kültürü ve Ahlak Bilgisi",
      alanEtiketi: "(Temel Kavramlar, Okuduğunu Anlama, Değerler)",
      yontem: { genel: ["Doğrudan Anlatım", "Örnek Olay", "Soru-Cevap", "Kavram Haritası", "Hikâyeleştirme", "Görsel Destekli Anlatım", "Akranla Eşli Çalışma"] },
      materyal: { genel: ["Sadeleştirilmiş Metin", "Kavram Kartları", "Sesli Metin / Video (EBA)", "Görsel Şemalar", "Akıllı Tahta"] },
      performans: [
        { etiket: "TEMEL KAVRAMLAR", yogun: "Temel kavramları görsel ve örneklerle tanıyabilmektedir.", orta: "Temel kavramları sadeleştirilmiş açıklamalar ve örneklerle ifade edebilmektedir.", hafif: "Kavramları büyük ölçüde doğru açıklayabilmektedir." },
        { etiket: "OKUDUĞUNU ANLAMA", yogun: "Kısa metinlerdeki temel mesajı yönlendirici sorularla bulabilmektedir.", orta: "Sadeleştirilmiş metinlerden ana fikri ve temel mesajları çıkarabilmektedir.", hafif: "Metinlerdeki mesajları yorumlayabilmektedir." },
        { etiket: "DEĞERLER", yogun: "Temel değerleri (saygı, sorumluluk, yardımlaşma) günlük yaşam örnekleriyle tanıyabilmektedir.", orta: "Değerleri günlük yaşam durumlarıyla ilişkilendirebilmektedir.", hafif: "Değerlerle ilgili durumları değerlendirebilmektedir." }
      ]
    },
    kur: {
      ad: "Kur’an-ı Kerim",
      alanEtiketi: "(Harf ve Harekeler, Yüzünden Okuma, Ezber)",
      yontem: { genel: ["Model Okuma (Takrir)", "Tekrar", "Eşli Okuma", "Dinle-Tekrar Et", "Gösterip Yaptırma"] },
      materyal: { genel: ["Ses Kayıtları", "Elif-Ba / Harf Kartları", "Renkli Tecvit Kartları", "Akıllı Tahta"] },
      performans: [
        { etiket: "HARF VE HAREKELER", yogun: "Harfleri görsel kartlarla tanıyabilmektedir.", orta: "Harfleri ve harekeleri büyük ölçüde doğru tanıyabilmektedir.", hafif: "Harf ve harekeleri doğru okuyabilmektedir." },
        { etiket: "YÜZÜNDEN OKUMA", yogun: "Kısa kelimeleri model okumayı takip ederek okuyabilmektedir.", orta: "Kısa ayetleri model okumayla destekli okuyabilmektedir.", hafif: "Ayetleri büyük ölçüde akıcı okuyabilmektedir." },
        { etiket: "EZBER", yogun: "Kısa dua ve sureleri tekrarlarla ezberlemeye çalışmaktadır.", orta: "Kısa sureleri dinleme ve tekrar desteğiyle ezberleyebilmektedir.", hafif: "Programdaki sureleri büyük ölçüde ezberleyebilmektedir." }
      ]
    },
    bes: {
      ad: "Beden Eğitimi ve Spor",
      alanEtiketi: "(Hareket Becerileri, Oyun ve Spor, Sağlıklı Yaşam)",
      yontem: { genel: ["Gösterip Yaptırma", "Basamaklı Hareket Öğretimi", "Akran Eşliği", "Oyunlaştırma", "Model Olma", "Tekrar"] },
      materyal: { genel: ["Görsel Hareket Kartları", "Renkli Koniler ve Toplar", "Uyarlanmış Spor Araçları", "Müzik / Ritim"] },
      performans: [
        { etiket: "HAREKET BECERİLERİ", yogun: "Temel hareketleri (yürüme, koşma, atma, yakalama) model ve fiziksel destekle yapabilmektedir.", orta: "Temel hareket becerilerini gösterilerek yapabilmekte, hareket kombinasyonlarında desteğe ihtiyaç duymaktadır.", hafif: "Hareket becerilerini büyük ölçüde bağımsız uygulayabilmektedir." },
        { etiket: "OYUN VE SPOR", yogun: "Basit kurallı oyunlara yetişkin desteğiyle katılabilmektedir.", orta: "Takım oyunlarına akran eşliğinde katılabilmekte ve temel kurallara uyabilmektedir.", hafif: "Oyun ve spor etkinliklerine kurallara uyarak etkin katılabilmektedir." },
        { etiket: "SAĞLIKLI YAŞAM", yogun: "Hijyen ve ısınma alışkanlıklarını hatırlatmalarla uygulayabilmektedir.", orta: "Isınma-soğuma ve sağlıklı yaşam alışkanlıklarını görsel kartlarla uygulayabilmektedir.", hafif: "Sağlıklı yaşam alışkanlıklarını büyük ölçüde bağımsız uygulamaktadır." }
      ]
    },
    gor: {
      ad: "Görsel Sanatlar",
      alanEtiketi: "(Görsel İletişim ve Biçimlendirme, Sanat Kültürü)",
      yontem: { genel: ["Gösterip Yaptırma", "Model Olma", "Uygulama", "Örnek İnceleme", "Akranla Eşli Çalışma"] },
      materyal: { genel: ["Örnek Görseller", "Şablonlar", "Kalın Uçlu Boya Malzemeleri", "Uyarlanmış Çizim Araçları"] },
      performans: [
        { etiket: "GÖRSEL BİÇİMLENDİRME", yogun: "Basit çizim ve boyama çalışmalarını şablon ve model yardımıyla yapabilmektedir.", orta: "Temel sanat elemanlarını (çizgi, renk, biçim) örneklerle kullanabilmektedir.", hafif: "Özgün çalışmalar üretebilmektedir." },
        { etiket: "SANAT KÜLTÜRÜ", yogun: "Sanat eserlerini görsellerle tanıyabilmektedir.", orta: "Sanat eserleri hakkında kısa yorumlar yapabilmektedir.", hafif: "Sanat eserlerini temel ölçütlerle değerlendirebilmektedir." }
      ]
    },
    muz: {
      ad: "Müzik",
      alanEtiketi: "(Dinleme-Söyleme, Müzikal Algı, Müzik Kültürü)",
      yontem: { genel: ["Dinle-Tekrar Et", "Model Olma", "Ritim Çalışması", "Gösterip Yaptırma", "Oyunlaştırma"] },
      materyal: { genel: ["Ses Kayıtları", "Ritim Çalgıları", "Görsel Nota/Şarkı Kartları", "Akıllı Tahta"] },
      performans: [
        { etiket: "DİNLEME-SÖYLEME", yogun: "Kısa ezgileri model eşliğinde tekrar edebilmektedir.", orta: "Şarkıları toplu söylemelere katılarak seslendirebilmektedir.", hafif: "Şarkıları doğru ezgi ve ritimle söyleyebilmektedir." },
        { etiket: "MÜZİKAL ALGI", yogun: "Basit ritimleri model eşliğinde tekrar edebilmektedir.", orta: "Temel ritim kalıplarını vurmalı çalgılarla uygulayabilmektedir.", hafif: "Müzikal öğeleri (ritim, tempo, gürlük) ayırt edebilmektedir." }
      ]
    },
    mes: {
      ad: "Meslek / Diğer Dersler",
      alanEtiketi: "(Temel Bilgi, Uygulama Becerileri, İş Güvenliği)",
      yontem: { genel: ["Gösterip Yaptırma", "Doğrudan Öğretim", "Görev Analizi", "Model Olma", "Akranla Eşli Uygulama", "Tekrar ve Pekiştirme"] },
      materyal: { genel: ["Uygulama Adım Kartları", "Atölye Araçları", "Görsel İş Akış Şeması", "Uyarlanmış Çalışma Kâğıdı", "Meslek Videoları (EBA)"] },
      performans: [
        { etiket: "TEMEL BİLGİ", yogun: "Alanla ilgili temel kavram ve araçları görsellerle tanıyabilmektedir.", orta: "Temel kavram ve araçları örneklerle açıklayabilmektedir.", hafif: "Kavramları büyük ölçüde doğru kullanabilmektedir." },
        { etiket: "UYGULAMA BECERİLERİ", yogun: "Basit uygulama adımlarını model ve fiziksel destekle yapabilmektedir.", orta: "Uygulamaları adım kartları ve akran desteğiyle yapabilmektedir.", hafif: "Uygulamaları büyük ölçüde bağımsız yapabilmektedir." },
        { etiket: "İŞ SAĞLIĞI VE GÜVENLİĞİ", yogun: "Temel güvenlik kurallarını hatırlatmalarla uygulayabilmektedir.", orta: "İş güvenliği kurallarını görsel uyarılarla uygulayabilmektedir.", hafif: "İş güvenliği kurallarına bağımsız uyabilmektedir." }
      ]
    }
  };

  /* Resmî planlardaki ölçme araçlarını BEP’e uygun biçimlere dönüştür */
  BEP.OLCME_DONUSUM = {
    "Açık uçlu sorular": "Yönlendirmeli kısa cevaplı sorular",
    "Dereceli puanlama anahtarı": "Sadeleştirilmiş dereceli puanlama anahtarı",
    "Çalışma kâğıdı": "Uyarlanmış çalışma kâğıdı",
    "Performans görevi": "Uyarlanmış performans görevi",
    "Öz değerlendirme formu": "Görselli öz değerlendirme formu",
    "Akran değerlendirme formu": "Akran değerlendirme (destekli)",
    "Çoktan seçmeli test": "3 seçenekli kısa test",
    "Proje": "Uyarlanmış proje görevi",
    "Sunum": "Kısa ve hazırlıklı sunum",
    "Zihin haritası": "Yarı doldurulmuş zihin haritası",
    "Kavram haritası": "Yarı doldurulmuş kavram haritası",
    "Tanılayıcı dallanmış ağaç": "Doğru-yanlış etkinliği",
    "Yapılandırılmış grid": "Eşleştirme etkinliği",
    "Öğrenme günlüğü": "Kısa öğrenme günlüğü (cümle başlatıcılı)",
    "Deney/uygulama": "Deney/uygulama gözlem formu"
  };
  BEP.VARSAYILAN_OLCME = ["Ders içi gözlem formu", "BEP kontrol listesi", "Uyarlanmış çalışma kâğıdı", "Soru-cevap ile değerlendirme", "Eşleştirme etkinliği"];

  /* BEP birimi kararları için varsayılanlar (ORGM 2022 EK-9 "IV- BEP Geliştirme Birim Kararları") */
  BEP.VARSAYILAN_KARARLAR = {
    aileSiklik: "Ayda bir (gerektiğinde daha sık)",
    aileYol: "Yüz yüze görüşme; mümkün olmadığında telefon/e-Okul VBS üzerinden",
    davranis: "Öğrencinin sınıf içi davranışları olumlu davranış desteği yaklaşımıyla izlenecek; ihtiyaç hâlinde BEP geliştirme birimince davranış değiştirme programı hazırlanacaktır.",
    diger: ""
  };
})(typeof window !== "undefined" ? window : globalThis);
