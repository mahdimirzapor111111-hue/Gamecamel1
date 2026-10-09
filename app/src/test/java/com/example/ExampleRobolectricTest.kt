package com.example

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [36])
class ExampleRobolectricTest {

  @Test
  fun `read string from context`() {
    val context = ApplicationProvider.getApplicationContext<Context>()
    val appName = context.getString(R.string.app_name)
    assertEquals("نبرد پادشاهان", appName)
  }

  @Test
  fun `test asset loader interception`() {
    val context = ApplicationProvider.getApplicationContext<Context>()
    val assetLoader = androidx.webkit.WebViewAssetLoader.Builder()
        .addPathHandler("/assets/", androidx.webkit.WebViewAssetLoader.AssetsPathHandler(context))
        .build()

    val htmlUri = android.net.Uri.parse("https://appassets.androidplatform.net/assets/index.html")
    val htmlResponse = assetLoader.shouldInterceptRequest(htmlUri)
    println("htmlResponse: $htmlResponse")

    val jsUri = android.net.Uri.parse("https://appassets.androidplatform.net/assets/assets/index-WA3TFXYh.js")
    val jsResponse = assetLoader.shouldInterceptRequest(jsUri)
    println("jsResponse: $jsResponse")

    val syncUri = android.net.Uri.parse("https://appassets.androidplatform.net/assets/assets/github-cloud-sync.js")
    val syncResponse = assetLoader.shouldInterceptRequest(syncUri)
    println("syncResponse: $syncResponse")

    org.junit.Assert.assertNotNull(htmlResponse)
    org.junit.Assert.assertNotNull(jsResponse)
    org.junit.Assert.assertNotNull(syncResponse)
  }
}
