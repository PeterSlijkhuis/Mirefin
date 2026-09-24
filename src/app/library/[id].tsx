import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { BaseItem } from '@/api/jellyfin';
import { PosterCard } from '@/components/cards';
import { Chip, Empty, ErrorView, Loading } from '@/components/ui';
import { openItem, toPosterCard } from '@/lib/items';
import { useClient } from '@/lib/session';
import { colors, spacing } from '@/lib/theme';
import { useAsync } from '@/lib/useAsync';

const PAGE = 60;

const SORTS = [
  { label: 'A–Z', sortBy: 'SortName', order: 'Ascending' },
  { label: 'Recently added', sortBy: 'DateCreated', order: 'Descending' },
  { label: 'Release date', sortBy: 'PremiereDate,ProductionYear', order: 'Descending' },
  { label: 'Rating', sortBy: 'CommunityRating', order: 'Descending' },
  { label: 'Random', sortBy: 'Random', order: 'Ascending' },
] as const;

const FILTERS = [
  { label: 'All', filters: undefined },
  { label: 'Unwatched', filters: 'IsUnplayed' },
  { label: 'Favorites', filters: 'IsFavorite' },
] as const;

function includeTypes(collectionType?: string): string | undefined {
  switch (collectionType) {
    case 'movies':
      return 'Movie';
    case 'tvshows':
      return 'Series';
    case 'boxsets':
      return 'BoxSet';
    case 'homevideos':
      return 'Video,Photo';
    default:
      return undefined;
  }
}

export default function Library() {
  const client = useClient();
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const { width } = useWindowDimensions();
  const [sort, setSort] = useState(0);
  const [filter, setFilter] = useState(0);
  const [items, setItems] = useState<BaseItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const generation = useRef(0);

  const parent = useAsync(() => client.item(id), [client, id]);
  const types = includeTypes(parent.data?.CollectionType);
  // Collection libraries are flat; other folders we browse recursively by type.
  const recursive = !!types;

  const fetchPage = useCallback(
    (start: number) =>
      client.items({
        parentId: id,
        includeItemTypes: types,
        recursive,
        sortBy: SORTS[sort].sortBy,
        sortOrder: SORTS[sort].order,
        filters: FILTERS[filter].filters,
        startIndex: start,
        limit: PAGE,
      }),
    [client, id, types, recursive, sort, filter],
  );

  const first = useAsync(async () => {
    if (!parent.data) return undefined;
    return fetchPage(0);
  }, [fetchPage, parent.data]);

  useEffect(() => {
    generation.current++;
    if (first.data) {
      setItems(first.data.Items);
      setTotal(first.data.TotalRecordCount);
    }
  }, [first.data]);

  const loadMore = async () => {
    if (loadingMore || items.length >= total) return;
    const gen = generation.current;
    setLoadingMore(true);
    try {
      const page = await fetchPage(items.length);
      if (gen === generation.current) setItems((prev) => [...prev, ...page.Items]);
    } finally {
      setLoadingMore(false);
    }
  };

  const columns = Math.max(3, Math.floor((width - spacing.lg * 2) / 130));
  const cardWidth = (width - spacing.lg * 2 - spacing.sm * (columns - 1)) / columns;

  const title = name ?? parent.data?.Name ?? '';
  const error = parent.error ?? first.error;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title }} />
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {FILTERS.map((f, i) => (
            <Chip key={f.label} label={f.label} active={i === filter} onPress={() => setFilter(i)} />
          ))}
          <View style={styles.divider} />
          {SORTS.map((s, i) => (
            <Chip key={s.label} label={s.label} active={i === sort} onPress={() => setSort(i)} />
          ))}
        </ScrollView>
      </View>
      {error ? (
        <ErrorView error={error} onRetry={first.reload} />
      ) : first.loading && !items.length ? (
        <Loading />
      ) : !items.length ? (
        <Empty message="Nothing matches this filter." />
      ) : (
        <FlatList
          data={items}
          key={columns}
          numColumns={columns}
          keyExtractor={(i) => i.Id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
          columnWrapperStyle={{ gap: spacing.sm }}
          onEndReached={loadMore}
          onEndReachedThreshold={1.5}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.accent} /> : null}
          renderItem={({ item }) => (
            <PosterCard width={cardWidth} data={toPosterCard(client, item)} onPress={() => openItem(item)} />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  chips: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.sm, alignItems: 'center' },
  divider: { width: 1, height: 20, backgroundColor: colors.border, marginHorizontal: spacing.xs },
});
