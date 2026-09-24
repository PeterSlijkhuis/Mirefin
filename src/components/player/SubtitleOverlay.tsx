import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextStyle, View } from 'react-native';
import { File } from 'expo-file-system';
import { activeCues, Cue, parseVtt } from '@/lib/vtt';
import { Settings } from '@/lib/settings';

/**
 * Draws text subtitles over the native player, so they follow the app's
 * subtitle style settings on both Android and iOS.
 */
export function SubtitleOverlay({
  url,
  headers,
  position,
  settings,
}: {
  url: string;
  headers: Record<string, string>;
  position: number;
  settings: Settings;
}) {
  const [cues, setCues] = useState<Cue[]>([]);

  useEffect(() => {
    let cancelled = false;
    setCues([]);
    const load = url.startsWith('file:')
      ? new File(url).text()
      : fetch(url, { headers }).then((r) => {
          if (!r.ok) throw new Error(`Subtitle download failed (${r.status})`);
          return r.text();
        });
    load.then((t) => !cancelled && setCues(parseVtt(t))).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [url, headers]);

  const lines = activeCues(cues, position - settings.subtitleDelay);
  if (!lines.length) return null;

  return (
    <View pointerEvents="none" style={[styles.wrap, { bottom: `${settings.subtitleOffset}%` }]}>
      {lines.map((c, i) => (
        <Text key={`${c.start}-${i}`} style={[styles.text, subtitleTextStyle(settings)]}>
          {c.text}
        </Text>
      ))}
    </View>
  );
}

export function subtitleTextStyle(s: Settings): TextStyle {
  const base: TextStyle = {
    color: s.subtitleColor,
    fontSize: 20 * (s.subtitleScale / 100),
    fontWeight: s.subtitleBold ? '700' : '500',
  };
  switch (s.subtitleBackground) {
    case 'box':
      return { ...base, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 6 };
    case 'outline':
      return { ...base, textShadowColor: '#000', textShadowRadius: 3, textShadowOffset: { width: 0, height: 0 } };
    case 'shadow':
      return { ...base, textShadowColor: 'rgba(0,0,0,0.9)', textShadowRadius: 4, textShadowOffset: { width: 1, height: 1 } };
    default:
      return base;
  }
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 24, right: 24, alignItems: 'center' },
  text: { textAlign: 'center', lineHeight: undefined },
});
