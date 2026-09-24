package expo.modules.mpvplayer

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.view.SurfaceHolder
import android.view.SurfaceView
import android.view.ViewGroup
import dev.jdtech.mpv.MPVLib
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView

/**
 * A libmpv video surface. Everything is driven by props from JS; state flows
 * back through events. mpv calls observers on its own thread, so events are
 * posted to the main thread before dispatch.
 */
class MpvPlayerView(context: Context, appContext: AppContext) :
  ExpoView(context, appContext), SurfaceHolder.Callback, MPVLib.EventObserver {

  private val onProgress by EventDispatcher()
  private val onStateChange by EventDispatcher()
  private val onLoad by EventDispatcher()
  private val onEnd by EventDispatcher()
  private val onError by EventDispatcher()

  private val main = Handler(Looper.getMainLooper())
  private val surface = SurfaceView(context)
  private var mpv: MPVLib? = null

  private var uri: String? = null
  private var startSeconds = 0.0
  private var fileLoaded = false
  private var pendingAid: Int? = null
  private var pendingSid: Int? = null
  private var pendingSubUrl: String? = null
  private var addedSubUrl: String? = null
  private var lastSeekNonce: Any? = null
  private var position = 0.0
  private var duration = 0.0
  private var lastProgressAt = 0L

  init {
    surface.holder.addCallback(this)
    addView(surface, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
    createPlayer()
  }

  private fun createPlayer() {
    val m = MPVLib.create(context) ?: run {
      main.post { onError(mapOf("message" to "mpv could not start on this device")) }
      return
    }
    m.setOptionString("vo", "gpu")
    m.setOptionString("gpu-context", "android")
    m.setOptionString("opengl-es", "yes")
    m.setOptionString("hwdec", "mediacodec-copy")
    m.setOptionString("hwdec-codecs", "h264,hevc,mpeg4,mpeg2video,vp8,vp9,av1")
    m.setOptionString("ao", "audiotrack,opensles")
    m.setOptionString("force-window", "no")
    m.setOptionString("idle", "yes")
    m.setOptionString("keep-open", "no")
    m.setOptionString("cache", "yes")
    m.setOptionString("demuxer-max-bytes", "64MiB")
    m.setOptionString("demuxer-max-back-bytes", "32MiB")
    m.setOptionString("sub-auto", "no")
    m.setOptionString("sub-use-margins", "yes")
    m.setOptionString("embeddedfonts", "yes")
    m.setOptionString("user-agent", "Mirefin")
    m.init()
    m.addObserver(this)
    m.observeProperty("time-pos", MPVLib.MpvFormat.MPV_FORMAT_DOUBLE)
    m.observeProperty("duration", MPVLib.MpvFormat.MPV_FORMAT_DOUBLE)
    m.observeProperty("pause", MPVLib.MpvFormat.MPV_FORMAT_FLAG)
    m.observeProperty("paused-for-cache", MPVLib.MpvFormat.MPV_FORMAT_FLAG)
    mpv = m
  }

  // --- Props -------------------------------------------------------------

  fun setSource(source: Map<String, Any?>?) {
    val next = source?.get("uri") as? String ?: return
    if (next == uri) return
    uri = next
    startSeconds = (source["startSeconds"] as? Number)?.toDouble() ?: 0.0
    fileLoaded = false
    addedSubUrl = null
    val m = mpv ?: return
    m.setPropertyString("start", if (startSeconds > 0) startSeconds.toString() else "none")
    m.command(arrayOf("loadfile", next))
  }

  fun setPaused(paused: Boolean) {
    mpv?.setPropertyBoolean("pause", paused)
  }

  fun setRate(rate: Double) {
    mpv?.setPropertyDouble("speed", rate)
  }

  fun seek(seek: Map<String, Any?>?) {
    val seconds = (seek?.get("seconds") as? Number)?.toDouble() ?: return
    val nonce = seek["nonce"]
    if (nonce == lastSeekNonce) return
    lastSeekNonce = nonce
    mpv?.command(arrayOf("seek", seconds.toString(), "absolute"))
  }

  /** mpv track ids are 1-based per type; null keeps the file's default, 0 turns it off. */
  fun setAudioTrack(id: Int?) {
    pendingAid = id
    if (fileLoaded) applyTracks()
  }

  fun setSubtitleTrack(id: Int?) {
    pendingSid = id
    if (fileLoaded) applyTracks()
  }

  fun setSubtitleUrl(url: String?) {
    pendingSubUrl = url
    if (fileLoaded) applyTracks()
  }

  fun setSubtitleStyle(style: Map<String, Any?>?) {
    val m = mpv ?: return
    style ?: return
    (style["scale"] as? Number)?.let { m.setPropertyDouble("sub-scale", it.toDouble()) }
    (style["color"] as? String)?.let { m.setPropertyString("sub-color", it) }
    (style["bold"] as? Boolean)?.let { m.setPropertyBoolean("sub-bold", it) }
    (style["marginY"] as? Number)?.let { m.setPropertyInt("sub-margin-y", it.toInt()) }
    (style["delay"] as? Number)?.let { m.setPropertyDouble("sub-delay", it.toDouble()) }
    when (style["background"] as? String) {
      "none" -> { m.setPropertyString("sub-border-style", "outline-and-shadow"); m.setPropertyDouble("sub-outline-size", 0.0); m.setPropertyDouble("sub-shadow-offset", 0.0) }
      "shadow" -> { m.setPropertyString("sub-border-style", "outline-and-shadow"); m.setPropertyDouble("sub-outline-size", 0.0); m.setPropertyDouble("sub-shadow-offset", 2.0) }
      "outline" -> { m.setPropertyString("sub-border-style", "outline-and-shadow"); m.setPropertyDouble("sub-outline-size", 2.5); m.setPropertyDouble("sub-shadow-offset", 0.0) }
      "box" -> { m.setPropertyString("sub-border-style", "opaque-box"); m.setPropertyString("sub-back-color", "#99000000") }
    }
  }

  fun setHardwareDecoding(enabled: Boolean) {
    mpv?.setPropertyString("hwdec", if (enabled) "mediacodec-copy" else "no")
  }

  private fun applyTracks() {
    val m = mpv ?: return
    pendingAid?.let { m.setPropertyString("aid", if (it <= 0) "no" else it.toString()) }
    val url = pendingSubUrl
    if (url != null) {
      if (url != addedSubUrl) {
        addedSubUrl = url
        m.command(arrayOf("sub-add", url, "select"))
      }
    } else {
      pendingSid?.let { m.setPropertyString("sid", if (it <= 0) "no" else it.toString()) }
    }
  }

  fun release() {
    main.removeCallbacksAndMessages(null)
    mpv?.let {
      it.removeObserver(this)
      it.destroy()
    }
    mpv = null
  }

  // --- Surface -----------------------------------------------------------

  override fun surfaceCreated(holder: SurfaceHolder) {
    val m = mpv ?: return
    m.attachSurface(holder.surface)
    m.setOptionString("force-window", "yes")
    m.setPropertyString("vo", "gpu")
  }

  override fun surfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) {
    mpv?.setPropertyString("android-surface-size", "${width}x$height")
  }

  override fun surfaceDestroyed(holder: SurfaceHolder) {
    val m = mpv ?: return
    m.setPropertyString("vo", "null")
    m.setOptionString("force-window", "no")
    m.detachSurface()
  }

  // --- mpv events --------------------------------------------------------

  override fun eventProperty(property: String) {}

  override fun eventProperty(property: String, value: Long) {}

  override fun eventProperty(property: String, value: Double) {
    when (property) {
      "time-pos" -> {
        position = value
        val now = System.currentTimeMillis()
        if (now - lastProgressAt >= 250) {
          lastProgressAt = now
          main.post { onProgress(mapOf("position" to position, "duration" to duration)) }
        }
      }
      "duration" -> duration = value
    }
  }

  override fun eventProperty(property: String, value: Boolean) {
    when (property) {
      "pause" -> main.post { onStateChange(mapOf("paused" to value)) }
      "paused-for-cache" -> main.post { onStateChange(mapOf("buffering" to value)) }
    }
  }

  override fun eventProperty(property: String, value: String) {}

  override fun event(eventId: Int) {
    when (eventId) {
      MPVLib.MpvEvent.MPV_EVENT_FILE_LOADED -> main.post {
        fileLoaded = true
        applyTracks()
        onLoad(mapOf("duration" to duration, "tracks" to readTracks()))
      }
      MPVLib.MpvEvent.MPV_EVENT_END_FILE -> main.post {
        // An end right after loading means mpv couldn't open the stream.
        if (!fileLoaded) onError(mapOf("message" to "mpv could not open the stream"))
        else onEnd(mapOf("position" to position, "duration" to duration))
      }
    }
  }

  private fun readTracks(): List<Map<String, Any>> {
    val m = mpv ?: return emptyList()
    val count = m.getPropertyInt("track-list/count") ?: 0
    return (0 until count).map { i ->
      mapOf(
        "id" to m.getPropertyInt("track-list/$i/id"),
        "type" to m.getPropertyString("track-list/$i/type"),
        "lang" to m.getPropertyString("track-list/$i/lang"),
        "title" to m.getPropertyString("track-list/$i/title"),
        "codec" to m.getPropertyString("track-list/$i/codec"),
        "external" to m.getPropertyBoolean("track-list/$i/external"),
      ).filterValues { it != null }.mapValues { it.value!! }
    }
  }
}
