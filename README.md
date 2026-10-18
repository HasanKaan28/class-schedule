# Class Schedule

A small Android app with my Fall 2026–27 timetable at the International University of Sarajevo (IUS). It opens in English and has an EN/TR switch.

## Screens

- **Today**: the class happening now (with the time left) or the next one, then the chosen day's classes with the free gaps between them.
- **Week**: a Monday–Friday grid. Tap a class to see its time, room and instructors.
- **Courses**: every course with its lecture and tutorial times, ECTS, instructors, offices, office hours and notes.

The app works offline and follows the phone's light or dark setting.

## Install

1. On the phone, open the latest release: <https://github.com/HasanKaan28/class-schedule/releases/latest>
2. Download `class-schedule-<version>.apk`.
3. Open the file and allow installing from this source when Android asks.

Every release is signed with the same key, so a newer version installs over the old one.

## Updating the timetable

All timetable data is in [`app/src/main/assets/data.js`](app/src/main/assets/data.js). Interface text is in [`i18n.js`](app/src/main/assets/i18n.js).

1. Edit `data.js`.
2. Preview the screens in a desktop browser: run `node tools/serve.js` and open <http://localhost:5173>. Add `?now=2026-10-19T12:30` to the address to see the app at a specific moment.
3. Commit and push, then tag a version:

   ```bash
   git tag v1.0.1
   git push origin v1.0.1
   ```

   GitHub Actions builds the APK and attaches it to a new release.

## How it is built

- **Android shell**: one Activity with a WebView ([`MainActivity.java`](app/src/main/java/io/github/hasankaan28/classschedule/MainActivity.java)) that loads the HTML, CSS and JavaScript bundled in `assets/`. The app asks for no permissions.
- **Build**: [`.github/workflows/build.yml`](.github/workflows/build.yml) with Gradle 8.10.2, Android Gradle Plugin 8.7.3 and JDK 17. Android 8 (API 26) or newer.
- **Signing**: the workflow reads a PKCS#12 key from the repository secrets `SIGNING_KEYSTORE_BASE64`, `SIGNING_STORE_PASSWORD` and `SIGNING_KEY_ALIAS` (`release`). Without them it signs with a throwaway debug key. To make a key, run `python tools/make_signing_key.py <path outside the repo>/release.p12` (needs the `cryptography` package).
- **Local build** (optional): with JDK 17, the Android SDK and Gradle 8.10 or newer, run `gradle assembleRelease`.

## Design notes

| Decision | Alternative considered | Reason |
| --- | --- | --- |
| WebView shell around HTML screens | Kotlin with Jetpack Compose | The screens can be tested in a desktop browser, and the native part is small enough that CI builds rarely break. |
| Build on GitHub Actions | Install the JDK and Android SDK locally | Nothing to install on the PC, and every tag produces a downloadable APK. |
| Timetable bundled in the app | Download it from the web | Works offline. The timetable changes only a few times a term. |
| English by default with an in-app Turkish switch | Follow the phone's language | Requested. The choice is saved on the phone. |
| Android system fonts (Roboto, Roboto Condensed) | Bundled web fonts | Works offline with no font files to ship. |

Not in this version: class reminders, a home-screen widget, or editing the timetable inside the app.

## Data sources

The IUS student portal's weekly schedule, the course tutorial announcement, and the IUS eCampus syllabus and office-hours pages, as of 18 October 2026. Instructor contact details are the ones those pages publish.
