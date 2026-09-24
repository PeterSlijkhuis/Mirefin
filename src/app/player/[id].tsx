import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEventListener } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BaseItem, episodeLabel, MediaSource, PlaybackReport, TICKS_PER_SECOND } from '@/api/jellyfin';
import { buildDeviceProfile } from '@/api/deviceProfile';
import { useClient } from '@/lib/session';
import { colors, spacing } from '@/lib/theme';

const PROGRESS_INTERVAL_MS = 10_000;

interface Prepared {
  item: BaseItem;
  source: MediaSource;
  playSessionId: string;
  uri: string;
  method: PlaybackReport['PlayMethod'];
}

export default function Player() {
  const client = useClient();
  const insets = useSafeAreaInsets();
  const { id, start } = useLocalSearchParams<{ id: string; start?: string }>();
  const startTicks = Number(start ?? 0) || 0;

  const [prepared, setPrepared] = useState<Prepared>();
  const [error, setError] = useState<string>();
  const [ready, setReady] = useState(false);
  const seeked = useRef(false);

  const player = useVideoPlayer(null, (p) => {
    p.timeUpdateEventInterval = 1;
    p.staysActiveInBackground = false;
  });

  // Ask the server how to play this item, then load the stream. If direct
  // play fails on the device, `load(true)` retries with a server transcode.
  const triedTranscode = useRef(false);
  const load = useCallback(
    async (forceTranscode: boolean) => {
      const [item, info] = await Promise.all([
        client.item(id),
        client.playbackInfo(id, {
          startTimeTicks: startTicks,
          deviceProfile: buildDeviceProfile(),
          enableDirectPlay: !forceTranscode,
          enableDirectStream: !forceTranscode,
        }),
      ]);
      const source = info.MediaSources?.[0];
      if (!source) throw new Error('The server returned no playable source for this item.');
      const uri = client.streamUrl(id, source, info.PlaySessionId);
      const method: PlaybackReport['PlayMethod'] =
        source.SupportsDirectPlay && !forceTranscode
          ? 'DirectPlay'
          : source.SupportsDirectStream && !forceTranscode
            ? 'DirectStream'
            : 'Transcode';
      setPrepared({ item, source, playSessionId: info.PlaySessionId, uri, method });
      await player.replaceAsync({
        uri,
        headers: client.authHeaders,
        contentType: method === 'DirectPlay' ? undefined : 'hls',
        metadata: {
          title: item.Type === 'Episode' ? `${episodeLabel(item) ?? ''} ${item.Name}`.trim() : item.Name,
          artist: item.SeriesName,
        },
      });
      player.play();
    },
    [client, id, startTicks, player],
  );

  useEffect(() => {
    load(false).catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [load]);

  // Track position from events so the final "stopped" report still works
  // after the native player has been released on unmount.
  const position = useRef(startTicks / TICKS_PER_SECOND);
  const paused = useRef(false);

  const report = (): PlaybackReport | undefined =>
    prepared && {
      ItemId: prepared.item.Id,
      MediaSourceId: prepared.source.Id,
      PlaySessionId: prepared.playSessionId,
      PositionTicks: Math.round(position.current * TICKS_PER_SECOND),
      IsPaused: paused.current,
      CanSeek: true,
      PlayMethod: prepared.method,
    };

  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    if (seeked.current) position.current = currentTime;
  });

  useEventListener(player, 'statusChange', ({ status, error: err }) => {
    if (status === 'readyToPlay') {
      setReady(true);
      if (!seeked.current) {
        seeked.current = true;
        if (startTicks > 0) player.currentTime = startTicks / TICKS_PER_SECOND;
        const r = report();
        if (r) client.reportStart(r).catch(() => {});
      }
    } else if (status === 'error') {
      if (prepared?.method !== 'Transcode' && !triedTranscode.current) {
        triedTranscode.current = true;
        load(true).catch((e) => setError(e instanceof Error ? e.message : String(e)));
        return;
      }
      setError(`Playback failed (${prepared?.method ?? 'unknown'}): ${err?.message ?? 'unknown error'}`);
    }
  });

  useEventListener(player, 'playingChange', ({ isPlaying }) => {
    paused.current = !isPlaying;
    const r = report();
    if (r && seeked.current) client.reportProgress(r).catch(() => {});
  });

  useEventListener(player, 'playToEnd', () => {
    router.back();
  });

  // Periodic progress so the server can resume where we left off.
  const reportRef = useRef(report);
  reportRef.current = report;
  useEffect(() => {
    const t = setInterval(() => {
      const r = reportRef.current();
      if (r && seeked.current) client.reportProgress(r).catch(() => {});
    }, PROGRESS_INTERVAL_MS);
    return () => {
      clearInterval(t);
      const r = reportRef.current();
      if (r && seeked.current) client.reportStopped(r).catch(() => {});
    };
  }, [client]);

  const title = prepared
    ? prepared.item.Type === 'Episode'
      ? `${prepared.item.SeriesName} · ${episodeLabel(prepared.item) ?? ''}`
      : prepared.item.Name
    : '';

  return (
    <View style={styles.screen}>
      <StatusBar hidden />
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        nativeControls
        allowsPictureInPicture
      />
      {!ready && !error && (
        <View style={styles.center} pointerEvents="none">
          <ActivityIndicator color={colors.text} size="large" />
        </View>
      )}
      {error && (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={40} color={colors.danger} />
          <Text style={styles.error}>{error}</Text>
        </View>
      )}
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm, paddingLeft: insets.left + spacing.lg }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back} accessibilityLabel="Close player">
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  error: { color: colors.text, textAlign: 'center' },
  topBar: { position: 'absolute', top: 0, left: 0, right: 80, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: '#fff', fontSize: 15, fontWeight: '600', flexShrink: 1, textShadowColor: '#000', textShadowRadius: 4 },
});
