import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BaseItem } from '@/api/jellyfin';
import { SeerrResult, statusBadge, titleOf, tmdbImage, yearOf } from '@/api/seerr';
import { CardData, PosterCard } from '@/components/cards';
import { Chip, Empty, ErrorView, Loading } from '@/components/ui';
import { openItem, toPosterCard } from '@/lib/items';
import { useSession } from '@/lib/session';
import { colors, radius, spacing } from '@/lib/theme';
import { useAsync } from '@/lib/useAsync';

type Scope = 'library' | 'seerr';

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function Search() {
  const { client, seerr } = useSession();
  const { width } = useWindowDimensions();
  const [text, setText] = useState('');
  const [scope, setScope] = useState<Scope>('library');
  const term = useDebounced(text.trim(), 350);

  const results = useAsync(async (): Promise<{ card: CardData; open: () => void }[]> => {
    if (term.length < 2) return [];
    if (scope === 'seerr' && seerr) {
      const page = await seerr.search(term);
      return page.results
        .filter((r): r is SeerrResult & { mediaType: 'movie' | 'tv' } => r.mediaType === 'movie' || r.mediaType === 'tv')
        .map((r) => ({
          card: {
            key: `${r.mediaType}-${r.id}`,
            title: titleOf(r),
            subtitle: [yearOf(r), r.mediaType === 'tv' ? 'Series' : 'Movie'].filter(Boolean).join(' · '),
            image: tmdbImage(r.posterPath),
            badge: statusBadge(r.mediaInfo?.status),
          },
          open: () => router.push({ pathname: '/seerr/[type]/[id]', params: { type: r.mediaType, id: String(r.id) } }),
        }));
    }
    if (!client) return [];
    const res = await client.search(term);
    return res.Items.map((i: BaseItem) => ({ card: toPosterCard(client, i), open: () => openItem(i) }));
  }, [term, scope, client, seerr]);

  const columns = Math.max(3, Math.floor((width - spacing.lg * 2) / 130));
  const cardWidth = (width - spacing.lg * 2 - spacing.sm * (columns - 1)) / columns;

  return (
    <View style={styles.screen}>
      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={colors.textDim} />
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={scope === 'seerr' ? 'Search movies & shows to request' : 'Search your libraries'}
          placeholderTextColor={colors.textDim}
          style={styles.input}
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>
      {seerr && (
        <View style={styles.scopes}>
          <Chip label="Library" active={scope === 'library'} onPress={() => setScope('library')} />
          <Chip label="Request (Seerr)" active={scope === 'seerr'} onPress={() => setScope('seerr')} />
        </View>
      )}
      {term.length < 2 ? (
        <Empty icon="search" message="Type at least two characters to search." />
      ) : results.error ? (
        <ErrorView error={results.error} onRetry={results.reload} />
      ) : results.loading && !results.data?.length ? (
        <Loading />
      ) : !results.data?.length ? (
        <Empty icon="search" message={`No results for “${term}”.`} />
      ) : (
        <FlatList
          data={results.data}
          key={columns}
          numColumns={columns}
          keyExtractor={(r) => r.card.key}
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
          columnWrapperStyle={{ gap: spacing.sm }}
          renderItem={({ item }) => <PosterCard width={cardWidth} data={item.card} onPress={item.open} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: { flex: 1, color: colors.text, fontSize: 16, paddingVertical: 12 },
  scopes: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
});
