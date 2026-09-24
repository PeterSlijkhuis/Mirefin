import { FlatList, useWindowDimensions } from 'react-native';
import { ThumbCard } from '@/components/cards';
import { Empty, ErrorView, Loading } from '@/components/ui';
import { openItem } from '@/lib/items';
import { useClient } from '@/lib/session';
import { spacing } from '@/lib/theme';
import { useAsync } from '@/lib/useAsync';

export default function Libraries() {
  const client = useClient();
  const { width } = useWindowDimensions();
  const { data, error, loading, reload } = useAsync(() => client.userViews(), [client]);

  if (loading && !data) return <Loading />;
  if (error) return <ErrorView error={error} onRetry={reload} />;
  const views = data?.Items ?? [];
  if (!views.length) return <Empty message="No libraries found on this server." icon="albums-outline" />;

  const columns = width > 700 ? 3 : 2;
  const cardWidth = (width - spacing.lg * 2 - spacing.md * (columns - 1)) / columns;

  return (
    <FlatList
      data={views}
      key={columns}
      numColumns={columns}
      keyExtractor={(v) => v.Id}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
      columnWrapperStyle={{ gap: spacing.md }}
      renderItem={({ item }) => (
        <ThumbCard
          width={cardWidth}
          data={{
            key: item.Id,
            title: item.Name,
            image: item.ImageTags?.Primary
              ? client.imageUrl(item.Id, 'Primary', { tag: item.ImageTags.Primary, width: 600 })
              : undefined,
          }}
          onPress={() => openItem(item)}
        />
      )}
    />
  );
}
