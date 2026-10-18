plugins {
    id("com.android.application")
}

// Release signing comes from CI secrets (see README). Without them the release build uses the debug key.
val signingStoreFile: String? = System.getenv("SIGNING_STORE_FILE")

android {
    namespace = "io.github.hasankaan28.classschedule"
    compileSdk = 35

    defaultConfig {
        applicationId = "io.github.hasankaan28.classschedule"
        minSdk = 26
        targetSdk = 35
        versionCode = (System.getenv("GITHUB_RUN_NUMBER") ?: "1").toInt()
        versionName = System.getenv("VERSION_NAME") ?: "0.0.0-dev"
    }

    signingConfigs {
        create("release") {
            if (signingStoreFile != null) {
                storeFile = file(signingStoreFile)
                storeType = "pkcs12"
                storePassword = System.getenv("SIGNING_STORE_PASSWORD")
                keyAlias = System.getenv("SIGNING_KEY_ALIAS")
                keyPassword = System.getenv("SIGNING_STORE_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName(if (signingStoreFile != null) "release" else "debug")
        }
    }

    // The web app in ../web is bundled as the offline fallback.
    sourceSets["main"].assets.setSrcDirs(listOf("../web"))

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    // Not published on Google Play, so the Play-specific target SDK deadline checks don't apply.
    lint {
        checkReleaseBuilds = false
    }
}
