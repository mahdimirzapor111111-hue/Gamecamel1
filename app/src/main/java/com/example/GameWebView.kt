package com.example

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Bitmap
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Log
import android.view.View
import android.view.ViewGroup
import android.webkit.ConsoleMessage
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.webkit.WebViewAssetLoader
import com.example.ui.theme.PersianDarkBg
import com.example.ui.theme.PersianGold
import kotlinx.coroutines.delay

class AndroidGameBridge(
    private val context: Context,
    private val isTablet: Boolean,
    private val bottomInsetDp: Float = 0f
) {
    private val gitHubService = GitHubStorageService(context)

    @JavascriptInterface
    fun vibrate(durationMs: Long) {
        try {
            val safeMs = durationMs.coerceIn(10L, 500L)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vibratorManager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
                vibratorManager?.defaultVibrator?.vibrate(
                    VibrationEffect.createOneShot(safeMs, VibrationEffect.DEFAULT_AMPLITUDE)
                )
            } else {
                @Suppress("DEPRECATION")
                val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
                @Suppress("DEPRECATION")
                vibrator?.vibrate(safeMs)
            }
        } catch (e: Exception) {
            Log.e("AndroidGameBridge", "Vibrate error", e)
        }
    }

    @JavascriptInterface
    fun isTablet(): Boolean = isTablet

    @JavascriptInterface
    fun getDeviceType(): String = if (isTablet) "tablet" else "phone"

    @JavascriptInterface
    fun getBottomInsetDp(): Float = bottomInsetDp

    @JavascriptInterface
    fun log(msg: String) {
        Log.d("NabardKingsBridge", msg)
    }

    @JavascriptInterface
    fun githubSave(filePath: String, jsonContent: String, message: String): String {
        return try {
            val success = gitHubService.saveJsonFile(filePath, jsonContent, message)
            org.json.JSONObject().apply {
                put("success", success)
                put("filePath", filePath)
            }.toString()
        } catch (e: Exception) {
            org.json.JSONObject().apply {
                put("success", false)
                put("error", e.message ?: "Save error")
            }.toString()
        }
    }

    @JavascriptInterface
    fun githubSaveAsync(filePath: String, jsonContent: String, message: String) {
        try {
            gitHubService.saveJsonFileAsync(filePath, jsonContent, message)
        } catch (e: Exception) {
            Log.w("AndroidGameBridge", "githubSaveAsync error: ${e.message}")
        }
    }

    @JavascriptInterface
    fun githubGet(filePath: String): String {
        return try {
            val content = gitHubService.getFileContent(filePath)
            if (content != null) {
                org.json.JSONObject().apply {
                    put("success", true)
                    put("data", content)
                }.toString()
            } else {
                org.json.JSONObject().apply {
                    put("success", false)
                    put("error", "File not found or empty")
                }.toString()
            }
        } catch (e: Exception) {
            org.json.JSONObject().apply {
                put("success", false)
                put("error", e.message ?: "Fetch error")
            }.toString()
        }
    }

    @JavascriptInterface
    fun githubCalculateHash(input: String): String {
        return gitHubService.calculateSha256(input)
    }

    @JavascriptInterface
    fun getGitHubConfig(): String {
        return org.json.JSONObject().apply {
            put("owner", gitHubService.owner)
            put("repo", gitHubService.repo)
            put("branch", gitHubService.branch)
            put("hasToken", gitHubService.token.isNotEmpty())
        }.toString()
    }

    @JavascriptInterface
    fun githubDelete(filePath: String, message: String): Boolean {
        return gitHubService.deleteFile(filePath, message)
    }

    @JavascriptInterface
    fun githubList(dirPath: String): String {
        return gitHubService.listDirectory(dirPath) ?: "[]"
    }

    @JavascriptInterface
    fun setGitHubConfig(newOwner: String, newRepo: String, newBranch: String, newToken: String): Boolean {
        if (newOwner.isNotBlank()) gitHubService.owner = newOwner.trim()
        if (newRepo.isNotBlank()) gitHubService.repo = newRepo.trim()
        if (newBranch.isNotBlank()) gitHubService.branch = newBranch.trim()
        if (newToken.isNotBlank()) gitHubService.token = newToken.trim()
        return true
    }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun GameScreen(
    modifier: Modifier = Modifier,
    onExitApp: () -> Unit = {}
) {
    val context = LocalContext.current
    val configuration = LocalConfiguration.current
    val density = LocalDensity.current
    val isTablet = configuration.screenWidthDp >= 600

    // Measure system navigation bars inset so Android back/home buttons never overlay game UI
    val navInsets = WindowInsets.navigationBars.asPaddingValues()
    val bottomInsetDp = navInsets.calculateBottomPadding().value

    var webViewInstance by remember { mutableStateOf<WebView?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    var loadProgress by remember { mutableFloatStateOf(0.1f) }

    // Fast loading safety timeout: max 1.0s
    LaunchedEffect(Unit) {
        delay(1000)
        isLoading = false
    }

    // Android Hardware / Gesture Back Press Handler
    BackHandler(enabled = true) {
        val wv = webViewInstance
        if (wv != null) {
            wv.evaluateJavascript("window.handleAndroidBack ? window.handleAndroidBack() : false") { result ->
                val handled = result?.trim('"', '\'') == "true"
                if (!handled) {
                    if (wv.canGoBack()) {
                        wv.goBack()
                    } else {
                        onExitApp()
                    }
                }
            }
        } else {
            onExitApp()
        }
    }

    // Root container with background color matching the game theme
    Box(
        modifier = modifier
            .fillMaxSize()
            .background(PersianDarkBg)
            // Critical: Apply safeDrawing padding to guarantee Android navigation buttons
            // (Back, Home, Recent apps) and status bars do NOT overlap game UI elements!
            .windowInsetsPadding(WindowInsets.safeDrawing)
            .testTag("game_screen_root"),
        contentAlignment = Alignment.Center
    ) {
        // Adaptive container: on tablets, max-width keeps cards and board in balanced ergonomic proportions
        BoxWithConstraints(
            modifier = Modifier
                .fillMaxSize()
                .widthIn(max = if (isTablet) 960.dp else 600.dp)
        ) {
            AndroidView(
                modifier = Modifier
                    .fillMaxSize()
                    .testTag("game_webview"),
                factory = { ctx ->
                    val assetLoader = WebViewAssetLoader.Builder()
                        .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(ctx))
                        .build()

                    WebView(ctx).apply {
                        layoutParams = ViewGroup.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT,
                            ViewGroup.LayoutParams.MATCH_PARENT
                        )

                        setBackgroundColor(0xFF120B08.toInt())
                        overScrollMode = View.OVER_SCROLL_NEVER
                        isVerticalScrollBarEnabled = false
                        isHorizontalScrollBarEnabled = false

                        settings.apply {
                            javaScriptEnabled = true
                            domStorageEnabled = true
                            databaseEnabled = true
                            mediaPlaybackRequiresUserGesture = false
                            allowFileAccess = true
                            allowContentAccess = true
                            @Suppress("DEPRECATION")
                            allowFileAccessFromFileURLs = true
                            @Suppress("DEPRECATION")
                            allowUniversalAccessFromFileURLs = true
                            useWideViewPort = true
                            loadWithOverviewMode = true
                            cacheMode = WebSettings.LOAD_DEFAULT
                            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                            textZoom = 100
                            builtInZoomControls = false
                            displayZoomControls = false
                            setSupportZoom(false)
                            defaultTextEncodingName = "utf-8"
                        }

                        addJavascriptInterface(
                            AndroidGameBridge(ctx, isTablet, bottomInsetDp),
                            "AndroidBridge"
                        )

                        var hasTriedFallback = false

                        webViewClient = object : WebViewClient() {
                            override fun shouldInterceptRequest(
                                view: WebView,
                                request: WebResourceRequest
                            ): WebResourceResponse? {
                                return assetLoader.shouldInterceptRequest(request.url)
                            }

                            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                                super.onPageStarted(view, url, favicon)
                                loadProgress = 0.35f
                            }

                            override fun onPageFinished(view: WebView?, url: String?) {
                                super.onPageFinished(view, url)
                                isLoading = false
                                val deviceClass = if (isTablet) "tablet-layout" else "phone-layout"
                                view?.evaluateJavascript(
                                    """
                                    (function() {
                                        document.documentElement.classList.add('$deviceClass');
                                        document.body.style.backgroundColor = '#120b08';
                                    })();
                                    """.trimIndent(),
                                    null
                                )
                            }

                            override fun onReceivedError(
                                view: WebView?,
                                request: WebResourceRequest?,
                                error: WebResourceError?
                            ) {
                                super.onReceivedError(view, request, error)
                                if (request?.isForMainFrame == true && !hasTriedFallback) {
                                    hasTriedFallback = true
                                    Log.w("GameWebView", "AssetLoader error: ${error?.description}, falling back to file URL")
                                    view?.loadUrl("file:///android_asset/index.html")
                                }
                            }

                            override fun onRenderProcessGone(
                                view: WebView?,
                                detail: android.webkit.RenderProcessGoneDetail?
                            ): Boolean {
                                Log.w("GameWebView", "Render process gone: didCrash=${detail?.didCrash()}")
                                view?.loadUrl("https://appassets.androidplatform.net/assets/index.html")
                                return true
                            }
                        }

                        webChromeClient = object : WebChromeClient() {
                            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                                loadProgress = (newProgress / 100f).coerceIn(0.1f, 1f)
                                if (newProgress >= 85) {
                                    isLoading = false
                                }
                            }

                            override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
                                Log.d("NabardKingsWebView", "[JS] ${consoleMessage?.message()}")
                                return true
                            }
                        }

                        loadUrl("https://appassets.androidplatform.net/assets/index.html")
                        webViewInstance = this
                    }
                },
                update = { view ->
                    webViewInstance = view
                }
            )

            // Polished loading overlay
            AnimatedVisibility(
                visible = isLoading,
                enter = fadeIn(),
                exit = fadeOut(),
                modifier = Modifier.fillMaxSize()
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(PersianDarkBg),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center,
                        modifier = Modifier.padding(24.dp)
                    ) {
                        Text(
                            text = "⚔️ نبرد پادشاهان 👑",
                            color = PersianGold,
                            fontSize = if (isTablet) 28.sp else 22.sp,
                            fontWeight = FontWeight.Bold,
                            textAlign = TextAlign.Center
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(
                            text = "بازی استراتژیک اساطیر شاهنامه",
                            color = Color(0xFFD6D3D1),
                            fontSize = if (isTablet) 18.sp else 14.sp,
                            textAlign = TextAlign.Center
                        )
                        Spacer(modifier = Modifier.height(24.dp))
                        CircularProgressIndicator(
                            progress = { loadProgress },
                            modifier = Modifier.size(52.dp),
                            color = PersianGold,
                            trackColor = Color(0xFF3E2723)
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            text = "آماده‌سازی میدان نبرد...",
                            color = Color(0xFFA8A29E),
                            fontSize = 12.sp
                        )
                    }
                }
            }
        }
    }

    DisposableEffect(Unit) {
        onDispose {
            webViewInstance?.destroy()
        }
    }
}
