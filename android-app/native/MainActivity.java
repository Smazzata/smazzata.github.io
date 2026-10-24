package it.smazzata.app;

import android.os.Bundle;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private boolean backPending = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // AndroidX gestisce sia il pulsante sia il gesto Indietro dei nuovi Android.
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (backPending) return;
                WebView web = getBridge() == null ? null : getBridge().getWebView();
                if (web == null) {
                    moveTaskToBack(true);
                    return;
                }
                backPending = true;
                // Funziona anche sul server remoto: nessuna API nativa esposta alla pagina.
                web.evaluateJavascript(
                    "(() => { try { if (typeof window.smazzataBack === 'function') " +
                    "return window.smazzataBack() ? 'handled' : 'home'; } catch (_) {} " +
                    "return 'unavailable'; })()",
                    result -> {
                        backPending = false;
                        if (isFinishing() || isDestroyed()) return;
                        if ("\"handled\"".equals(result)) return;
                        if ("\"home\"".equals(result)) {
                            moveTaskToBack(true);
                        } else if (web.canGoBack()) {
                            web.goBack();
                        } else {
                            moveTaskToBack(true);
                        }
                    }
                );
            }
        });
    }
}
