package io.github.hasankaan28.classschedule;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.ViewGroup;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

/** Shows the schedule screens bundled in assets/. Everything works offline. */
public class MainActivity extends Activity {
    private static final String START_URL = "file:///android_asset/index.html";

    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true); // keeps the language choice
        settings.setAllowFileAccess(false);  // assets still load; nothing else on the phone is reachable
        settings.setAllowContentAccess(false);

        // Links such as mailto: open in the matching app instead of inside the WebView.
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("file".equals(uri.getScheme())) {
                    return false;
                }
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (ActivityNotFoundException ignored) {
                    // No app can open this link; stay on the schedule.
                }
                return true;
            }
        });

        // Keeps the content clear of the status and navigation bars on edge-to-edge Android versions.
        FrameLayout root = new FrameLayout(this);
        root.setFitsSystemWindows(true);
        root.addView(webView, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);

        if (savedInstanceState == null || webView.restoreState(savedInstanceState) == null) {
            webView.loadUrl(START_URL);
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
        // The page closes an open detail sheet or returns to Today first.
        webView.evaluateJavascript("window.app ? app.back() : false", handled -> {
            if (!"true".equals(handled)) {
                MainActivity.super.onBackPressed();
            }
        });
    }
}
