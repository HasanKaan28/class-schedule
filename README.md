# Class Schedule for IUS

A weekly class schedule for students of the International University of Sarajevo. Add your classes once, and the app fills in course names, ECTS, lecturers, assistants, e-mail addresses and office hours from IUS eCampus. Tap a class to open its syllabus on eCampus.

This is an unofficial student project by the [IUS Engineering Club](https://iusengclub.vercel.app). It is not made or endorsed by IUS.

- **Android**: install the APK once. New screens and course data arrive on their own whenever the phone is online.
- **Any phone or computer**: open <https://hasankaan28.github.io/class-schedule/> in a browser.
- Languages: English, Turkish and Bosnian (in Settings, behind the gear at the top right).
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
4. Repeat for each lecture, tutorial and lab.

- **Today** shows the class happening now or the next one, and the chosen day's classes with the free gaps between them.
- **Week** shows Monday to Friday (and Saturday if you have classes then).
- **Courses** lists each course with its instructors and office hours. Edit or delete classes here.

Your timetable is stored only on your phone (or in your browser). It is never uploaded.

## Where the data comes from

- **Courses, lecture times and rooms**: the official IUS undergraduate schedule for the term (currently [Fall 2026, updated 28 September](https://www.ius.edu.ba/sites/default/files/docs/undergraduate_fall26_v02_sep_28_0745.pdf)). [`tools/import_term_schedule.py`](tools/import_term_schedule.py) turns the PDF into [`data/term-schedule.json`](data/term-schedule.json).
- **Syllabus link, ECTS, lecturers, assistants, tutorial and lab sections, office hours**: IUS eCampus. [`tools/collect_ecampus.py`](tools/collect_ecampus.py) looks up only this term's courses, waiting 10 seconds between requests as eCampus's `robots.txt` asks, and writes [`web/data/courses.js`](web/data/courses.js). The [collect workflow](.github/workflows/collect.yml) runs it every night and commits any changes, which redeploys the site.

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
| Official term schedule for lectures, eCampus for the rest | Everything from eCampus | The schedule PDF is the most current source for lecture times and rooms, and limits the eCampus lookups to about 250 courses instead of 1,700. |
| Collection on GitHub Actions | Each phone reads eCampus directly | One polite crawler instead of every phone hitting eCampus, and a site redesign only needs one fix in the collector. |
| App loads its screens from GitHub Pages | Screens bundled only in the APK | Students install once; fixes and features reach everyone without a new APK. |
| Bundled offline copy and native storage | Online only | The app opens with no connection, and the timetable is never lost when switching between copies. |
| WebView shell | Kotlin with Jetpack Compose | One code base for Android and the browser, testable in a desktop browser. |
| English default with a Turkish and Bosnian switch | Follow the phone language | Requested. The choice is saved on the device. |

Not in this version: a home-screen widget, sharing a timetable with friends, exporting it, or reminders in the browser version (GitHub Pages has no server to send them).
