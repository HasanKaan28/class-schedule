# Class Schedule for IUS

A weekly class schedule for students of the International University of Sarajevo. Add your classes once, and the app fills in course names, ECTS, lecturers, assistants, e-mail addresses and office hours from IUS eCampus. Tap a class to open its syllabus on eCampus.

This is an unofficial student project. It is not made or endorsed by IUS.

- **Android**: install the APK once. New screens and course data arrive on their own whenever the phone is online.
- **Any phone or computer**: open <https://hasankaan28.github.io/class-schedule/> in a browser.
- Languages: English and Turkish (switch in the top right).

## Install on Android

1. On the phone, open the latest release: <https://github.com/HasanKaan28/class-schedule/releases/latest>
2. Download `class-schedule-<version>.apk` and open it.
3. Allow installing from this source when Android asks.

You only need to do this once.

## Using it

1. Tap **+ Add class** and type a course code, for example `CS103`. Pick the course from the list.
2. The sections listed on eCampus appear. Tap yours to fill in the type, day, time and room, or enter them yourself.
3. Optionally add your instructor's name; the app then shows their office and office hours too.
4. Repeat for each lecture, tutorial and lab.

- **Today** shows the class happening now or the next one, and the chosen day's classes with the free gaps between them.
- **Week** shows Monday to Friday (and Saturday if you have classes then).
- **Courses** lists each course with its instructors and office hours. Edit or delete classes here.

Your timetable is stored only on your phone (or in your browser). It is never uploaded.

## How the data stays current

[`tools/collect_ecampus.py`](tools/collect_ecampus.py) reads the public syllabus and office-hours pages on eCampus and writes [`web/data/courses.js`](web/data/courses.js). The [collect workflow](.github/workflows/collect.yml) runs it every Monday and commits any changes. It waits 10 seconds between requests, as eCampus's `robots.txt` asks, so a full run takes about two hours.

eCampus is sometimes out of date (a tutorial time can change before the syllabus does). Times you enter yourself always win over eCampus.

## How it is built

| Part | Where | Notes |
| --- | --- | --- |
| Web app | [`web/`](web) | Plain HTML, CSS and JavaScript. Deployed to GitHub Pages by [`pages.yml`](.github/workflows/pages.yml). A service worker keeps the last copy for offline use. |
| Android app | [`app/`](app) | One Activity with a WebView ([`MainActivity.java`](app/src/main/java/io/github/hasankaan28/classschedule/MainActivity.java)). Loads the Pages site; with no internet on first launch it opens the copy of `web/` bundled in the APK. Stores the timetable in Android's SharedPreferences so both copies see the same data. |
| APK build | [`build.yml`](.github/workflows/build.yml) | Gradle 8.10.2, Android Gradle Plugin 8.7.3, JDK 17. Android 8 (API 26) or newer. A `v*` tag publishes a GitHub release. |
| Signing | repository secrets | `SIGNING_KEYSTORE_BASE64`, `SIGNING_STORE_PASSWORD`, `SIGNING_KEY_ALIAS` (`release`). Create a key with `python tools/make_signing_key.py <path outside the repo>/release.p12` (needs the `cryptography` package). |

### Working on it

```bash
node tools/serve.js
```

Then open <http://localhost:5173>. Add `?now=2026-10-19T12:30` to the address to see the app at a specific moment. To test the collector without a two-hour run:

```bash
python tools/collect_ecampus.py --pages 1 --limit 3 --out /tmp/courses.js
```

## Design notes

| Decision | Alternative considered | Reason |
| --- | --- | --- |
| Students enter their own classes | Read schedules from SIS | SIS needs each student's login. Typing a code and tapping a section takes a few seconds. |
| Weekly collection on GitHub Actions | Each phone reads eCampus directly | One polite crawl a week instead of every phone hitting eCampus, and a site redesign only needs one fix in the collector. |
| App loads its screens from GitHub Pages | Screens bundled only in the APK | Students install once; fixes and features reach everyone without a new APK. |
| Bundled offline copy and native storage | Online only | The app opens with no connection, and the timetable is never lost when switching between copies. |
| WebView shell | Kotlin with Jetpack Compose | One code base for Android and the browser, testable in a desktop browser. |
| English default with Turkish switch | Follow the phone language | Requested. The choice is saved on the device. |

Not in this version: class reminders, a home-screen widget, sharing a timetable with friends, or exporting it.
