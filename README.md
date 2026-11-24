# Class Schedule for IUS

A weekly class schedule for students of the International University of Sarajevo. Add your classes once, and the app fills in course names, ECTS, lecturers, assistants, e-mail addresses and office hours from IUS eCampus. Tap a class to open its syllabus on eCampus.

This is an unofficial student project by the [IUS Engineering Club](https://iuseng.club). It is not made or endorsed by IUS.

- **Website**: <https://hasankaan28.github.io/class-schedule/about/> explains the app, shows it live in a demo (`?demo=1`, a sample timetable that is never saved) and has install guides for Android and iPhone. Its files are in [`web/about/`](web/about).
- **Android**: install the APK once. New screens and course data arrive on their own whenever the phone is online.
- **Any phone or computer**: open <https://hasankaan28.github.io/class-schedule/> in a browser.
- Languages: English, Turkish and Bosnian (in Settings, behind the gear at the top right).
- Themes: follows the phone, or pick one in Settings: Light, Dark, four calm ones (Ocean, Matcha, Sunset, Espresso) and eight fun ones (Ćevapi, 3 a.m., Exam panic, Terminal, Blueprint, Chalkboard, Old PC, Comic Sans). Six living themes (Beehive, Cats, Space, Aquarium, Snow, Arcade) also change the shapes of buttons, cards and the tab bar and add moving things such as bees and snow; "Theme animations" in Settings switches the movement off, and it stays off when the phone asks for reduced motion. Each theme is a block of CSS variables in [`web/themes/`](web/themes).
- Android app only: a reminder before each class and an evening summary of tomorrow's classes, each switched on in Settings.

## Install on Android

1. On the phone, open the latest release: <https://github.com/HasanKaan28/class-schedule/releases/latest>
2. Download `class-schedule.apk` (the same file as `class-schedule-<version>.apk`) and open it. Direct link to the newest version: <https://github.com/HasanKaan28/class-schedule/releases/latest/download/class-schedule.apk>
3. Allow installing from this source when Android asks.

You only need to do this once.

## Using it

1. Tap **+ Add class** and type a course code, for example `CS103`. Pick the course from the list.
2. This term's sections appear: lectures from the official schedule, tutorials and labs from eCampus. Tap yours to fill in the type, day, time and room, or enter them yourself.
3. Optionally add your instructor's name; the app then shows their office and office hours too.
4. Repeat for each lecture, tutorial and lab. Double diploma courses (IATA101, ITRD101) have no weekly class hours, so the app asks only for the code; their quizzes still show.

- **Today** shows the class happening now or the next one, and the chosen day's classes with the free gaps between them.
- **Week** shows Monday to Friday (and Saturday if you have classes then).
- **Quizzes** lists upcoming quizzes for your courses and sections (or for all courses). Tap **Report a quiz** to tell the club about one; it appears for everyone once the club has checked it. Your next quizzes also show on Today.
- **Courses** lists each course with its instructors and office hours. Edit or delete classes here.
- **My grades** on each course card opens a grade calculator. Type the scores you see in SIS (the maximum is 100 unless you change it) and the sheet shows at once your weighted average so far, how much of the grade you have entered and the points earned out of 100, with the letter on the IUS grading scale. Weights come from the course's syllabus on eCampus; you can correct them, or enter them yourself when eCampus has none. Quiz scores you already typed on the Quizzes tab fill in the quiz rows. The top of Courses shows your ECTS-weighted average over the courses with a score.

Your timetable, quiz scores and grades are stored only on your phone (or in your browser). They are never uploaded. The app never reads SIS.

## Where the data comes from

- **Courses, lecture times and rooms**: the official IUS undergraduate schedule for the term (currently [Fall 2026, updated 28 September](https://www.ius.edu.ba/sites/default/files/docs/undergraduate_fall26_v02_sep_28_0745.pdf)). [`tools/import_term_schedule.py`](tools/import_term_schedule.py) turns the PDF into [`data/term-schedule.json`](data/term-schedule.json).
- **Syllabus link, ECTS, lecturers, assistants, tutorial and lab sections, office hours, assessment weights**: IUS eCampus. [`tools/collect_ecampus.py`](tools/collect_ecampus.py) looks up only this term's courses, waiting 10 seconds between requests as eCampus's `robots.txt` asks, and writes [`web/data/courses.js`](web/data/courses.js). The [collect workflow](.github/workflows/collect.yml) runs it every night and commits any changes, which redeploys the site.

- **Assessment weights**: the "Assessment Methods and Criteria" part of each syllabus, stored as `assess: [[name, weight %, count], ...]` per course (for CS103: `["Quizzes", 20, 2]` is two quizzes sharing 20%). Courses whose syllabus has no such part get no `assess`, and weights are kept as written even when they do not add up to 100.
- **Letter grades**: the "IUS Grading System" table printed on every eCampus syllabus, for example [CS103](https://ecampus.ius.edu.ba/syllabus/cs103-introduction-programming): 95–100 A, 85–94 A-, 80–84 B+, 75–79 B, 70–74 B-, 65–69 C+, 55–64 C, 45–54 E, 0–44 F.

eCampus is sometimes out of date (a tutorial time can change before the syllabus does). Times you enter yourself always win.

### New term or updated schedule

1. Download the new schedule PDF from <https://www.ius.edu.ba/en/course-exam-schedules>.
2. Convert it (needs `pip install pypdf`):

   ```bash
   python tools/import_term_schedule.py schedule.pdf --term "Spring 2026-27" --source <pdf url> --updated 2027-02-10
   python tools/collect_ecampus.py --offline
   ```

3. Commit and push. The site updates right away; the nightly run adds the eCampus details.

## How it is built

| Part | Where | Notes |
| --- | --- | --- |
| Web app | [`web/`](web) | Plain HTML, CSS and JavaScript. Deployed to GitHub Pages by [`pages.yml`](.github/workflows/pages.yml). A service worker keeps the last copy for offline use. |
| Android app | [`app/`](app) | One Activity with a WebView ([`MainActivity.java`](app/src/main/java/io/github/hasankaan28/classschedule/MainActivity.java)). Loads the Pages site; with no internet on first launch it opens the copy of `web/` bundled in the APK. Stores the timetable in Android's SharedPreferences so both copies see the same data. |
| Quizzes | [IUS Engineering Club portal](https://iuseng.club) | `GET /api/quizzes` returns approved upcoming quizzes; `POST /api/quiz-reports` sends a student's report for review (a random per-device id limits spam, and the reporter's name is optional). The app keeps the last list for offline use. |
| Reminders | [`Reminders.java`](app/src/main/java/io/github/hasankaan28/classschedule/Reminders.java) | The web app builds a weekly list of notifications (day, time, title, text) in the chosen language and hands it to the app through a JavaScript bridge. The app sets an alarm for each, posts it on the "Class reminders" channel, re-arms it for the next week, and re-arms everything after a reboot, an app update or a clock change. Asks for notification permission (Android 13+) when a reminder is switched on. |
| APK build | [`build.yml`](.github/workflows/build.yml) | Gradle 8.10.2, Android Gradle Plugin 8.7.3, JDK 17. Android 8 (API 26) or newer. A `v*` tag publishes a GitHub release. |
| Signing | repository secrets | `SIGNING_KEYSTORE_BASE64`, `SIGNING_STORE_PASSWORD`, `SIGNING_KEY_ALIAS` (`release`). Create a key with `python tools/make_signing_key.py <path outside the repo>/release.p12` (needs the `cryptography` package). |

### Working on it

```bash
node tools/serve.js
```

Then open <http://localhost:5173>. Add `?now=2026-10-19T12:30` to the address to see the app at a specific moment. To test the collector without a two-hour run:

```bash
python tools/collect_ecampus.py --pages 1 --limit 3 --out build/test-courses.js
```

## Design notes

| Decision | Alternative considered | Reason |
| --- | --- | --- |
| Students enter their own classes | Read schedules from SIS | SIS needs each student's login. Typing a code and tapping a section takes a few seconds. |
| Students type their own scores | Read grades from SIS | Same reason: SIS needs a login. The weights are public on eCampus, so only the scores are typed, and they never leave the phone. |
| Official term schedule for lectures, eCampus for the rest | Everything from eCampus | The schedule PDF is the most current source for lecture times and rooms, and limits the eCampus lookups to about 250 courses instead of 1,700. |
| Collection on GitHub Actions | Each phone reads eCampus directly | One polite crawler instead of every phone hitting eCampus, and a site redesign only needs one fix in the collector. |
| App loads its screens from GitHub Pages | Screens bundled only in the APK | Students install once; fixes and features reach everyone without a new APK. |
| Bundled offline copy and native storage | Online only | The app opens with no connection, and the timetable is never lost when switching between copies. |
| WebView shell | Kotlin with Jetpack Compose | One code base for Android and the browser, testable in a desktop browser. |
| English default with a Turkish and Bosnian switch | Follow the phone language | Requested. The choice is saved on the device. |

Not in this version: a home-screen widget, sharing a timetable with friends, exporting it, or reminders in the browser version (GitHub Pages has no server to send them).
