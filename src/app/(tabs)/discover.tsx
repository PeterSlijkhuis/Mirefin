import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SeerrPage, SeerrResult, statusBadge, titleOf, tmdbImage, yearOf } from '@/api/seerr';
import { CardData, MediaRow } from '@/components/cards';
import { Button, Empty, ErrorView, Loading } from '@/components/ui';
import { useSession } from '@/lib/session';
import { colors, spacing, type } from '@/lib/theme';
import { useAsync } from '@/lib/useAsync';

function toCard(r: SeerrResult): CardData {
  return {
    key: `${r.mediaType}-${r.id}`,
    title: titleOf(r),
    subtitle: yearOf(r),
    image: tmdbImage(r.posterPath),
    badge: statusBadge(r.mediaInfo?.status),
  };
}

function openResult(key: string) {
  const [type, id] = key.split('-');
  router.push({ pathname: '/seerr/[type]/[id]', params: { type, id } });
}

const media = (p: SeerrPage) => p.results.filter((r) => r.mediaType === 'movie' || r.mediaType === 'tv');

export default function Discover() {
  const { seerr } = useSession();

  const { data, error, loading, reload } = useAsync(async () => {
    if (!seerr) return undefined;
    const [trending, movies, tv, upcoming] = await Promise.all([
      seerr.trending(),
      seerr.popularMovies(),
      seerr.popularTv(),
      seerr.upcomingMovies(),
    ]);
    return [
      { title: 'Trending', items: media(trending) },
      { title: 'Popular Movies', items: movies.results.map((r) => ({ ...r, mediaType: 'movie' as const })) },
      { title: 'Popular Series', items: tv.results.map((r) => ({ ...r, mediaType: 'tv' as const })) },
      { title: 'Upcoming Movies', items: upcoming.results.map((r) => ({ ...r, mediaType: 'movie' as const })) },
    ];
  }, [seerr]);

  if (!seerr) {
    return (
      <View style={styles.setup}>
        <Empty
          icon="compass-outline"
          message="Connect a Seerr (Jellyseerr) server to discover and request new movies and shows."
        />
        <Button label="Connect Seerr" icon="link" onPress={() => router.push('/seerr-settings')} style={styles.setupButton} />
      </View>
    );
  }

  if (loading && !data) return <Loading />;
  if (error) return <ErrorView error={error} onRetry={reload} />;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingVertical: spacing.md }}>
      <Text style={[type.meta, styles.hint]}>Tap a title to see details and request it.</Text>
      {data?.map((row) => (
        <MediaRow key={row.title} title={row.title} items={row.items.map(toCard)} onPress={openResult} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  hint: { paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  setup: { flex: 1, backgroundColor: colors.background, paddingBottom: spacing.xxl },
  setupButton: { marginHorizontal: spacing.xl },
});
