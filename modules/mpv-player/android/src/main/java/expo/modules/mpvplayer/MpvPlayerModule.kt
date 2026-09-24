package expo.modules.mpvplayer

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class MpvPlayerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("MpvPlayer")

    View(MpvPlayerView::class) {
      Events("onProgress", "onStateChange", "onLoad", "onEnd", "onError")

      Prop("source") { view: MpvPlayerView, source: Map<String, Any?>? ->
        view.setSource(source)
      }
      Prop("paused") { view: MpvPlayerView, paused: Boolean? ->
        view.setPaused(paused ?: false)
      }
      Prop("rate") { view: MpvPlayerView, rate: Double? ->
        view.setRate(rate ?: 1.0)
      }
      Prop("seek") { view: MpvPlayerView, seek: Map<String, Any?>? ->
        view.seek(seek)
      }
      Prop("audioTrack") { view: MpvPlayerView, id: Int? ->
        view.setAudioTrack(id)
      }
      Prop("subtitleTrack") { view: MpvPlayerView, id: Int? ->
        view.setSubtitleTrack(id)
      }
      Prop("subtitleUrl") { view: MpvPlayerView, url: String? ->
        view.setSubtitleUrl(url)
      }
      Prop("subtitleStyle") { view: MpvPlayerView, style: Map<String, Any?>? ->
        view.setSubtitleStyle(style)
      }
      Prop("hardwareDecoding") { view: MpvPlayerView, enabled: Boolean? ->
        view.setHardwareDecoding(enabled ?: true)
      }

      OnViewDestroys { view: MpvPlayerView -> view.release() }
    }
  }
}
