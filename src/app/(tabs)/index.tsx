import { useCallback, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  backdropUrl,
  BaseItem,
  episodeLabel,
  formatRuntime,
  JellyfinClient,
  logoUrl,
  TICKS_PER_SECOND,
} from '@/api/jellyfin';
import { MediaRow } from '@/components/cards';
import { Hero } from '@/components/Hero';
import { Button, Empty, ErrorView, Loading } from '@/components/ui';
import { openItem, playItem, toPosterCard, toThumbCard } from '@/lib/items';
import { useClient } from '@/lib/session';
import { colors, spacing } from '@/lib/theme';
import { useAsync } from '@/lib/useAsync';
import { useSettings } from '@/lib/settings';

const HOME_COLLECTIONS = new Set(['movies', 'tvshows', 'homevideos', 'musicvideos', 'boxsets', undefined]);

export default function Home() {
  const client = useClient();
  const { settings } = useSettings();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

  const { data, error, loading, reload } = useAsync(async () => {
    const [resume, nextUp, views] = await Promise.all([
      client.resume(20, settings.homeMaxDays),
      client.nextUp(20, undefined, settings.homeMaxDays),
      client.userViews(),
    ]);
    const libraries = views.Items.filter((v) => HOME_COLLECTIONS.has(v.CollectionType));
    const latest = await Promise.all(
      libraries.map(async (lib) => ({ lib, items: await client.latest(lib.Id).catch(() => [] as BaseItem[]) })),
    );
    // An episode already in Continue Watching (or its series) shouldn't show again in Next Up.
    const inProgress = new Set(resume.Items.flatMap((i) => [i.Id, i.SeriesId].filter(Boolean)));
    const upNext = nextUp.Items.filter((i) => !inProgress.has(i.Id) && !(i.SeriesId && inProgress.has(i.SeriesId)));
    return { resume: resume.Items, nextUp: upNext, latest };
  }, [client, settings.homeMaxDays]);

  // Refresh when returning from the player so progress bars stay current.
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) firstFocus.current = false;
      else reload();
    }, [reload]),
  );

  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorView error={error} onRetry={reload} />;
  if (!data) return null;

  const featured: BaseItem | undefined =
    data.resume[0] ?? data.nextUp[0] ?? data.latest.find((l) => l.items.length)?.items[0];

  const hasAnything = data.resume.length || data.nextUp.length || data.latest.some((l) => l.items.length);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingBottom: spacing.xl }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={colors.text}
          progressViewOffset={insets.top}
          onRefresh={() => {
            setRefreshing(true);
            reload();
            setTimeout(() => setRefreshing(false), 600);
          }}
        />
      }
    >
      {featured ? <Featured client={client} item={featured} /> : <View style={{ height: insets.top + spacing.xl }} />}

      {!hasAnything && <Empty message="Nothing here yet. Add some media to your Jellyfin libraries." />}

      <MediaRow
        title="Continue Watching"
        variant="thumb"
        items={data.resume.map((i) => toThumbCard(client, i))}
        onPress={(id) => openItem(data.resume.find((i) => i.Id === id)!)}
      />
      <MediaRow
        title="Next Up"
        variant="thumb"
        items={data.nextUp.map((i) => toThumbCard(client, i))}
        onPress={(id) => openItem(data.nextUp.find((i) => i.Id === id)!)}
      />
      {data.latest.map(({ lib, items }) => (
        <MediaRow
          key={lib.Id}
          title={`Recently Added in ${lib.Name}`}
          items={items.map((i) => toPosterCard(client, i))}
          onPress={(id) => openItem(items.find((i) => i.Id === id)!)}
        />
      ))}
    </ScrollView>
  );
}

function Featured({ client, item }: { client: JellyfinClient; item: BaseItem }) {
  const ep = episodeLabel(item);
  const meta = [
    ep ? `${ep} · ${item.Name}` : item.ProductionYear,
    item.OfficialRating,
    formatRuntime(item.RunTimeTicks),
  ]
    .filter(Boolean)
    .join('  •  ');
  const pos = item.UserData?.PlaybackPositionTicks ?? 0;
  const remaining =
    pos && item.RunTimeTicks ? Math.round((item.RunTimeTicks - pos) / TICKS_PER_SECOND / 60) : undefined;
  return (
    <Hero
      backdrop={backdropUrl(client, item)}
      logo={logoUrl(client, item)}
      title={item.Type === 'Episode' ? item.SeriesName ?? item.Name : item.Name}
      meta={meta}
      overview={item.Overview}
    >
      <View style={styles.heroButtons}>
        <Button
          label={remaining ? `Resume · ${remaining}m left` : 'Play'}
          icon="play"
          onPress={() => playItem(item.Id, pos)}
          style={{ flex: 1 }}
        />
        <Button label="Details" icon="information-circle-outline" variant="secondary" onPress={() => openItem(item)} />
      </View>
    </Hero>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  heroButtons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
});
