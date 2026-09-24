import { useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { RemoteSubtitle } from '@/api/jellyfin';
import { Button, Chip, Empty } from '@/components/ui';
import { streamLabel } from '@/lib/playback';
import { useClient } from '@/lib/session';
import { LANGUAGES, useSettings } from '@/lib/settings';
import { colors, radius, spacing, type } from '@/lib/theme';
import { useAsync } from '@/lib/useAsync';

/** Finds subtitles through the server's subtitle providers (OpenSubtitles etc.) and adds them to the item. */
export default function SubtitleSearch() {
  const client = useClient();
  const { settings } = useSettings();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [lang, setLang] = useState(settings.subtitleLanguage || 'eng');
  const [results, setResults] = useState<RemoteSubtitle[]>();
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string>();
  const [added, setAdded] = useState<Record<string, 'busy' | 'done' | 'failed'>>({});

  const item = useAsync(() => client.item(id), [client, id, added]);
  const existing = (item.data?.MediaSources?.[0]?.MediaStreams ?? []).filter((s) => s.Type === 'Subtitle');

  const search = async () => {
    setSearching(true);
    setError(undefined);
    try {
      const r = await client.searchRemoteSubtitles(id, lang);
      setResults([...r].sort((a, b) => Number(!!b.IsHashMatch) - Number(!!a.IsHashMatch) || (b.DownloadCount ?? 0) - (a.DownloadCount ?? 0)));
    } catch (e) {
      setError(
        e instanceof Error && /404|not found/i.test(e.message)
          ? 'No subtitle provider is set up on your Jellyfin server. Install the OpenSubtitles plugin in the Jellyfin dashboard.'
          : e instanceof Error
            ? e.message
            : String(e),
      );
    } finally {
      setSearching(false);
    }
  };

  const download = async (s: RemoteSubtitle) => {
    setAdded((a) => ({ ...a, [s.Id]: 'busy' }));
    try {
      await client.downloadRemoteSubtitle(id, s.Id);
      setAdded((a) => ({ ...a, [s.Id]: 'done' }));
    } catch {
      setAdded((a) => ({ ...a, [s.Id]: 'failed' }));
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Subtitles' }} />
      <FlatList
        style={styles.screen}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
        data={results ?? []}
        keyExtractor={(s) => s.Id}
        ListHeaderComponent={
          <View style={{ gap: spacing.lg, marginBottom: spacing.md }}>
            <View style={{ gap: spacing.sm }}>
              <Text style={styles.heading}>On this item</Text>
              {existing.length ? (
                existing.map((s) => (
                  <Text key={s.Index} style={type.meta}>
                    {streamLabel(s)}
                    {s.IsExternal ? '  · external' : ''}
                  </Text>
                ))
              ) : (
                <Text style={type.small}>No subtitles yet.</Text>
              )}
            </View>
            <View style={{ gap: spacing.sm }}>
              <Text style={styles.heading}>Search online</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
                {LANGUAGES.map((l) => (
                  <Chip key={l.code} label={l.label} active={lang === l.code} onPress={() => setLang(l.code)} />
                ))}
              </ScrollView>
              <Button label="Search" icon="search" loading={searching} onPress={search} />
              {error ? <Text style={styles.error}>{error}</Text> : null}
            </View>
          </View>
        }
        ListEmptyComponent={results && !searching ? <Empty message="Nothing found in this language." icon="chatbox-outline" /> : null}
        renderItem={({ item: s }) => {
          const state = added[s.Id];
          return (
            <View style={styles.result}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.name} numberOfLines={2}>
                  {s.Name ?? s.Id}
                </Text>
                <Text style={type.small}>
                  {[s.ProviderName, s.Format?.toUpperCase(), s.DownloadCount ? `${s.DownloadCount.toLocaleString()} downloads` : undefined, s.IsHashMatch ? 'Exact file match' : undefined]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
              <Pressable
                onPress={() => download(s)}
                disabled={state === 'busy' || state === 'done'}
                style={styles.get}
                accessibilityLabel={`Download ${s.Name ?? 'subtitle'}`}
              >
                <Ionicons
                  name={state === 'done' ? 'checkmark' : state === 'failed' ? 'alert' : state === 'busy' ? 'hourglass-outline' : 'download-outline'}
                  size={20}
                  color={state === 'done' ? colors.success : state === 'failed' ? colors.danger : colors.text}
                />
              </Pressable>
            </View>
          );
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  heading: { color: colors.textDim, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  error: { color: colors.danger, fontSize: 13 },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  name: { color: colors.text, fontSize: 14, fontWeight: '500' },
  get: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
});
