import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useKeepAwake } from 'expo-keep-awake';
import { VideoAirPlayButton } from 'expo-video';
import { CastButton, useRemoteMediaClient } from 'react-native-google-cast';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BaseItem, episodeLabel, MediaSegment, PlaybackReport, TICKS_PER_SECOND } from '@/api/jellyfin';
import { Engine } from '@/components/player/Engines';
import { methodLabel, PlayerMenu } from '@/components/player/PlayerMenu';
import { SubtitleOverlay } from '@/components/player/SubtitleOverlay';
import { castItem } from '@/lib/cast';
import { useDownloads } from '@/lib/downloads';
import { PlanOptions, PlaybackPlan, planOffline, planPlayback } from '@/lib/playback';
import { useClient } from '@/lib/session';
import { ENGINE_LABEL, useSettings } from '@/lib/settings';
import { colors, radius, spacing } from '@/lib/theme';

const PROGRESS_INTERVAL_MS = 10_000;
const HIDE_CONTROLS_MS = 4000;
const T = TICKS_PER_SECOND;

function clock(s: number) {
  if (!isFinite(s) || s < 0) s = 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const mm = h ? String(m).padStart(2, '0') : String(m);
  return `${h ? `${h}:` : ''}${mm}:${String(sec).padStart(2, '0')}`;
}

export default function Player() {
  useKeepAwake();
  const client = useClient();
  const { settings, update } = useSettings();
  const downloads = useDownloads();
  const remote = useRemoteMediaClient();
  const insets = useSafeAreaInsets();
  const { id, start, offline: offlineParam } = useLocalSearchParams<{ id: string; start?: string; offline?: string }>();
  const offline = offlineParam === '1';

  const [opts, setOpts] = useState<PlanOptions>({ startTicks: Number(start ?? 0) || 0 });
  const [plan, setPlan] = useState<PlaybackPlan>();
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [rate, setRate] = useState(settings.defaultSpeed);
  const [seek, setSeek] = useState<{ seconds: number; nonce: number }>();
  const [time, setTime] = useState({ position: 0, duration: 0 });
  const [controls, setControls] = useState(true);
  const [menu, setMenu] = useState(false);
  const [poke, setPoke] = useState(0);
  const [segments, setSegments] = useState<MediaSegment[]>([]);
  const [next, setNext] = useState<BaseItem>();

  const startSeconds = (opts.startTicks ?? 0) / T;
  const position = useRef(startSeconds);
  const planRef = useRef<PlaybackPlan>(undefined);
  const started = useRef(false);
  const fellBack = useRef({ engine: false, transcode: false });
  /** Why each attempt failed, shown if every fallback fails. */
  const attempts = useRef<string[]>([]);
  const autoSkipped = useRef(new Set<number>());

  /* ---------- reporting ---------- */

  const report = useCallback((): PlaybackReport | undefined => {
    const p = planRef.current;
    if (!p || !p.playSessionId || !started.current) return;
    return {
      ItemId: p.item.Id,
      MediaSourceId: p.source.Id,
      PlaySessionId: p.playSessionId,
      PositionTicks: Math.round(position.current * T),
      IsPaused: paused,
      CanSeek: true,
      PlayMethod: p.method,
    };
  }, [paused]);
  const reportRef = useRef(report);
  reportRef.current = report;

  const stopReport = () => {
    const r = reportRef.current();
    if (r) client.reportStopped(r).catch(() => {});
    started.current = false;
  };

  useEffect(() => {
    const t = setInterval(() => {
      const r = reportRef.current();
      if (r) client.reportProgress(r).catch(() => {});
    }, PROGRESS_INTERVAL_MS);
    return () => {
      clearInterval(t);
      stopReport();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  useEffect(() => {
    const r = reportRef.current();
    if (r) client.reportProgress(r).catch(() => {});
  }, [paused, client]);

  /* ---------- planning ---------- */

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setError(undefined);
    const make = async () => {
      if (!offline) return planPlayback(client, settings, id, opts);
      const record = downloads.get(id);
      if (!record?.videoUri) throw new Error('This download is not available on this device.');
      return planOffline(record, settings, opts);
    };
    make()
      .then((p) => {
        if (cancelled) return;
        stopReport();
        planRef.current = p;
        position.current = startSeconds;
        setPlan(p);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
    // Settings changes apply on the next reload, not mid-stream.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts, id, offline, client]);

  useEffect(() => {
    if (offline) return;
    client.mediaSegments(id).then(setSegments);
  }, [client, id, offline]);

  useEffect(() => {
    if (offline || plan?.item.Type !== 'Episode' || !plan.item.SeriesId) return;
    client.nextEpisode(plan.item.SeriesId, plan.item.Id).then(setNext).catch(() => {});
  }, [client, offline, plan?.item]);

  /** Re-plan from the current position, keeping the chosen tracks. */
  const reload = useCallback(
    (patch: PlanOptions = {}) => {
      const p = planRef.current;
      setOpts((o) => ({
        ...o,
        audioIndex: p?.audioIndex,
        subtitleIndex: p?.subtitleIndex,
        ...patch,
        startTicks: Math.round(position.current * T),
      }));
    },
    [],
  );

  // Coming back from the subtitle search picks up any newly downloaded file.
  const reloadOnFocus = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!reloadOnFocus.current) return;
      reloadOnFocus.current = false;
      reload({ subtitleIndex: undefined });
      setPaused(false);
    }, [reload]),
  );

  // Connecting to a Chromecast mid-playback hands the stream over.
  const castStarted = useRef(false);
  useEffect(() => {
    if (!remote || offline || castStarted.current) return;
    castStarted.current = true;
    castItem(remote, client, settings, id, Math.round(position.current * T))
      .then(() => router.back())
      .catch((e) => setNotice(`Casting failed: ${e instanceof Error ? e.message : String(e)}`));
  }, [remote, offline, client, settings, id]);

  /* ---------- engine callbacks ---------- */

  const fail = (message: string) => {
    const p = planRef.current;
    if (!p) return setError(message);
    attempts.current.push(`${ENGINE_LABEL[p.engine]}, ${methodLabel(p.method).toLowerCase()}: ${message}`);
    if (p.engine !== 'native' && !fellBack.current.engine) {
      fellBack.current.engine = true;
      setNotice(`${ENGINE_LABEL[p.engine]} couldn't play this (${message}). Switched to ${ENGINE_LABEL.native}.`);
      reload({ engine: 'native' });
      return;
    }
    if (!offline && p.method !== 'Transcode' && !fellBack.current.transcode) {
      fellBack.current.transcode = true;
      reload({ forceTranscode: true });
      return;
    }
    setError(`This video couldn't be played.\n\n${attempts.current.join('\n\n')}`);
  };

  /** Drops callbacks from an engine that has been replaced by a newer plan. */
  const live =
    <A extends unknown[]>(owner: PlaybackPlan, fn: (...args: A) => void) =>
    (...args: A) => {
      if (planRef.current === owner) fn(...args);
    };

  const playNext = () => {
    if (next) router.replace({ pathname: '/player/[id]', params: { id: next.Id } });
    else router.back();
  };

  const onEnd = () => {
    // A stream the device can't open can "end" at once instead of erroring.
    if (position.current - startSeconds < 5) return fail('the stream ended right away');
    if (settings.autoplayNext && next) playNext();
    else router.back();
  };

  const doSeek = (seconds: number) => {
    const s = Math.max(0, time.duration ? Math.min(seconds, time.duration - 1) : seconds);
    position.current = s;
    setTime((t) => ({ ...t, position: s }));
    setSeek({ seconds: s, nonce: Date.now() });
    setPoke((n) => n + 1);
  };

  const activeSegment = segments.find(
    (s) => (s.Type === 'Intro' || s.Type === 'Outro') && time.position >= s.StartTicks / T && time.position < s.EndTicks / T - 1,
  );

  const skipSegment = (s: MediaSegment) => {
    if (s.Type === 'Outro' && next && settings.autoplayNext) playNext();
    else doSeek(s.EndTicks / T);
  };

  const onProgress = (pos: number, duration: number) => {
    // Time moving means the stream is playing, even if a load event was missed.
    if (!started.current) onReady();
    position.current = pos;
    setTime({ position: pos, duration });
    const seg = segments.find((s) => pos >= s.StartTicks / T && pos < s.EndTicks / T - 1);
    if (!seg || autoSkipped.current.has(seg.StartTicks)) return;
    if ((seg.Type === 'Intro' && settings.autoSkipIntro) || (seg.Type === 'Outro' && settings.autoSkipCredits)) {
      autoSkipped.current.add(seg.StartTicks);
      skipSegment(seg);
    }
  };

  const onReady = () => {
    setReady(true);
    setBuffering(false);
    if (!started.current) {
      started.current = true;
      const r = reportRef.current();
      if (r) client.reportStart(r).catch(() => {});
    }
  };

  /* ---------- controls ---------- */

  useEffect(() => {
    if (!controls || paused || menu) return;
    const t = setTimeout(() => setControls(false), HIDE_CONTROLS_MS);
    return () => clearTimeout(t);
  }, [controls, paused, menu, poke]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(undefined), 6000);
    return () => clearTimeout(t);
  }, [notice]);

  const subtitleStyle = useMemo(
    () => ({
      scale: settings.subtitleScale / 100,
      color: settings.subtitleColor,
      bold: settings.subtitleBold,
      background: settings.subtitleBackground,
      marginY: settings.subtitleOffset,
      delay: settings.subtitleDelay,
    }),
    [settings],
  );

  const item = plan?.item;
  const title = item ? (item.Type === 'Episode' ? item.SeriesName ?? item.Name : item.Name) : '';
  const subtitleLine = item?.Type === 'Episode' ? [episodeLabel(item), item.Name].filter(Boolean).join(' · ') : undefined;
  const pad = { paddingLeft: insets.left + spacing.lg, paddingRight: insets.right + spacing.lg };

  return (
    <View style={styles.screen}>
      <StatusBar hidden />
      {plan && !error && !remote && (
        <Engine
          key={`${plan.engine}:${plan.uri}`}
          engine={plan.engine}
          uri={plan.uri}
          headers={plan.headers}
          isHls={plan.isHls}
          startSeconds={startSeconds}
          paused={paused}
          rate={rate}
          seek={seek}
          audioOrder={plan.audioOrder}
          subtitle={plan.subtitle}
          subtitleStyle={subtitleStyle}
          hardwareDecoding={settings.hardwareDecoding}
          title={title}
          artist={subtitleLine}
          onProgress={live(plan, onProgress)}
          onReady={live(plan, onReady)}
          onPausedChange={live(plan, setPaused)}
          onBuffering={live(plan, setBuffering)}
          onEnd={live(plan, onEnd)}
          onError={live(plan, fail)}
        />
      )}

      {plan?.engine === 'native' && plan.subtitle.kind === 'overlay' && (
        <SubtitleOverlay url={plan.subtitle.url} headers={plan.headers} position={time.position} settings={settings} />
      )}

      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={() => {
          setControls((c) => !c);
          setPoke((n) => n + 1);
        }}
        accessibilityLabel={controls ? 'Hide controls' : 'Show controls'}
      />

      {(!ready || buffering) && !error && (
        <View style={styles.center} pointerEvents="none">
          <ActivityIndicator color={colors.text} size="large" />
        </View>
      )}

      {error && (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={40} color={colors.danger} />
          <Text style={styles.error} selectable>{error}</Text>
          <Pressable
            style={styles.retry}
            onPress={() => {
              fellBack.current = { engine: false, transcode: false };
              attempts.current = [];
              reload({ forceTranscode: false, engine: undefined });
            }}
          >
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      )}

      {controls && (
        <>
          <View style={[styles.topBar, pad, { paddingTop: insets.top + spacing.sm }]}>
            <Pressable onPress={() => router.back()} hitSlop={12} style={styles.round} accessibilityLabel="Close player">
              <Ionicons name="chevron-back" size={24} color="#fff" />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
              {subtitleLine ? (
                <Text style={styles.subtitle} numberOfLines={1}>
                  {subtitleLine}
                </Text>
              ) : null}
            </View>
            {plan && (
              <Text style={styles.badge}>
                {ENGINE_LABEL[plan.engine]} · {offline ? 'Offline' : methodLabel(plan.method)}
              </Text>
            )}
            {!offline && <CastButton style={styles.castButton} tintColor="#fff" />}
            {Platform.OS === 'ios' && <VideoAirPlayButton style={styles.castButton} tint="#fff" />}
            {plan && (
              <Pressable onPress={() => setMenu(true)} hitSlop={12} style={styles.round} accessibilityLabel="Playback options">
                <Ionicons name="options-outline" size={22} color="#fff" />
              </Pressable>
            )}
          </View>

          {ready && (
            <View style={styles.middle} pointerEvents="box-none">
              <Pressable
                onPress={() => doSeek(time.position - settings.seekBackSeconds)}
                style={styles.bigButton}
                accessibilityLabel={`Back ${settings.seekBackSeconds} seconds`}
              >
                <Ionicons name="play-back" size={28} color="#fff" />
                <Text style={styles.seekLabel}>{settings.seekBackSeconds}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setPaused((v) => !v);
                  setPoke((n) => n + 1);
                }}
                style={[styles.bigButton, styles.playButton]}
                accessibilityLabel={paused ? 'Play' : 'Pause'}
              >
                <Ionicons name={paused ? 'play' : 'pause'} size={40} color="#fff" />
              </Pressable>
              <Pressable
                onPress={() => doSeek(time.position + settings.seekForwardSeconds)}
                style={styles.bigButton}
                accessibilityLabel={`Forward ${settings.seekForwardSeconds} seconds`}
              >
                <Ionicons name="play-forward" size={28} color="#fff" />
                <Text style={styles.seekLabel}>{settings.seekForwardSeconds}</Text>
              </Pressable>
            </View>
          )}

          <View style={[styles.bottomBar, pad, { paddingBottom: insets.bottom + spacing.md }]}>
            <Text style={styles.time}>{clock(time.position)}</Text>
            <SeekBar position={time.position} duration={time.duration} onSeek={doSeek} />
            <Text style={styles.time}>-{clock(time.duration - time.position)}</Text>
            {next && (
              <Pressable onPress={playNext} hitSlop={8} accessibilityLabel="Next episode">
                <Ionicons name="play-skip-forward" size={22} color="#fff" />
              </Pressable>
            )}
          </View>
        </>
      )}

      {activeSegment && settings.skipIntroButton && !menu && (
        <Pressable style={[styles.skip, { right: insets.right + spacing.xl, bottom: insets.bottom + 72 }]} onPress={() => skipSegment(activeSegment)}>
          <Text style={styles.skipText}>
            {activeSegment.Type === 'Intro' ? 'Skip intro' : next && settings.autoplayNext ? 'Next episode' : 'Skip credits'}
          </Text>
          <Ionicons name="play-skip-forward" size={16} color="#000" />
        </Pressable>
      )}

      {notice && (
        <View style={[styles.notice, { top: insets.top + 64 }]} pointerEvents="none">
          <Text style={styles.noticeText}>{notice}</Text>
        </View>
      )}

      {menu && plan && (
        <PlayerMenu
          plan={plan}
          rate={rate}
          bitrate={opts.maxBitrate ?? settings.maxBitrate}
          offline={offline}
          settings={settings}
          onAudio={(i) => reload({ audioIndex: i })}
          onSubtitle={(i) => reload({ subtitleIndex: i })}
          onSearchSubtitles={() => {
            setMenu(false);
            setPaused(true);
            reloadOnFocus.current = true;
            router.push({ pathname: '/subtitles/[id]', params: { id } });
          }}
          onSubtitleDelay={(d) => update({ subtitleDelay: Math.round(d * 10) / 10 })}
          onRate={setRate}
          onEngine={(e) => {
            fellBack.current = { engine: false, transcode: false };
            reload({ engine: e });
          }}
          onBitrate={(b) => reload({ maxBitrate: b })}
          onClose={() => setMenu(false)}
        />
      )}
    </View>
  );
}

function SeekBar({ position, duration, onSeek }: { position: number; duration: number; onSeek: (s: number) => void }) {
  const ref = useRef<View>(null);
  const box = useRef({ x: 0, width: 1 });
  const [drag, setDrag] = useState<number>();
  const frac = (pageX: number) => Math.min(1, Math.max(0, (pageX - box.current.x) / box.current.width));
  const shown = drag ?? (duration > 0 ? position / duration : 0);

  return (
    <View
      ref={ref}
      style={styles.seekBar}
      hitSlop={{ top: 16, bottom: 16 }}
      onLayout={() => ref.current?.measureInWindow((x, _y, width) => (box.current = { x, width: width || 1 }))}
      onStartShouldSetResponder={() => duration > 0}
      onMoveShouldSetResponder={() => duration > 0}
      onResponderGrant={(e) => setDrag(frac(e.nativeEvent.pageX))}
      onResponderMove={(e) => setDrag(frac(e.nativeEvent.pageX))}
      onResponderRelease={(e) => {
        onSeek(frac(e.nativeEvent.pageX) * duration);
        setDrag(undefined);
      }}
      onResponderTerminate={() => setDrag(undefined)}
      accessibilityRole="adjustable"
      accessibilityLabel="Seek"
    >
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${shown * 100}%` }]} />
      </View>
      <View style={[styles.thumb, { left: `${shown * 100}%` }]} />
    </View>
  );
}

const shadow = { textShadowColor: '#000', textShadowRadius: 4 };

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  error: { color: colors.text, textAlign: 'center', maxWidth: 520 },
  retry: { backgroundColor: colors.surfaceRaised, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill },
  retryText: { color: colors.text, fontWeight: '600' },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  round: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontSize: 16, fontWeight: '700', ...shadow },
  subtitle: { color: 'rgba(255,255,255,0.75)', fontSize: 13, ...shadow },
  badge: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600' },
  castButton: { width: 26, height: 26, tintColor: '#fff' },
  middle: { ...StyleSheet.absoluteFill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 56 },
  bigButton: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)' },
  playButton: { width: 80, height: 80, borderRadius: 40 },
  seekLabel: { position: 'absolute', bottom: 4, color: '#fff', fontSize: 10, fontWeight: '700' },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  time: { color: '#fff', fontSize: 12, fontVariant: ['tabular-nums'], minWidth: 48, textAlign: 'center' },
  seekBar: { flex: 1, height: 24, justifyContent: 'center' },
  track: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden' },
  fill: { height: 4, backgroundColor: colors.accent },
  thumb: { position: 'absolute', width: 14, height: 14, marginLeft: -7, borderRadius: 7, backgroundColor: '#fff' },
  skip: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#fff',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  skipText: { color: '#000', fontWeight: '700' },
  notice: {
    position: 'absolute',
    alignSelf: 'center',
    maxWidth: '80%',
    backgroundColor: 'rgba(14,15,20,0.9)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  noticeText: { color: colors.text, fontSize: 13, textAlign: 'center' },
});
