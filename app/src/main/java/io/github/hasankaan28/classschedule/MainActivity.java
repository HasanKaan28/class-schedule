package io.github.hasankaan28.classschedule;

import android.Manifest;
import android.app.Activity;
import android.app.NotificationManager;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

/**
 * Loads the web app from GitHub Pages so students get new screens and course data without reinstalling.
 * The site caches itself for offline use; on a first launch with no internet the copy bundled in assets/ opens.
 */
public class MainActivity extends Activity {
    private static final String SITE = "https://hasankaan28.github.io/class-schedule/";
    private static final String BUNDLED = "file:///android_asset/index.html";
    private static final int REQUEST_NOTIFICATIONS = 7;

    private WebView webView;

    /** Storage shared by the online and bundled copies, so a student's timetable is always the same. */
    private static class NativeStore {
        private final SharedPreferences prefs;

        NativeStore(SharedPreferences prefs) {
            this.prefs = prefs;
        }

        @JavascriptInterface
        public String getItem(String key) {
            return prefs.getString(key, null);
        }

        @JavascriptInterface
        public void setItem(String key, String value) {
            prefs.edit().putString(key, value).apply();
        }
    }

    /** Lets the settings screen schedule class reminders, which the WebView cannot do on its own. */
    private class NotifyBridge {
        @JavascriptInterface
        public String permission() {
            return notificationsAllowed() ? "granted" : "off";
        }

        @JavascriptInterface
        public void requestPermission() {
            runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                        && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                    requestPermissions(new String[] {Manifest.permission.POST_NOTIFICATIONS}, REQUEST_NOTIFICATIONS);
                } else {
                    reportPermission();
                }
            });
        }

        @JavascriptInterface
        public void openSettings() {
            runOnUiThread(() -> startActivity(new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                    .putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName())));
        }

        @JavascriptInterface
        public void schedule(String reminders) {
            Reminders.save(MainActivity.this, reminders);
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Reminders.createChannel(this);

        webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);  // bundled assets still load; nothing else on the phone is reachable
        settings.setAllowContentAccess(false);
        webView.addJavascriptInterface(new NativeStore(getSharedPreferences("schedule", MODE_PRIVATE)), "AndroidStore");
        webView.addJavascriptInterface(new NotifyBridge(), "AndroidNotify");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (url.startsWith(SITE) || url.startsWith("file:///android_asset/")) {
                    return false;
                }
                // eCampus syllabi, e-mail and phone links open in the matching app.
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, request.getUrl()));
                } catch (ActivityNotFoundException ignored) {
                    // No app can open this link; stay on the schedule.
                }
                return true;
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame() && request.getUrl().toString().startsWith(SITE)) {
                    view.loadUrl(BUNDLED);
                }
            }
        });

        // Keeps the content clear of the status and navigation bars on edge-to-edge Android versions.
        FrameLayout root = new FrameLayout(this);
        root.setFitsSystemWindows(true);
        root.addView(webView, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);

        if (savedInstanceState == null || webView.restoreState(savedInstanceState) == null) {
            webView.loadUrl(SITE);
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        // The student may have just allowed or blocked notifications in Android settings.
        reportPermission();
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQUEST_NOTIFICATIONS) {
            reportPermission();
        }
    }

    private boolean notificationsAllowed() {
        boolean runtime = Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU
                || checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
        return runtime && getSystemService(NotificationManager.class).areNotificationsEnabled();
    }

    private void reportPermission() {
        if (webView != null) {
            webView.evaluateJavascript(
                    "window.app && app.onNotifyPermission && app.onNotifyPermission('" + (notificationsAllowed() ? "granted" : "off") + "')",
                    null);
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        // The page closes an open form or returns to Today first.
        webView.evaluateJavascript("window.app ? app.back() : false", handled -> {
            if (!"true".equals(handled)) {
                MainActivity.super.onBackPressed();
            }
        });
    }
}
