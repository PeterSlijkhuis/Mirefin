import React from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { subtitleTextStyle } from '@/components/player/SubtitleOverlay';
import { BITRATES, SPEEDS } from '@/components/player/PlayerMenu';
import { ENGINE_LABEL, ENGINES, LANGUAGES, Settings, SubtitleMode, useSettings } from '@/lib/settings';
import { colors, radius, spacing, type } from '@/lib/theme';

type Opt<T> = { value: T; label: string };

const engineOpts = ENGINES.map((e) => ({ value: e, label: ENGINE_LABEL[e] }));
const langOpts = (none: string) => [{ value: '', label: none }, ...LANGUAGES.map((l) => ({ value: l.code, label: l.label }))];
const SUB_MODES: Opt<SubtitleMode>[] = [
  { value: 'Default', label: 'Default' },
  { value: 'Smart', label: 'Smart' },
  { value: 'Always', label: 'Always' },
  { value: 'OnlyForced', label: 'Only forced' },
  { value: 'None', label: 'Off' },
];
const SUB_MODE_HELP: Record<SubtitleMode, string> = {
  Default: 'Tracks marked default or forced in the file.',
  Smart: 'Only when the audio is not in your subtitle language.',
  Always: 'Always show subtitles in your language.',
  OnlyForced: 'Only forced subtitles (signs, foreign dialogue).',
  None: 'Never turn subtitles on automatically.',
};
const COLORS = ['#FFFFFF', '#FFE45C', '#7CE0FF', '#9CFF8A', '#FF9FD0'];

export default function PlaybackSettings() {
  const { settings: s, update, reset } = useSettings();
  const set = <K extends keyof Settings>(k: K) => (v: Settings[K]) => update({ [k]: v } as Partial<Settings>);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl }}>
      <Section title="Player per content" note="mpv and VLC play nearly any codec and draw ASS/SSA subtitles exactly as styled. The system player is best for HDR10 and Dolby Vision.">
        <Pick label="Movies" value={s.playerMovies} options={engineOpts} onChange={set('playerMovies')} />
        <Pick label="TV episodes" value={s.playerEpisodes} options={engineOpts} onChange={set('playerEpisodes')} />
        <Pick label="Anime" value={s.playerAnime} options={engineOpts} onChange={set('playerAnime')} />
        <Pick label="Other videos" value={s.playerOther} options={engineOpts} onChange={set('playerOther')} />
        <Pick label="HDR and Dolby Vision" value={s.playerHdr} options={engineOpts} onChange={set('playerHdr')} />
      </Section>

      <Section title="Player per subtitle" note="Applies when the system player would otherwise be used.">
        <Toggle label={`Use ${ENGINE_LABEL[ENGINES[0]]} for ASS/SSA subtitles`} value={s.vlcForAss} onChange={set('vlcForAss')} />
        <Pick
          label="Image subtitles (PGS, VobSub)"
          value={s.imageSubtitles}
          options={[
            { value: 'burn', label: 'Burn in on server' },
            { value: 'vlc', label: `Switch to ${ENGINE_LABEL[ENGINES[0]]}` },
          ]}
          onChange={set('imageSubtitles')}
        />
        <Toggle label="Burn in ASS/SSA on the system player" value={s.burnInAss} onChange={set('burnInAss')} />
        <Toggle label="Hardware decoding" value={s.hardwareDecoding} onChange={set('hardwareDecoding')} />
      </Section>

      <Section title="Streaming">
        <Toggle label="Allow direct play" value={s.directPlay} onChange={set('directPlay')} />
        <Toggle label="Allow direct stream (remux)" value={s.directStream} onChange={set('directStream')} />
        <Pick label="Maximum bitrate" value={s.maxBitrate} options={BITRATES} onChange={set('maxBitrate')} />
        <Pick
          label="Audio channels"
          value={s.maxAudioChannels}
          options={[
            { value: 2, label: 'Stereo' },
            { value: 6, label: '5.1' },
            { value: 8, label: '7.1' },
          ]}
          onChange={set('maxAudioChannels')}
        />
        <Toggle label="Allow HEVC (H.265)" value={s.allowHevc} onChange={set('allowHevc')} />
        <Toggle label="Allow AV1" value={s.allowAv1} onChange={set('allowAv1')} />
      </Section>

      <Section title="Playback">
        <Toggle label="Autoplay next episode" value={s.autoplayNext} onChange={set('autoplayNext')} />
        <Toggle label="Show skip intro / credits button" value={s.skipIntroButton} onChange={set('skipIntroButton')} />
        <Toggle label="Skip intros automatically" value={s.autoSkipIntro} onChange={set('autoSkipIntro')} />
        <Toggle label="Skip credits automatically" value={s.autoSkipCredits} onChange={set('autoSkipCredits')} />
        <Pick label="Seek back" value={s.seekBackSeconds} options={[5, 10, 15, 30].map((v) => ({ value: v, label: `${v} s` }))} onChange={set('seekBackSeconds')} />
        <Pick label="Seek forward" value={s.seekForwardSeconds} options={[10, 15, 30, 60].map((v) => ({ value: v, label: `${v} s` }))} onChange={set('seekForwardSeconds')} />
        <Pick label="Default speed" value={s.defaultSpeed} options={SPEEDS.map((v) => ({ value: v, label: `${v}×` }))} onChange={set('defaultSpeed')} />
        <Toggle label="Always play in landscape" value={s.keepScreenLandscape} onChange={set('keepScreenLandscape')} />
      </Section>

      <Section title="Audio">
        <Pick label="Preferred language" value={s.audioLanguage} options={langOpts('File default')} onChange={set('audioLanguage')} />
      </Section>

      <Section title="Subtitles" note={SUB_MODE_HELP[s.subtitleMode]}>
        <Pick label="When to show" value={s.subtitleMode} options={SUB_MODES} onChange={set('subtitleMode')} />
        <Pick label="Language" value={s.subtitleLanguage} options={langOpts('Any')} onChange={set('subtitleLanguage')} />
      </Section>

      <Section title="Subtitle style" note="ASS/SSA subtitles on mpv and VLC keep their own styling.">
        <View style={styles.preview}>
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: `${s.subtitleOffset}%`, alignItems: 'center' }}>
            <Text style={[{ textAlign: 'center' }, subtitleTextStyle(s)]}>The wave rolls in at dawn.</Text>
          </View>
        </View>
        <Stepper label="Size" value={`${s.subtitleScale}%`} onMinus={() => update({ subtitleScale: Math.max(50, s.subtitleScale - 10) })} onPlus={() => update({ subtitleScale: Math.min(250, s.subtitleScale + 10) })} />
        <View style={styles.row}>
          <Text style={styles.label}>Color</Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {COLORS.map((c) => (
              <Pressable
                key={c}
                onPress={() => update({ subtitleColor: c })}
                style={[styles.swatch, { backgroundColor: c }, s.subtitleColor === c && styles.swatchActive]}
                accessibilityLabel={`Subtitle color ${c}`}
              />
            ))}
          </View>
        </View>
        <Pick
          label="Edge"
          value={s.subtitleBackground}
          options={[
            { value: 'shadow', label: 'Shadow' },
            { value: 'outline', label: 'Outline' },
            { value: 'box', label: 'Box' },
            { value: 'none', label: 'None' },
          ]}
          onChange={set('subtitleBackground')}
        />
        <Toggle label="Bold" value={s.subtitleBold} onChange={set('subtitleBold')} />
        <Stepper label="Position from bottom" value={`${s.subtitleOffset}%`} onMinus={() => update({ subtitleOffset: Math.max(0, s.subtitleOffset - 2) })} onPlus={() => update({ subtitleOffset: Math.min(40, s.subtitleOffset + 2) })} />
        <Stepper
          label="Delay"
          value={`${s.subtitleDelay.toFixed(1)} s`}
          onMinus={() => update({ subtitleDelay: Math.round((s.subtitleDelay - 0.1) * 10) / 10 })}
          onPlus={() => update({ subtitleDelay: Math.round((s.subtitleDelay + 0.1) * 10) / 10 })}
        />
      </Section>

      <Section title="Downloads">
        <Pick
          label="Quality"
          value={s.downloadBitrate}
          options={[
            { value: 0, label: 'Original file' },
            { value: 20_000_000, label: '20 Mbps' },
            { value: 8_000_000, label: '8 Mbps' },
            { value: 4_000_000, label: '4 Mbps' },
            { value: 1_500_000, label: '1.5 Mbps' },
          ]}
          onChange={set('downloadBitrate')}
        />
        <Toggle label="Save text subtitles with downloads" value={s.downloadSubtitles} onChange={set('downloadSubtitles')} />
      </Section>

      <Pressable onPress={reset} style={styles.reset}>
        <Text style={{ color: colors.danger, fontWeight: '600' }}>Reset all playback settings</Text>
      </Pressable>
    </ScrollView>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={styles.groupTitle}>{title}</Text>
      {note ? <Text style={type.small}>{note}</Text> : null}
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.label, { flex: 1 }]}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.accent, false: colors.surfaceRaised }} />
    </View>
  );
}

function Pick<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: Opt<T>[]; onChange: (v: T) => void }) {
  return (
    <View style={[styles.row, { flexDirection: 'column', alignItems: 'stretch' }]}>
      <Text style={styles.label}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
        {options.map((o) => (
          <Pressable key={String(o.value)} onPress={() => onChange(o.value)} style={[styles.chip, o.value === value && styles.chipActive]}>
            <Text style={[styles.chipText, o.value === value && { color: colors.text }]}>{o.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function Stepper({ label, value, onMinus, onPlus }: { label: string; value: string; onMinus: () => void; onPlus: () => void }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.label, { flex: 1 }]}>{label}</Text>
      <Pressable onPress={onMinus} style={styles.step} accessibilityLabel={`Decrease ${label}`}>
        <Ionicons name="remove" size={18} color={colors.text} />
      </Pressable>
      <Text style={styles.stepValue}>{value}</Text>
      <Pressable onPress={onPlus} style={styles.step} accessibilityLabel={`Increase ${label}`}>
        <Ionicons name="add" size={18} color={colors.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  groupTitle: { color: colors.textDim, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  label: { color: colors.text, fontSize: 15 },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.surfaceRaised },
  chipActive: { backgroundColor: colors.accentDim, borderWidth: 1, borderColor: colors.accent },
  chipText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  step: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  stepValue: { color: colors.text, minWidth: 56, textAlign: 'center', fontVariant: ['tabular-nums'] },
  preview: { height: 140, backgroundColor: '#1B2B3A', margin: spacing.md, borderRadius: radius.md, overflow: 'hidden' },
  swatch: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: 'transparent' },
  swatchActive: { borderColor: colors.accent },
  reset: { alignItems: 'center', padding: spacing.lg },
});
