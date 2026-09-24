import React, { useEffect, useRef } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { useEventListener } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import type { VLCPlayerProps } from 'react-native-vlc-media-player';
import { MpvPlayerView, MpvSubtitleStyle } from '../../../modules/mpv-player';
import type { SubtitleDelivery } from '@/lib/playback';

export interface EngineProps {
  uri: string;
  headers: Record<string, string>;
  isHls: boolean;
  startSeconds: number;
  paused: boolean;
  rate: number;
  seek?: { seconds: number; nonce: number };
  audioOrder: number;
  subtitle: SubtitleDelivery;
  subtitleStyle: MpvSubtitleStyle;
  hardwareDecoding: boolean;
  title?: string;
  artist?: string;
  onProgress: (position: number, duration: number) => void;
  onReady: () => void;
  onPausedChange: (paused: boolean) => void;
  onBuffering: (buffering: boolean) => void;
  onEnd: () => void;
  onError: (message: string) => void;
}

/* ---------------- ExoPlayer / AVPlayer ---------------- */

export function NativeEngine(p: EngineProps) {
  const player = useVideoPlayer(null, (pl) => {
    pl.timeUpdateEventInterval = 0.25;
    pl.staysActiveInBackground = false;
  });
  const started = useRef(false);

  useEffect(() => {
    started.current = false;
    player
      .replaceAsync({
        uri: p.uri,
        headers: p.headers,
        contentType: p.isHls ? 'hls' : undefined,
        metadata: { title: p.title, artist: p.artist },
      })
      .then(() => player.play())
      .catch((e) => p.onError(e instanceof Error ? e.message : String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.uri]);

  useEffect(() => {
    if (!started.current) return;
    if (p.paused) player.pause();
    else player.play();
  }, [p.paused, player]);

  useEffect(() => {
    player.playbackRate = p.rate;
  }, [p.rate, player]);

  useEffect(() => {
    if (p.seek) player.currentTime = p.seek.seconds;
  }, [p.seek, player]);

  useEffect(() => {
    const tracks = player.availableAudioTracks;
    if (started.current && tracks?.[p.audioOrder]) player.audioTrack = tracks[p.audioOrder];
  }, [p.audioOrder, player]);

  useEventListener(player, 'statusChange', ({ status, error }) => {
    if (status === 'readyToPlay' && !started.current) {
      started.current = true;
      if (p.startSeconds > 0) player.currentTime = p.startSeconds;
      // Subtitles are drawn by the app; keep the player's own track off.
      player.subtitleTrack = null;
      const tracks = player.availableAudioTracks;
      if (p.audioOrder > 0 && tracks?.[p.audioOrder]) player.audioTrack = tracks[p.audioOrder];
      p.onReady();
    } else if (status === 'loading') {
      p.onBuffering(true);
    } else if (status === 'readyToPlay') {
      p.onBuffering(false);
    } else if (status === 'error') {
      p.onError(error?.message ?? 'Playback failed');
    }
  });
  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    if (started.current) p.onProgress(currentTime, player.duration);
  });
  useEventListener(player, 'playingChange', ({ isPlaying }) => p.onPausedChange(!isPlaying));
  useEventListener(player, 'playToEnd', () => p.onEnd());

  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="contain"
      nativeControls={false}
      allowsPictureInPicture
    />
  );
}

/* ---------------- mpv (Android) ---------------- */

export function MpvEngine(p: EngineProps) {
  if (!MpvPlayerView) return null;
  const sub = p.subtitle;
  return (
    <MpvPlayerView
      style={StyleSheet.absoluteFill}
      source={{ uri: p.uri, startSeconds: p.startSeconds }}
      paused={p.paused}
      rate={p.rate}
      seek={p.seek}
      audioTrack={p.audioOrder + 1}
      subtitleTrack={sub.kind === 'embedded' ? sub.order + 1 : 0}
      subtitleUrl={sub.kind === 'external' ? sub.url : undefined}
      subtitleStyle={p.subtitleStyle}
      hardwareDecoding={p.hardwareDecoding}
      onLoad={() => p.onReady()}
      onProgress={(e) => p.onProgress(e.nativeEvent.position, e.nativeEvent.duration)}
      onStateChange={(e) => {
        if (e.nativeEvent.paused !== undefined) p.onPausedChange(e.nativeEvent.paused);
        if (e.nativeEvent.buffering !== undefined) p.onBuffering(e.nativeEvent.buffering);
      }}
      onEnd={() => p.onEnd()}
      onError={(e) => p.onError(e.nativeEvent.message)}
    />
  );
}

/* ---------------- VLC (iOS) ---------------- */

// Imported lazily: the package is only linked on iOS.
const VLCPlayer: React.ComponentType<VLCPlayerProps> | null =
  Platform.OS === 'ios' ? require('react-native-vlc-media-player/VLCPlayer').default : null;

export function VlcEngine(p: EngineProps) {
  const duration = useRef(0);
  const tracks = useRef<{ audio: number[]; text: number[] }>({ audio: [], text: [] });
  const [ids, setIds] = React.useState<{ audio?: number; text?: number }>({});

  // VLC selects tracks by its own ids; map our "nth track" orders onto them.
  useEffect(() => {
    const sub = p.subtitle;
    setIds({
      audio: tracks.current.audio[p.audioOrder],
      text: sub.kind === 'embedded' ? tracks.current.text[sub.order] : sub.kind === 'none' ? -1 : undefined,
    });
  }, [p.audioOrder, p.subtitle]);

  if (!VLCPlayer) return null;
  const scale = (p.subtitleStyle.scale ?? 1) * 100;
  return (
    <VLCPlayer
      style={StyleSheet.absoluteFill}
      source={{
        uri: p.uri,
        initType: 2,
        initOptions: [
          '--network-caching=1500',
          `--start-time=${Math.floor(p.startSeconds)}`,
          `--sub-text-scale=${Math.round(scale)}`,
          p.subtitleStyle.bold ? '--freetype-bold' : '--no-freetype-bold',
          p.hardwareDecoding ? '--codec=videotoolbox,avcodec' : '--codec=avcodec',
        ],
      }}
      autoplay
      paused={p.paused}
      rate={p.rate}
      seek={p.seek && duration.current ? p.seek.seconds / duration.current : undefined}
      audioTrack={ids.audio}
      textTrack={ids.text}
      subtitleUri={p.subtitle.kind === 'external' ? p.subtitle.url : undefined}
      resizeMode="contain"
      onLoad={(info) => {
        duration.current = info.duration / 1000;
        tracks.current = {
          audio: info.audioTracks.filter((t) => t.id >= 0).map((t) => t.id),
          text: info.textTracks.filter((t) => t.id >= 0).map((t) => t.id),
        };
        const sub = p.subtitle;
        setIds({
          audio: tracks.current.audio[p.audioOrder],
          text: sub.kind === 'embedded' ? tracks.current.text[sub.order] : sub.kind === 'none' ? -1 : undefined,
        });
        p.onReady();
      }}
      onProgress={(e) => {
        duration.current = e.duration / 1000;
        p.onProgress(e.currentTime / 1000, e.duration / 1000);
      }}
      onPlaying={() => p.onPausedChange(false)}
      onPaused={() => p.onPausedChange(true)}
      onBuffering={() => p.onBuffering(true)}
      onEnd={() => p.onEnd()}
      onError={() => p.onError('VLC could not play this stream')}
    />
  );
}

export function Engine(props: EngineProps & { engine: 'native' | 'mpv' | 'vlc' }) {
  const { engine, ...rest } = props;
  if (engine === 'mpv') return <MpvEngine {...rest} />;
  if (engine === 'vlc') return <VlcEngine {...rest} />;
  return <NativeEngine {...rest} />;
}
