import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { PlaybackPlan } from '@/lib/playback';
import { streamLabel } from '@/lib/playback';
import { ENGINE_LABEL, ENGINES, PlayerEngine, Settings } from '@/lib/settings';
import { colors, radius, spacing } from '@/lib/theme';

export const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
export const BITRATES: { label: string; value: number }[] = [
  { label: 'Auto (unlimited)', value: 0 },
  { label: '40 Mbps', value: 40_000_000 },
  { label: '20 Mbps', value: 20_000_000 },
  { label: '10 Mbps', value: 10_000_000 },
  { label: '8 Mbps (1080p)', value: 8_000_000 },
  { label: '4 Mbps (720p)', value: 4_000_000 },
  { label: '1.5 Mbps (480p)', value: 1_500_000 },
  { label: '720 kbps', value: 720_000 },
];

type Tab = 'Audio' | 'Subtitles' | 'Speed' | 'Player' | 'Quality';

export function PlayerMenu(p: {
  plan: PlaybackPlan;
  rate: number;
  bitrate: number;
  offline: boolean;
  settings: Settings;
  onAudio: (index: number) => void;
  onSubtitle: (index: number) => void;
  onSearchSubtitles: () => void;
  onSubtitleDelay: (seconds: number) => void;
  onRate: (rate: number) => void;
  onEngine: (engine: PlayerEngine) => void;
  onBitrate: (bitrate: number) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>('Subtitles');
  const tabs: Tab[] = p.offline ? ['Audio', 'Subtitles', 'Speed', 'Player'] : ['Audio', 'Subtitles', 'Speed', 'Player', 'Quality'];
  const delayApplies = p.plan.subtitle.kind === 'overlay' || p.plan.engine === 'mpv';

  return (
    <View style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={p.onClose} accessibilityLabel="Close menu" />
      <View style={styles.panel}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {tabs.map((t) => (
            <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabActive]}>
              <Text style={[styles.tabText, tab === t && { color: colors.text }]}>{t}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <ScrollView contentContainerStyle={{ paddingBottom: spacing.lg }}>
          {tab === 'Audio' &&
            p.plan.audioStreams.map((s) => (
              <Option key={s.Index} label={streamLabel(s)} selected={s.Index === p.plan.audioIndex} onPress={() => p.onAudio(s.Index)} />
            ))}

          {tab === 'Subtitles' && (
            <>
              <Option label="Off" selected={p.plan.subtitleIndex === -1} onPress={() => p.onSubtitle(-1)} />
              {p.plan.subtitleStreams.map((s) => (
                <Option
                  key={s.Index}
                  label={streamLabel(s)}
                  hint={[s.IsForced && 'Forced', s.IsExternal && 'External', s.Codec?.toUpperCase()].filter(Boolean).join(' · ')}
                  selected={s.Index === p.plan.subtitleIndex}
                  onPress={() => p.onSubtitle(s.Index)}
                />
              ))}
              {delayApplies && p.plan.subtitleIndex !== -1 && (
                <View style={styles.stepper}>
                  <Text style={styles.optionText}>Delay</Text>
                  <Step icon="remove" onPress={() => p.onSubtitleDelay(p.settings.subtitleDelay - 0.1)} />
                  <Text style={styles.value}>{p.settings.subtitleDelay.toFixed(1)} s</Text>
                  <Step icon="add" onPress={() => p.onSubtitleDelay(p.settings.subtitleDelay + 0.1)} />
                </View>
              )}
              {!p.offline && (
                <Pressable onPress={p.onSearchSubtitles} style={styles.action}>
                  <Ionicons name="cloud-download-outline" size={18} color={colors.accent} />
                  <Text style={[styles.optionText, { color: colors.accent }]}>Search subtitles online</Text>
                </Pressable>
              )}
            </>
          )}

          {tab === 'Speed' &&
            SPEEDS.map((r) => <Option key={r} label={`${r}×`} selected={r === p.rate} onPress={() => p.onRate(r)} />)}

          {tab === 'Player' &&
            ENGINES.map((e) => (
              <Option
                key={e}
                label={ENGINE_LABEL[e]}
                hint={e === 'native' ? 'Best for HDR and Dolby Vision' : 'Plays nearly every codec, full ASS/SSA subtitles'}
                selected={e === p.plan.engine}
                onPress={() => p.onEngine(e)}
              />
            ))}

          {tab === 'Quality' && (
            <>
              <Text style={styles.note}>Currently {p.plan.method.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()}</Text>
              {BITRATES.map((b) => (
                <Option key={b.value} label={b.label} selected={b.value === p.bitrate} onPress={() => p.onBitrate(b.value)} />
              ))}
            </>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

function Option({ label, hint, selected, onPress }: { label: string; hint?: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.option, pressed && { backgroundColor: colors.surfaceRaised }]}>
      <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={18} color={selected ? colors.accent : colors.textDim} />
      <View style={{ flex: 1 }}>
        <Text style={styles.optionText} numberOfLines={2}>
          {label}
        </Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
    </Pressable>
  );
}

function Step({ icon, onPress }: { icon: 'add' | 'remove'; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.stepBtn} hitSlop={8}>
      <Ionicons name={icon} size={18} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, flexDirection: 'row', justifyContent: 'flex-end' },
  panel: {
    width: 340,
    maxWidth: '85%',
    backgroundColor: 'rgba(14,15,20,0.96)',
    borderTopLeftRadius: radius.lg,
    borderBottomLeftRadius: radius.lg,
    paddingTop: spacing.md,
  },
  tabs: { paddingHorizontal: spacing.md, gap: spacing.xs, paddingBottom: spacing.sm },
  tab: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill },
  tabActive: { backgroundColor: colors.accentDim },
  tabText: { color: colors.textMuted, fontWeight: '600' },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  optionText: { color: colors.text, fontSize: 15 },
  hint: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  note: { color: colors.textDim, fontSize: 12, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  action: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  stepBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  value: { color: colors.text, minWidth: 48, textAlign: 'center', fontVariant: ['tabular-nums'] },
});
