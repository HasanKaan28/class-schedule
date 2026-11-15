// Landing page: language switch (English in the HTML, Turkish and Bosnian here) and the live demo in the phone frame.
// The demo is the real app at ../?demo=1 (sample timetable, never saved). It is steered with postMessage:
//   { type: 'class-schedule-demo', theme, lang, tab }  (any subset)
(function () {
  'use strict';

  var LANGS = ['en', 'tr', 'bs'];
  var STORE_KEY = 'about-lang';

  // Text for elements marked data-i18n (inner HTML) and data-i18n-attr ("attr:key; attr:key").
  // English is read from the page itself, so the HTML stays the single English source.
  var TEXT = {
    tr: {
      docTitle: 'Ders Programı: IUS öğrencileri için ücretsiz ders programı uygulaması',
      metaDesc: 'IUS öğrencileri için ücretsiz haftalık ders programı: resmi programdan ve eCampus\'tan ders bilgileri, vizeler, quizler ve ders hatırlatıcıları. Resmi değil, IUS Engineering Club\'dan.',
      ogAlt: 'Telefonda Ders Programı, örnek bir haftanın programıyla',
      skip: 'İçeriğe geç',
      appName: 'Ders Programı',
      navLabel: 'Bölümler',
      navFeatures: 'Özellikler',
      navHow: 'Nasıl çalışır',
      navScreens: 'Ekranlar',
      navInstall: 'Kurulum',
      navFaq: 'SSS',
      langLabel: 'Dil',
      kicker: 'Ücretsiz · Resmi değil · <span lang="en">IUS Engineering Club</span>\'dan',
      heroLead: 'IUS öğrencileri için ücretsiz bir haftalık ders programı: derslerini bir kez ekle, ders bilgilerini, vizeleri ve quizleri uygulama doldursun.',
      ctaApk: 'Android için indir',
      ctaApkNote: 'APK · Android 8 veya üstü',
      ctaWeb: 'Tarayıcıda aç',
      ctaWebNote: 'Her telefon ve bilgisayarda, iPhone\'da da',
      demoFrame: 'Örnek bir ders programıyla Ders Programı\'nın canlı önizlemesi',
      demoCaption: 'Örnek bir ders programıyla çalışan gerçek Ders Programı uygulaması',
      demoTitle: 'Hemen burada dene',
      demoLead: 'Bu, örnek bir ders programıyla açılmış gerçek uygulama. Burada yaptığın hiçbir şey kaydedilmez.',
      demoFallback: 'Canlı önizleme açılamadı, bu yüzden bir ekran görüntüsü gösteriliyor.',
      demoScreen: 'Ekran',
      demoLiving: 'Canlı temalar',
      demoMore: 'Diğer temalar',
      tabToday: 'Bugün', tabWeek: 'Hafta', tabQuizzes: 'Quizler', tabExams: 'Vizeler', tabCourses: 'Dersler',
      eyFeatures: 'Neler yapar',
      featuresTitle: 'Bütün haftan tek ekranda',
      f1t: 'Haftalık ders programın',
      f1d: 'CS103 gibi bir ders kodu yaz ve şubeni seç. Ders saatleri ve sınıflar resmi IUS programından; hocalar, asistanlar, ECTS ve ofis saatleri eCampus\'tan gelir.',
      f2t: 'Vize tarihleri ve sınıfları',
      f2d: 'Her vizenin tarihi, saati ve sınıfı, resmi vize programından. Vize haftasında Bugün ekranı dersler yerine sınavlarını gösterir.',
      f3t: 'Arkadaşlarından quizler',
      f3d: 'Öğrenciler yaklaşan quizleri bildirir, kulüp her bildirimi kontrol eder, sonra quiz o dersi ve şubeyi alan herkese görünür.',
      f4t: 'Ders hatırlatıcıları',
      f4d: 'Android\'de: her dersten önce bir hatırlatma ve akşamları yarının özeti. İkisi de Ayarlar\'dan açılır.',
      f5t: '20 tema',
      f5d: 'Aydınlık, koyu, sakin ve eğlenceli temalar; bir de arıların, kedilerin, balıkların ve karın hareket ettiği altı canlı tema. İstersen telefonuna uysun.',
      f6t: 'İngilizce, Türkçe ve Boşnakça',
      f6d: 'Dili Ayarlar\'dan değiştir: sağ üstteki dişli simgesinin arkasında.',
      f7t: 'İnternetsiz çalışır',
      f7d: 'Android uygulaması bağlantı olmadan da açılır; tarayıcı sürümü de son kopyasını saklar.',
      f8t: 'Programın telefonunda kalır',
      f8d: 'Ders programın yalnızca telefonunda ya da tarayıcında saklanır, hiçbir yere yüklenmez. Hesap yok, giriş yok.',
      eyHow: 'Nasıl çalışır',
      howTitle: 'Resmi PDF\'ten telefonuna, her gece',
      howLead: 'Ders listesini kimse elle yazmıyor. Küçük bir program onu her gece topluyor, telefonun da sonucu indiriyor.',
      r1t: 'IUS ders programı PDF\'i ve eCampus',
      r1d: 'Resmi dönem programı ders saatlerini ve sınıfları verir. eCampus ise syllabus bağlantılarını, ECTS\'yi, hocaları, tutorial ve lab şubelerini ve ofis saatlerini.',
      r2t: 'GitHub Actions\'ta gece çalışan toplayıcı',
      r2d: 'Her gece yalnızca bu dönemin derslerine bakar, eCampus\'un istediği gibi istekler arasında 10 saniye bekler ve değişiklikleri kaydeder.',
      r3t: 'GitHub Pages',
      r3d: 'Her değişiklik uygulamanın sitesini kendiliğinden yeniden yayınlar. Hepsi düz HTML, CSS ve JavaScript.',
      r4t: 'Telefonun',
      r4d: 'Uygulama internete bağlıyken en yeni sürümü yükler ve bağlantı yokken kullanmak için bir kopya saklar. Ders programın yalnızca burada kayıtlı.',
      whyTitle: 'Neden böyle yapıldı',
      w1t: 'Derslerini kendin eklersin',
      w1d: 'Programını SIS\'ten okumak SIS şifreni gerektirirdi. Bir kod yazıp şubeye dokunmak birkaç saniye sürüyor, şifren de sende kalıyor.',
      w2t: 'İki kaynak, her biri en iyi bildiği iş için',
      w2d: 'Ders saatleri ve sınıflar için en güncel kaynak program PDF\'i. Ondan yola çıkınca toplayıcı eCampus\'ta 1.700 yerine yaklaşık 250 derse bakıyor.',
      w3t: 'Her telefon değil, tek bir kibar toplayıcı',
      w3d: 'eCampus\'a her telefon ayrı ayrı sormak yerine tek bir program onu gecede bir kez okuyor. eCampus sayfalarını değiştirirse toplayıcıdaki tek bir düzeltme herkes için yetiyor.',
      w4t: 'Bir kez kur, güncellemeler kendiliğinden gelsin',
      w4d: 'Android uygulaması ekranlarını GitHub Pages\'tan yüklüyor; düzeltmeler ve yeni özellikler yeni bir APK gerekmeden herkese ulaşıyor.',
      w5t: 'İnternetsiz de açılır',
      w5d: 'APK uygulamanın bir kopyasını içinde taşıyor ve ders programı telefonda saklanıyor; internet gidip gelince hiçbir şey kaybolmuyor.',
      w6t: 'Android ve tarayıcı için tek uygulama',
      w6d: 'Android uygulaması web uygulamasının etrafında ince bir kabuk, yani ikisi de aynı kodla çalışıyor. iPhone kullananlar da tarayıcı sürümünü açıyor.',
      eyScreens: 'Ekranlar',
      screensTitle: 'Kurmadan önce gör',
      screensLead: 'Örnek bir ders programıyla uygulamanın gerçek ekranları.',
      shotsLabel: 'Ekran görüntüleri, yana kaydır',
      altToday: 'Bugün ekranı: sıradaki ders ve günün dersleri, aralarındaki boşluklarla',
      altWeek: 'Hafta ekranı: renkli ders bloklarıyla pazartesiden cumaya program',
      altMidterms: 'Vizeler ekranı: bir öğrencinin vizelerinin tarihleri, saatleri ve sınıfları',
      altCourses: 'Dersler ekranı: her ders, hocaları ve ofis saatleriyle',
      altThemes: 'Ayarlar: bütün temaların olduğu tema seçici',
      altBee: 'Arı kovanı temasında uygulama',
      altCat: 'Kediler temasında uygulama',
      altSpace: 'Uzay temasında uygulama',
      capToday: 'Bugün', capWeek: 'Hafta', capMidterms: 'Vizeler', capCourses: 'Dersler',
      capThemes: 'Tema seçici', capBee: 'Arı kovanı teması', capCat: 'Kediler teması', capSpace: 'Uzay teması',
      eyInstall: 'Kurulum',
      installTitle: 'Üç adımda Android telefonunda',
      s1: 'Telefonunda GitHub\'daki <a href="https://github.com/HasanKaan28/class-schedule/releases/latest">son sürümü</a> aç.',
      s2: '<code>class-schedule.apk</code> dosyasını indir ve aç.',
      s3: 'Android sorduğunda bu kaynaktan yüklemeye izin ver.',
      installNote: 'Bunu yalnızca bir kez yaparsın. Yeni ekranlar ve ders bilgileri, telefon internete bağlandıkça kendiliğinden gelir.',
      noAndroid: 'Android telefonun yok mu? <a href="#iphone">iPhone\'una ekle</a> ya da <a href="../">tarayıcıda aç</a>.',
      ctaIphone: 'iPhone: Ana Ekrana ekle',
      ctaIphoneNote: 'Adım adım rehber',
      iosTitle: 'Beş adımda iPhone\'unda',
      iosLead: 'iPhone için APK yok. Onun yerine tarayıcı sürümünü Ana Ekran\'a ekle: kendi simgesi olur ve bir uygulama gibi açılır. Ders hatırlatıcıları yalnızca Android\'de.',
      iosPic1: 'Çizim: iPhone\'da Safari, alttaki adres çubuğunda hasankaan28.github.io',
      iosPic2: 'Çizim: Safari\'nin alt çubuğu, Paylaş düğmesi (yukarı oklu kare) vurgulanmış',
      iosPic3: 'Çizim: paylaşım menüsü, Ana Ekrana Ekle satırı vurgulanmış',
      iosPic4: 'Çizim: Ana Ekrana Ekle ekranı, Class Schedule simgesi ve adıyla; sağ üstteki Ekle vurgulanmış',
      iosPic5: 'Çizim: üzerinde Class Schedule simgesi olan bir Ana Ekran',
      ios1t: 'Safari\'de aç',
      ios1d: 'Safari\'de <a href="../">hasankaan28.github.io/class-schedule</a> adresine git. Mutlaka Safari olmalı: bağlantıyı Instagram ya da WhatsApp içinde açtıysan önce oradaki menüye dokun ve “Safari\'de aç” ya da “Tarayıcıda aç” seçeneğini seç.',
      ios2t: 'Paylaş\'a dokun',
      ios2d: 'Safari\'nin alt çubuğundaki <b>Paylaş</b> (Share) düğmesine dokun: yukarı ok çıkan kare.',
      ios3t: 'Ana Ekrana Ekle\'ye dokun',
      ios3d: 'Açılan menüde aşağı kaydır ve <b>Ana Ekrana Ekle</b> (Add to Home Screen) satırına dokun. Yok mu? Listenin sonuna kaydır, <b>Eylemleri Düzenle</b> (Edit Actions) satırına dokun ve onu ekle.',
      ios4t: 'Ekle\'ye dokun',
      ios4d: 'Adın Class Schedule olduğunu kontrol et ve sağ üstteki <b>Ekle</b> (Add) düğmesine dokun.',
      ios5t: 'Hazır',
      ios5d: 'Class Schedule simgesi artık Ana Ekran\'ında. Bir uygulama gibi tam ekran açılır.',
      iosChrome: 'iPhone\'da Chrome mu kullanıyorsun? Aynı <b>Ana Ekrana Ekle</b> seçeneği Chrome\'un Paylaş düğmesinin altında.',
      iosCopy: 'Kopyala',
      iosAddHome: 'Ana Ekrana Ekle',
      iosFind: 'Sayfada Bul',
      iosEdit: 'Eylemleri Düzenle…',
      iosCancel: 'Vazgeç',
      iosAdd: 'Ekle',
      eyFaq: 'Sorular',
      faqTitle: 'Bilmekte fayda var',
      q1: 'Bu resmi bir IUS uygulaması mı?',
      a1: 'Hayır. IUS Engineering Club\'ın resmi olmayan bir öğrenci projesi; IUS tarafından yapılmadı ve onaylanmadı. Emin olmadığında son sözü resmi program ve hocan söyler.',
      q2: 'Ders programım bir yere yükleniyor mu?',
      a2: 'Hayır. Ders programın yalnızca telefonunda ya da tarayıcında saklanır. Uygulama ders bilgilerini ve quiz listesini indirir ama derslerini hiçbir yere göndermez. Bir quiz bildirdiğinde bildirim kontrol için kulübe gider; adını yazmak isteğe bağlı.',
      q3: 'iPhone uygulaması var mı?',
      a3: 'Hayır, ama tarayıcı sürümü iPhone\'da çalışır ve onu Ana Ekran\'a ekleyip bir uygulama gibi açabilirsin: <a href="#iphone">beş adıma bak</a>. Ders hatırlatıcıları yalnızca Android\'de var.',
      q4: 'Bir saat ya da sınıf yanlış. Ne yapmalıyım?',
      a4: 'eCampus bazen geride kalır; bir tutorial\'ın saati syllabus güncellenmeden değişebilir. Dersi Dersler ekranında düzenle: kendi girdiğin saatler her zaman önceliklidir. Sonra herkes için düzeltilsin diye kulübe <a href="mailto:iusengclub@gmail.com">iusengclub@gmail.com</a> adresinden yaz.',
      q5: 'Ücretli mi?',
      a5: 'Hayır. Ücretsiz, kaynak kodu da <a href="https://github.com/HasanKaan28/class-schedule">GitHub\'da</a>.',
      eyTeam: 'Kim yaptı',
      teamTitle: 'Öğrencilerden öğrencilere',
      devRole: 'Geliştiren',
      ghProfile: 'GitHub profili',
      source: 'Kaynak kodu',
      clubLogo: 'IUS Engineering Club logosu',
      clubRole: 'Bir <span lang="en">IUS Engineering Club</span> projesi',
      contactText: 'Bir hata ya da yanlış bir saat mi buldun, aklına bir fikir mi geldi? Kulübe yaz:',
      footLine: 'Ders Programı resmi olmayan bir öğrenci projesidir. IUS tarafından yapılmamış ve onaylanmamıştır.',
      footApp: 'Uygulamayı aç'
    },
    bs: {
      docTitle: 'Raspored časova: besplatna aplikacija za studente IUS-a',
      metaDesc: 'Besplatan sedmični raspored za studente IUS-a, s podacima o predmetima iz službenog rasporeda i s eCampusa, midterm ispitima, kvizovima i podsjetnicima za časove. Neslužbeno, od IUS Engineering Cluba.',
      ogAlt: 'Raspored časova na telefonu, s rasporedom jedne primjer-sedmice',
      skip: 'Preskoči na sadržaj',
      appName: 'Raspored časova',
      navLabel: 'Dijelovi stranice',
      navFeatures: 'Mogućnosti',
      navHow: 'Kako radi',
      navScreens: 'Ekrani',
      navInstall: 'Instalacija',
      navFaq: 'Pitanja',
      langLabel: 'Jezik',
      kicker: 'Besplatno · Neslužbeno · Od <span lang="en">IUS Engineering Club</span>a',
      heroLead: 'Besplatan sedmični raspored za studente IUS-a: dodaj svoje časove jednom, a aplikacija sama popuni podatke o predmetima, midterm ispite i kvizove.',
      ctaApk: 'Preuzmi za Android',
      ctaApkNote: 'APK · Android 8 ili noviji',
      ctaWeb: 'Otvori u pregledniku',
      ctaWebNote: 'Na svakom telefonu i računaru, i na iPhoneu',
      demoFrame: 'Pregled Rasporeda časova uživo, s primjerom rasporeda',
      demoCaption: 'Prava aplikacija Raspored časova, pokrenuta s primjerom rasporeda',
      demoTitle: 'Isprobaj odmah ovdje',
      demoLead: 'Ovo je prava aplikacija s primjerom rasporeda. Ništa što ovdje uradiš se ne čuva.',
      demoFallback: 'Pregled uživo se nije mogao učitati, pa je ovo snimak ekrana.',
      demoScreen: 'Ekran',
      demoLiving: 'Žive teme',
      demoMore: 'Ostale teme',
      tabToday: 'Danas', tabWeek: 'Sedmica', tabQuizzes: 'Kvizovi', tabExams: 'Midterm ispiti', tabCourses: 'Predmeti',
      eyFeatures: 'Šta radi',
      featuresTitle: 'Cijela sedmica na jednom ekranu',
      f1t: 'Tvoj sedmični raspored',
      f1d: 'Upiši šifru predmeta, npr. CS103, i izaberi svoju sekciju. Termini i sale predavanja dolaze iz službenog IUS rasporeda, a predavači, asistenti, ECTS i konsultacije s eCampusa.',
      f2t: 'Datumi i sale midterm ispita',
      f2d: 'Datum, vrijeme i sala za svaki tvoj midterm, iz službenog rasporeda midterm ispita. U sedmici midterma ekran Danas umjesto časova prikazuje tvoje ispite.',
      f3t: 'Kvizovi od kolega',
      f3d: 'Studenti prijavljuju nadolazeće kvizove, klub provjeri svaku prijavu, a onda se kviz prikazuje svima na tom predmetu i u toj sekciji.',
      f4t: 'Podsjetnici za časove',
      f4d: 'Na Androidu: podsjetnik prije svakog časa i večernji pregled sutrašnjih časova. Oboje se uključuje u Postavkama.',
      f5t: '20 tema',
      f5d: 'Svijetle, tamne, mirne i zabavne, plus šest živih tema u kojima se kreću pčele, mačke, ribe i snijeg. Ili neka prati telefon.',
      f6t: 'Engleski, turski i bosanski',
      f6d: 'Jezik mijenjaš u Postavkama, iza zupčanika gore desno.',
      f7t: 'Radi bez interneta',
      f7d: 'Android aplikacija se otvara i bez veze, a verzija u pregledniku čuva svoju posljednju kopiju.',
      f8t: 'Raspored ostaje na tvom telefonu',
      f8d: 'Čuva se samo na telefonu ili u pregledniku i nikad se nigdje ne šalje. Bez računa, bez prijave.',
      eyHow: 'Kako radi',
      howTitle: 'Od službenog PDF-a do tvog telefona, svake noći',
      howLead: 'Niko ne kuca listu predmeta ručno. Mali program je sakuplja svake noći, a tvoj telefon preuzme rezultat.',
      r1t: 'IUS raspored (PDF) i eCampus',
      r1d: 'Službeni raspored za semestar daje termine i sale predavanja. eCampus daje linkove na syllabuse, ECTS, predavače, sekcije tutorijala i labova te konsultacije.',
      r2t: 'Noćni sakupljač na GitHub Actions',
      r2d: 'Svake noći pregleda samo predmete ovog semestra, čeka 10 sekundi između zahtjeva kako eCampus traži i sačuva promjene.',
      r3t: 'GitHub Pages',
      r3d: 'Svaka promjena sama ponovo objavi stranicu aplikacije. Sve je obični HTML, CSS i JavaScript.',
      r4t: 'Tvoj telefon',
      r4d: 'Aplikacija učita najnoviju verziju kad si na internetu i čuva kopiju za kad nisi. Tvoj raspored je sačuvan samo tu.',
      whyTitle: 'Zašto je napravljeno ovako',
      w1t: 'Časove dodaješ sam',
      w1d: 'Za čitanje rasporeda iz SIS-a trebala bi tvoja SIS lozinka. Upisati šifru i dodirnuti sekciju traje nekoliko sekundi, a lozinka ostaje tvoja.',
      w2t: 'Dva izvora, svaki za ono što najbolje zna',
      w2d: 'PDF rasporeda je najnoviji izvor za termine i sale predavanja. Polazeći od njega, sakupljač na eCampusu provjerava oko 250 predmeta umjesto 1.700.',
      w3t: 'Jedan pristojan sakupljač, a ne svaki telefon',
      w3d: 'Jedan program čita eCampus jednom noću, umjesto da ga svaki telefon pita posebno. Ako eCampus promijeni stranice, jedna popravka u sakupljaču riješi stvar za sve.',
      w4t: 'Instaliraš jednom, novosti stižu same',
      w4d: 'Android aplikacija učitava ekrane s GitHub Pagesa, pa popravke i nove funkcije stižu svima bez novog APK-a.',
      w5t: 'Otvara se i bez interneta',
      w5d: 'APK nosi vlastitu kopiju aplikacije, a raspored se čuva na telefonu, pa se ništa ne gubi kad internet nestane i vrati se.',
      w6t: 'Jedna aplikacija za Android i preglednik',
      w6d: 'Android aplikacija je tanka ljuska oko web aplikacije, pa obje rade s istim kodom, a korisnici iPhonea otvaraju verziju u pregledniku.',
      eyScreens: 'Ekrani',
      screensTitle: 'Pogledaj prije instalacije',
      screensLead: 'Pravi ekrani aplikacije, s primjerom rasporeda.',
      shotsLabel: 'Snimci ekrana, listaj vodoravno',
      altToday: 'Ekran Danas: sljedeći čas i časovi tog dana sa slobodnim pauzama između njih',
      altWeek: 'Ekran Sedmica: raspored od ponedjeljka do petka s obojenim blokovima predmeta',
      altMidterms: 'Ekran Midterm ispiti: datumi, vremena i sale studentovih midterma',
      altCourses: 'Ekran Predmeti: svaki predmet s predavačima i konsultacijama',
      altThemes: 'Postavke: izbor teme sa svim temama',
      altBee: 'Aplikacija u temi Košnica',
      altCat: 'Aplikacija u temi Mačke',
      altSpace: 'Aplikacija u temi Svemir',
      capToday: 'Danas', capWeek: 'Sedmica', capMidterms: 'Midterm ispiti', capCourses: 'Predmeti',
      capThemes: 'Izbor teme', capBee: 'Tema Košnica', capCat: 'Tema Mačke', capSpace: 'Tema Svemir',
      eyInstall: 'Instalacija',
      installTitle: 'Na Android telefonu u tri koraka',
      s1: 'Na telefonu otvori <a href="https://github.com/HasanKaan28/class-schedule/releases/latest">najnovije izdanje</a> na GitHubu.',
      s2: 'Preuzmi <code>class-schedule.apk</code> i otvori ga.',
      s3: 'Dozvoli instalaciju iz ovog izvora kad Android pita.',
      installNote: 'Ovo radiš samo jednom. Novi ekrani i podaci o predmetima stižu sami kad god je telefon na internetu.',
      noAndroid: 'Nemaš Android telefon? <a href="#iphone">Dodaj je na iPhone</a> ili <a href="../">otvori u pregledniku</a>.',
      ctaIphone: 'iPhone: dodaj na početni zaslon',
      ctaIphoneNote: 'Vodič korak po korak',
      iosTitle: 'Na iPhoneu u pet koraka',
      iosLead: 'Za iPhone nema APK-a. Umjesto toga dodaj verziju iz preglednika na početni zaslon: dobije svoju ikonu i otvara se kao aplikacija. Podsjetnici za časove postoje samo na Androidu.',
      iosPic1: 'Crtež: Safari na iPhoneu, s hasankaan28.github.io u adresnoj traci na dnu',
      iosPic2: 'Crtež: donja traka Safarija, istaknuto dugme Dijeli (kvadrat sa strelicom prema gore)',
      iosPic3: 'Crtež: lista za dijeljenje, istaknut red Dodaj na početni zaslon',
      iosPic4: 'Crtež: ekran Dodaj na početni zaslon s ikonom i imenom Class Schedule; istaknuto Dodaj gore desno',
      iosPic5: 'Crtež: početni zaslon s ikonom Class Schedule',
      ios1t: 'Otvori u Safariju',
      ios1d: 'U Safariju otvori <a href="../">hasankaan28.github.io/class-schedule</a>. Mora biti Safari: ako si link otvorio unutar Instagrama ili WhatsAppa, prvo tamo dodirni meni i izaberi „Otvori u Safariju” ili „Otvori u pregledniku”.',
      ios2t: 'Dodirni Dijeli',
      ios2d: 'Dodirni dugme <b>Dijeli</b> (Share) u donjoj traci Safarija: kvadrat sa strelicom prema gore.',
      ios3t: 'Dodirni Dodaj na početni zaslon',
      ios3d: 'U listi koja se otvori skrolaj dolje i dodirni <b>Dodaj na početni zaslon</b> (Add to Home Screen). Nema ga? Skrolaj do kraja liste, dodirni <b>Uredi radnje</b> (Edit Actions) i dodaj ga.',
      ios4t: 'Dodirni Dodaj',
      ios4d: 'Provjeri da je ime Class Schedule i dodirni <b>Dodaj</b> (Add) gore desno.',
      ios5t: 'Gotovo',
      ios5d: 'Ikona Class Schedule je sada na tvom početnom zaslonu. Otvara se preko cijelog ekrana, kao aplikacija.',
      iosChrome: 'Koristiš Chrome na iPhoneu? Isto <b>Dodaj na početni zaslon</b> nalazi se pod Chromeovim dugmetom za dijeljenje.',
      iosCopy: 'Kopiraj',
      iosAddHome: 'Dodaj na početni zaslon',
      iosFind: 'Pronađi na stranici',
      iosEdit: 'Uredi radnje…',
      iosCancel: 'Odustani',
      iosAdd: 'Dodaj',
      eyFaq: 'Pitanja',
      faqTitle: 'Dobro je znati',
      q1: 'Je li ovo službena IUS aplikacija?',
      a1: 'Ne. Ovo je neslužbeni studentski projekt IUS Engineering Cluba; IUS ga nije napravio niti odobrio. Kad nisi siguran, zadnju riječ imaju službeni raspored i tvoj profesor.',
      q2: 'Šalje li se moj raspored negdje?',
      a2: 'Ne. Raspored se čuva samo na tvom telefonu ili u pregledniku. Aplikacija preuzima podatke o predmetima i listu kvizova, ali tvoje časove nikad nigdje ne šalje. Kad prijaviš kviz, prijava ide klubu na provjeru, a ime nije obavezno.',
      q3: 'Ima li aplikacija za iPhone?',
      a3: 'Nema, ali verzija u pregledniku radi na iPhoneu, a možeš je dodati na početni zaslon da se otvara kao aplikacija: <a href="#iphone">pogledaj pet koraka</a>. Podsjetnici za časove postoje samo na Androidu.',
      q4: 'Neko vrijeme ili sala nije tačna. Šta sad?',
      a4: 'eCampus ponekad kasni; termin tutorijala se može promijeniti prije nego što se ažurira syllabus. Uredi čas u ekranu Predmeti: vremena koja sam upišeš uvijek imaju prednost. Onda javi klubu na <a href="mailto:iusengclub@gmail.com">iusengclub@gmail.com</a> da se ispravi za sve.',
      q5: 'Košta li nešto?',
      a5: 'Ne. Besplatna je, a izvorni kod je na <a href="https://github.com/HasanKaan28/class-schedule">GitHubu</a>.',
      eyTeam: 'Ko je napravio',
      teamTitle: 'Studenti za studente',
      devRole: 'Razvio',
      ghProfile: 'GitHub profil',
      source: 'Izvorni kod',
      clubLogo: 'Logo IUS Engineering Cluba',
      clubRole: 'Projekt <span lang="en">IUS Engineering Club</span>a',
      contactText: 'Našao si grešku ili pogrešno vrijeme, ili imaš ideju? Piši klubu:',
      footLine: 'Raspored časova je neslužbeni studentski projekt. IUS ga nije napravio niti odobrio.',
      footApp: 'Otvori aplikaciju'
    }
  };

  // Theme ids as the app knows them, with the app's own names and two colours (background, accent) for the swatch.
  var THEMES_LIVE = ['bee', 'cat', 'space', 'aquarium', 'snow', 'arcade'];
  var THEMES_MORE = ['light', 'dark', 'ocean', 'matcha', 'sunset', 'espresso', 'cevapi', 'coffee3am', 'panic', 'terminal', 'blueprint', 'chalkboard', 'oldpc', 'comic'];
  var SWATCH = {
    bee: ['#FFF4D2', '#8A5200'], cat: ['#221E29', '#F4A259'], space: ['#070B1A', '#6FE3FF'],
    aquarium: ['#D5EFF5', '#00687E'], snow: ['#E9F1F8', '#1D5FA8'], arcade: ['#0C0C1C', '#FFD23F'],
    light: ['#F3F5F8', '#1F5FD1'], dark: ['#0E141C', '#79AEFF'], ocean: ['#071722', '#3FD0C0'],
    matcha: ['#EEF1E4', '#2F6E24'], sunset: ['#FBEEE2', '#B23F09'], espresso: ['#1C130E', '#E0A458'],
    cevapi: ['#F2E3C6', '#A3262E'], coffee3am: ['#100D0A', '#E3A13C'], panic: ['#FAF9F4', '#C7191F'],
    terminal: ['#040A05', '#3DFF74'], blueprint: ['#0B2549', '#8EE6F7'], chalkboard: ['#1C3A2E', '#F7E27A'],
    oldpc: ['#B8B8B8', '#000080'], comic: ['#FFF1A6', '#1D4FC4']
  };
  var THEME_NAMES = {
    en: { light: 'Light', dark: 'Dark', ocean: 'Ocean', matcha: 'Matcha', sunset: 'Sunset', espresso: 'Espresso', cevapi: 'Ćevapi', coffee3am: '3 a.m.', panic: 'Exam panic', terminal: 'Terminal', blueprint: 'Blueprint', chalkboard: 'Chalkboard', oldpc: 'Old PC', comic: 'Comic Sans', bee: 'Beehive', cat: 'Cats', space: 'Space', aquarium: 'Aquarium', snow: 'Snow', arcade: 'Arcade' },
    tr: { light: 'Aydınlık', dark: 'Koyu', ocean: 'Okyanus', matcha: 'Matcha', sunset: 'Gün batımı', espresso: 'Espresso', cevapi: 'Ćevapi', coffee3am: 'Gece 3', panic: 'Vize paniği', terminal: 'Terminal', blueprint: 'Teknik resim', chalkboard: 'Kara tahta', oldpc: 'Eski bilgisayar', comic: 'Comic Sans', bee: 'Arı kovanı', cat: 'Kediler', space: 'Uzay', aquarium: 'Akvaryum', snow: 'Kar', arcade: 'Atari salonu' },
    bs: { light: 'Svijetla', dark: 'Tamna', ocean: 'Okean', matcha: 'Matcha', sunset: 'Zalazak', espresso: 'Espresso', cevapi: 'Ćevapi', coffee3am: '3 ujutro', panic: 'Ispitna panika', terminal: 'Terminal', blueprint: 'Nacrt', chalkboard: 'Školska tabla', oldpc: 'Stari računar', comic: 'Comic Sans', bee: 'Košnica', cat: 'Mačke', space: 'Svemir', aquarium: 'Akvarij', snow: 'Snijeg', arcade: 'Arkada' }
  };
  var STATUS = {
    en: function (tab, theme) { return 'Showing ' + tab + ' in the ' + theme + ' theme'; },
    tr: function (tab, theme) { return tab + ' ekranı, ' + theme + ' temasıyla'; },
    bs: function (tab, theme) { return 'Prikazano: ' + tab + ', tema ' + theme; }
  };
  var TAB_KEYS = { today: 'tabToday', week: 'tabWeek', quizzes: 'tabQuizzes', exams: 'tabExams', courses: 'tabCourses' };

  var en = {};
  var lang = 'en';
  var demo = { tab: 'today', theme: 'bee' };

  function store(get, value) {
    try {
      if (get) return localStorage.getItem(STORE_KEY);
      localStorage.setItem(STORE_KEY, value);
    } catch (e) { /* storage blocked: the choice just is not remembered */ }
    return null;
  }

  function t(key) {
    var table = TEXT[lang];
    return table && table[key] != null ? table[key] : en[key];
  }

  // Remember the English text of every marked element and attribute, once.
  function captureEnglish() {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      if (!(key in en)) en[key] = el.innerHTML.trim();
    });
    document.querySelectorAll('[data-i18n-attr]').forEach(function (el) {
      pairs(el).forEach(function (p) { if (!(p[1] in en)) en[p[1]] = el.getAttribute(p[0]); });
    });
  }

  function pairs(el) {
    return el.getAttribute('data-i18n-attr').split(';').map(function (s) {
      var i = s.indexOf(':');
      return [s.slice(0, i).trim(), s.slice(i + 1).trim()];
    });
  }

  function applyLanguage(next, save) {
    lang = LANGS.indexOf(next) >= 0 ? next : 'en';
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var value = t(el.getAttribute('data-i18n'));
      if (value != null && el.innerHTML.trim() !== value) el.innerHTML = value;
    });
    document.querySelectorAll('[data-i18n-attr]').forEach(function (el) {
      pairs(el).forEach(function (p) {
        var value = t(p[1]);
        if (value != null) el.setAttribute(p[0], value);
      });
    });
    document.querySelectorAll('.lang button').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-lang') === lang));
    });
    labelThemes();
    if (save) {
      store(false, lang);
      var url = new URL(location.href);
      if (url.searchParams.has('lang')) {
        url.searchParams.set('lang', lang);
        history.replaceState(null, '', url);
      }
      send({ lang: lang });
    }
  }

  // ---- Live demo ----
  var frame, shot, note, status, loaded = false, failed = false;

  function send(message) {
    if (!frame || !loaded || failed) return;
    message.type = 'class-schedule-demo';
    try { frame.contentWindow.postMessage(message, location.origin); } catch (e) { /* frame gone */ }
  }

  function fail() {
    if (failed) return;
    failed = true;
    frame.hidden = true;
    shot.hidden = false;
    note.hidden = false;
    // Nothing to steer in a screenshot: only the note stays.
    ['demo-ctl', 'demo-status'].forEach(function (id) { document.getElementById(id).hidden = true; });
    document.querySelector('.demo-lead').hidden = true;
  }

  function themeButton(id) {
    var b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('data-theme', id);
    b.setAttribute('aria-pressed', String(id === demo.theme));
    var sw = document.createElement('span');
    sw.className = 'sw';
    sw.setAttribute('aria-hidden', 'true');
    sw.style.setProperty('--a', SWATCH[id][0]);
    sw.style.setProperty('--b', SWATCH[id][1]);
    var label = document.createElement('span');
    label.className = 'name-' + id;
    b.appendChild(sw);
    b.appendChild(label);
    return b;
  }

  function labelThemes() {
    var names = THEME_NAMES[lang];
    document.querySelectorAll('#demo-ctl button[data-theme] span:last-child').forEach(function (s) {
      s.textContent = names[s.parentNode.getAttribute('data-theme')];
    });
  }

  function announce() {
    if (status) status.textContent = STATUS[lang](t(TAB_KEYS[demo.tab]), THEME_NAMES[lang][demo.theme]);
  }

  function setupDemo() {
    frame = document.getElementById('demo');
    shot = document.getElementById('demo-shot');
    note = document.getElementById('demo-note');
    status = document.getElementById('demo-status');
    if (!frame) return;

    var live = document.getElementById('themes-live');
    var more = document.getElementById('themes-more');
    THEMES_LIVE.forEach(function (id) { live.appendChild(themeButton(id)); });
    THEMES_MORE.forEach(function (id) { more.appendChild(themeButton(id)); });

    document.getElementById('demo-ctl').addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b || b.disabled) return;
      if (b.hasAttribute('data-tab')) {
        demo.tab = b.getAttribute('data-tab');
        document.querySelectorAll('#demo-ctl [data-tab]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        send({ tab: demo.tab });
      } else if (b.hasAttribute('data-theme')) {
        demo.theme = b.getAttribute('data-theme');
        document.querySelectorAll('#demo-ctl [data-theme]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        send({ theme: demo.theme });
      } else return;
      announce();
    });

    if (navigator.onLine === false) { fail(); return; }
    var timer = setTimeout(function () { if (!loaded) fail(); }, 15000);
    function onLoad() {
      clearTimeout(timer);
      // The frame is same-origin. A page without the app's header is an error page (offline, 404), not the app.
      try {
        var d = frame.contentDocument;
        if (d && !d.querySelector('.app-head')) { fail(); return; }
      } catch (e) { /* not readable: trust the load */ }
      loaded = true;
      send({ lang: lang, tab: demo.tab, theme: demo.theme });
    }
    frame.addEventListener('load', onLoad);
    frame.addEventListener('error', fail);
    // This script is deferred, so the frame may have finished loading before the listener existed.
    try {
      var doc = frame.contentDocument;
      if (doc && doc.readyState === 'complete' && doc.URL !== 'about:blank') onLoad();
    } catch (e) { /* cross-origin or gone: the load event decides */ }
  }

  // On an iPhone or iPad (iPadOS reports itself as a Mac with touch points) the iPhone guide comes first:
  // it moves above the Android steps, takes the earlier time slot, and its hero action becomes the primary one.
  function preferIphone() {
    var ua = navigator.userAgent || '';
    var ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    if (!ios) return;
    var iphone = document.getElementById('iphone');
    var install = document.getElementById('install');
    var slotA = install.querySelector('.slot'), slotB = iphone.querySelector('.slot');
    var first = slotA.textContent;
    slotA.textContent = slotB.textContent;
    slotB.textContent = first;
    install.parentNode.insertBefore(iphone, install);
    var cta = document.getElementById('cta-iphone');
    var apk = cta.parentNode.querySelector('.btn.primary');
    cta.classList.replace('ghost', 'primary');
    if (apk) apk.classList.replace('primary', 'ghost');
    cta.parentNode.insertBefore(cta, cta.parentNode.firstChild);
  }

  function start() {
    preferIphone();
    captureEnglish();
    var fromUrl = new URLSearchParams(location.search).get('lang');
    var initial = LANGS.indexOf(fromUrl) >= 0 ? fromUrl : store(true);
    if (LANGS.indexOf(fromUrl) >= 0) store(false, fromUrl);
    setupDemo();
    applyLanguage(initial || 'en', false);

    document.querySelector('.lang').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-lang]');
      if (b && b.getAttribute('data-lang') !== lang) {
        applyLanguage(b.getAttribute('data-lang'), true);
        announce();
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
