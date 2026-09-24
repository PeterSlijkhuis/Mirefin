import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Empty, ProgressBar } from '@/components/ui';
import { formatBytes, useDownloads } from '@/lib/downloads';
import { colors, radius, spacing, type } from '@/lib/theme';

export default function Downloads() {
  const { records, cancel, remove } = useDownloads();
  const used = records.filter((r) => r.status === 'done').reduce((n, r) => n + r.total, 0);

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
      data={records}
      keyExtractor={(r) => r.itemId}
      ListHeaderComponent={records.length ? <Text style={type.small}>{formatBytes(used)} on this device</Text> : null}
      ListEmptyComponent={<Empty message="Downloaded movies and episodes show up here, ready to watch without a connection." icon="download-outline" />}
      renderItem={({ item: r }) => (
        <Pressable
          style={styles.row}
          disabled={r.status !== 'done'}
          onPress={() => router.push({ pathname: '/player/[id]', params: { id: r.itemId, offline: '1' } })}
        >
          {r.posterUri ? <Image source={r.posterUri} style={styles.poster} /> : <View style={styles.poster} />}
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.title} numberOfLines={1}>
              {r.title}
            </Text>
            {r.subtitle ? (
              <Text style={type.meta} numberOfLines={1}>
                {r.subtitle}
              </Text>
            ) : null}
            {r.status === 'downloading' && (
              <>
                <ProgressBar value={r.total ? r.bytes / r.total : 0} />
                <Text style={type.small}>
                  {formatBytes(r.bytes)} of {r.total ? formatBytes(r.total) : '?'}
                </Text>
              </>
            )}
            {r.status === 'done' && (
              <Text style={type.small}>
                {formatBytes(r.total)} · {r.original ? 'Original quality' : 'Converted'}
                {r.subtitles.length ? ` · ${r.subtitles.length} subtitles` : ''}
              </Text>
            )}
            {r.status === 'error' && <Text style={[type.small, { color: colors.danger }]}>{r.error ?? 'Failed'}</Text>}
          </View>
          <Pressable
            hitSlop={10}
            onPress={() =>
              r.status === 'downloading'
                ? cancel(r.itemId)
                : Alert.alert('Delete download', `Remove ${r.title} from this device?`, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => remove(r.itemId) },
                  ])
            }
            accessibilityLabel={r.status === 'downloading' ? 'Cancel download' : 'Delete download'}
          >
            <Ionicons name={r.status === 'downloading' ? 'close-circle-outline' : 'trash-outline'} size={22} color={colors.textMuted} />
          </Pressable>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.sm },
  poster: { width: 56, height: 84, borderRadius: radius.sm, backgroundColor: colors.surfaceRaised },
  title: { color: colors.text, fontSize: 15, fontWeight: '600' },
});
