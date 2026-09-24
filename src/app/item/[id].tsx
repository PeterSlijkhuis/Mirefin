import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { CastButton } from 'react-native-google-cast';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import {
  backdropUrl,
  BaseItem,
  episodeLabel,
  formatRuntime,
  JellyfinClient,
  logoUrl,
  progressFraction,
  thumbUrl,
  TICKS_PER_SECOND,
} from '@/api/jellyfin';
import { MediaRow } from '@/components/cards';
import { Hero } from '@/components/Hero';
import { Button, Chip, ErrorView, IconButton, Loading, ProgressBar } from '@/components/ui';
import { openItem, playItem, toPosterCard } from '@/lib/items';
import { formatBytes, useDownloads } from '@/lib/downloads';
import { useClient } from '@/lib/session';
import { useSettings } from '@/lib/settings';
import { colors, radius, spacing, type } from '@/lib/theme';
import { useAsync } from '@/lib/useAsync';

export default function ItemDetail() {
  const client = useClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: item, error, loading, reload } = useAsync(() => client.item(id), [client, id]);

  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) firstFocus.current = false;
      else reload();
    }, [reload]),
  );

  if (loading && !item) return <Loading />;
  if (error && !item) return <ErrorView error={error} onRetry={reload} />;
  if (!item) return null;

  return <Detail client={client} item={item} onChanged={reload} />;
}

function Detail({ client, item, onChanged }: { client: JellyfinClient; item: BaseItem; onChanged: () => void }) {
  const isSeries = item.Type === 'Series' || item.Type === 'Season';
  const seriesId = item.Type === 'Series' ? item.Id : item.SeriesId;

  const [played, setPlayed] = useState(!!item.UserData?.Played);
  const [favorite, setFavorite] = useState(!!item.UserData?.IsFavorite);
  useEffect(() => {
    setPlayed(!!item.UserData?.Played);
    setFavorite(!!item.UserData?.IsFavorite);
  }, [item]);

  const similar = useAsync(() => client.similar(item.Id), [client, item.Id]);
  const nextUp = useAsync(
    async () => (item.Type === 'Series' ? (await client.nextUp(1, item.Id)).Items : []),
    [client, item.Id],
  );

  const ep = episodeLabel(item);
  const meta = [
    item.Type === 'Episode' ? item.SeriesName : undefined,
    ep,
    item.ProductionYear,
    item.OfficialRating,
    formatRuntime(item.RunTimeTicks),
    item.CommunityRating ? `★ ${item.CommunityRating.toFixed(1)}` : undefined,
    item.Type === 'Series' && item.Status === 'Continuing' ? 'Continuing' : undefined,
  ]
    .filter(Boolean)
    .join('  •  ');

  const pos = item.UserData?.PlaybackPositionTicks ?? 0;
  const progress = progressFraction(item);
  const remaining = pos && item.RunTimeTicks ? Math.round((item.RunTimeTicks - pos) / TICKS_PER_SECOND / 60) : 0;

  // For series, "Play" starts the next-up episode (or the first one).
  const seriesNext = nextUp.data?.find((e) => e.SeriesId === item.Id);

  const togglePlayed = async () => {
    const next = !played;
    setPlayed(next);
    try {
      await client.setPlayed(item.Id, next);
      onChanged();
    } catch {
      setPlayed(!next);
    }
  };

  const toggleFavorite = async () => {
    const next = !favorite;
    setFavorite(next);
    try {
      await client.setFavorite(item.Id, next);
    } catch {
      setFavorite(!next);
    }
  };

  const title = item.Type === 'Episode' ? item.Name : item.Type === 'Season' ? `${item.SeriesName} · ${item.Name}` : item.Name;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
      <Hero
        backdrop={backdropUrl(client, item)}
        logo={item.Type === 'Episode' ? undefined : logoUrl(client, item)}
        title={title}
        meta={meta}
      >
        {progress !== undefined && (
          <View style={{ marginTop: spacing.xs }}>
            <ProgressBar value={progress} />
          </View>
        )}
      </Hero>

      <View style={styles.body}>
        {item.Type !== 'Series' && item.Type !== 'Season' ? (
          <Button
            label={remaining ? `Resume · ${remaining}m left` : 'Play'}
            icon="play"
            onPress={() => playItem(item.Id, pos)}
          />
        ) : seriesNext ? (
          <Button
            label={`Play ${episodeLabel(seriesNext) ?? seriesNext.Name}`}
            icon="play"
            onPress={() => playItem(seriesNext.Id, seriesNext.UserData?.PlaybackPositionTicks)}
          />
        ) : null}

        {pos > 0 && item.Type !== 'Series' && (
          <Button label="Play from beginning" icon="refresh" variant="secondary" onPress={() => playItem(item.Id, 0)} />
        )}

        <View style={styles.actions}>
          <IconButton
            icon={played ? 'checkmark-circle' : 'checkmark-circle-outline'}
            label={played ? 'Watched' : 'Mark watched'}
            active={played}
            onPress={togglePlayed}
          />
          <IconButton
            icon={favorite ? 'heart' : 'heart-outline'}
            label="Favorite"
            active={favorite}
            onPress={toggleFavorite}
          />
          {!isSeries && <DownloadButton client={client} item={item} />}
          {!isSeries && (
            <IconButton
              icon="chatbox-ellipses-outline"
              label="Subtitles"
              onPress={() => router.push({ pathname: '/subtitles/[id]', params: { id: item.Id } })}
            />
          )}
          {!isSeries && (
            <View style={styles.cast}>
              <View style={styles.castCircle}>
                <CastButton style={{ width: 22, height: 22, tintColor: colors.text }} tintColor={colors.text} />
              </View>
              <Text style={styles.castLabel}>Cast</Text>
            </View>
          )}
          {item.Type === 'Episode' && item.SeriesId && (
            <IconButton
              icon="tv-outline"
              label="Go to series"
              onPress={() => openItem({ Id: item.SeriesId!, Type: 'Series', Name: item.SeriesName ?? '' })}
            />
          )}
        </View>

        {item.Taglines?.[0] ? <Text style={styles.tagline}>{item.Taglines[0]}</Text> : null}
        {item.Overview ? <Text style={type.body}>{item.Overview}</Text> : null}

        {item.Genres?.length ? (
          <Text style={type.meta}>
            <Text style={{ color: colors.textDim }}>Genres  </Text>
            {item.Genres.join(', ')}
          </Text>
        ) : null}
        {item.Studios?.length ? (
          <Text style={type.meta}>
            <Text style={{ color: colors.textDim }}>Studio  </Text>
            {item.Studios.map((s) => s.Name).join(', ')}
          </Text>
        ) : null}
      </View>

      {isSeries && seriesId && (
        <Seasons client={client} seriesId={seriesId} initialSeasonId={item.Type === 'Season' ? item.Id : undefined} />
      )}

      <Cast client={client} item={item} />

      {similar.data && (
        <MediaRow
          title="More Like This"
          items={similar.data.Items.map((i) => toPosterCard(client, i))}
          onPress={(key) => openItem(similar.data!.Items.find((i) => i.Id === key)!)}
        />
      )}
    </ScrollView>
  );
}

function Seasons({ client, seriesId, initialSeasonId }: { client: JellyfinClient; seriesId: string; initialSeasonId?: string }) {
  const seasons = useAsync(() => client.seasons(seriesId), [client, seriesId]);
  const [seasonId, setSeasonId] = useState<string | undefined>(initialSeasonId);

  useEffect(() => {
    if (!seasonId && seasons.data?.Items.length) {
      // Default to the first season with unwatched episodes, like Wholphin does.
      const firstUnwatched = seasons.data.Items.find((s) => !s.UserData?.Played);
      setSeasonId((firstUnwatched ?? seasons.data.Items[0]).Id);
    }
  }, [seasons.data, seasonId]);

  const episodes = useAsync(
    async () => (seasonId ? client.episodes(seriesId, seasonId) : undefined),
    [client, seriesId, seasonId],
  );

  if (!seasons.data?.Items.length) return null;

  return (
    <View style={{ marginBottom: spacing.xl }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.seasonTabs}>
        {seasons.data.Items.map((s) => (
          <Chip key={s.Id} label={s.Name} active={s.Id === seasonId} onPress={() => setSeasonId(s.Id)} />
        ))}
      </ScrollView>
      {episodes.loading && !episodes.data ? (
        <View style={{ height: 120 }}>
          <Loading />
        </View>
      ) : (
        episodes.data?.Items.map((e) => <EpisodeRow key={e.Id} client={client} episode={e} />)
      )}
    </View>
  );
}

function EpisodeRow({ client, episode }: { client: JellyfinClient; episode: BaseItem }) {
  const img = thumbUrl(client, episode, 400);
  const progress = progressFraction(episode);
  return (
    <Pressable
      style={({ pressed }) => [styles.episode, pressed && { backgroundColor: colors.surface }]}
      onPress={() => openItem(episode)}
    >
      <View style={styles.episodeThumb}>
        {img && <Image source={img} style={StyleSheet.absoluteFill} contentFit="cover" />}
        <Pressable
          style={styles.episodePlay}
          hitSlop={8}
          onPress={() => playItem(episode.Id, episode.UserData?.PlaybackPositionTicks)}
        >
          <Ionicons name="play" size={18} color="#fff" />
        </Pressable>
        {progress !== undefined && (
          <View style={{ position: 'absolute', left: 4, right: 4, bottom: 4 }}>
            <ProgressBar value={progress} />
          </View>
        )}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={styles.episodeTitle} numberOfLines={1}>
            {episode.IndexNumber !== undefined ? `${episode.IndexNumber}. ` : ''}
            {episode.Name}
          </Text>
          {episode.UserData?.Played && <Ionicons name="checkmark-circle" size={14} color={colors.accent} />}
        </View>
        <Text style={type.small}>{formatRuntime(episode.RunTimeTicks)}</Text>
        {episode.Overview ? (
          <Text style={[type.meta, { fontSize: 12 }]} numberOfLines={2}>
            {episode.Overview}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function Cast({ client, item }: { client: JellyfinClient; item: BaseItem }) {
  const people = (item.People ?? []).filter((p) => p.Type === 'Actor' || p.Type === 'Director').slice(0, 20);
  if (!people.length) return null;
  return (
    <View style={{ marginBottom: spacing.xl }}>
      <Text style={[type.rowTitle, { paddingHorizontal: spacing.lg, marginBottom: spacing.sm }]}>Cast & Crew</Text>
      <FlatList
        horizontal
        data={people}
        keyExtractor={(p, i) => `${p.Id}-${i}`}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}
        renderItem={({ item: p }) => (
          <View style={styles.person}>
            <View style={styles.personImg}>
              {p.PrimaryImageTag ? (
                <Image source={client.personImageUrl(p.Id, p.PrimaryImageTag)} style={StyleSheet.absoluteFill} contentFit="cover" />
              ) : (
                <Ionicons name="person" size={28} color={colors.textDim} />
              )}
            </View>
            <Text style={styles.personName} numberOfLines={1}>
              {p.Name}
            </Text>
            <Text style={type.small} numberOfLines={1}>
              {p.Type === 'Director' ? 'Director' : p.Role}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  cast: { alignItems: 'center', gap: spacing.xs, minWidth: 64 },
  castCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  castLabel: { color: colors.textMuted, fontSize: 11 },
  screen: { flex: 1, backgroundColor: colors.background },
  body: { paddingHorizontal: spacing.lg, gap: spacing.md, marginBottom: spacing.xl },
  actions: { flexDirection: 'row', gap: spacing.lg, marginVertical: spacing.sm },
  tagline: { color: colors.textMuted, fontStyle: 'italic', fontSize: 14 },
  seasonTabs: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.md },
  episode: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  episodeThumb: {
    width: 150,
    height: 84,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  episodePlay: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  episodeTitle: { color: colors.text, fontSize: 14, fontWeight: '600', flexShrink: 1 },
  person: { width: 84, alignItems: 'center' },
  personImg: {
    width: 76,
    height: 76,
    borderRadius: 38,
    overflow: 'hidden',
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  personName: { color: colors.text, fontSize: 12, fontWeight: '600', textAlign: 'center' },
});

function DownloadButton({ client, item }: { client: JellyfinClient; item: BaseItem }) {
  const downloads = useDownloads();
  const { settings } = useSettings();
  const record = downloads.get(item.Id);

  if (record?.status === 'done') {
    return (
      <IconButton
        icon="checkmark-done-circle"
        label="Play offline"
        active
        onPress={() => router.push({ pathname: '/player/[id]', params: { id: item.Id, offline: '1' } })}
      />
    );
  }
  if (record?.status === 'downloading') {
    const pct = record.total ? Math.round((record.bytes / record.total) * 100) : 0;
    return <IconButton icon="close-circle-outline" label={`${pct}% · Cancel`} active onPress={() => downloads.cancel(item.Id)} />;
  }
  return (
    <IconButton
      icon="download-outline"
      label={record?.status === 'error' ? 'Retry download' : 'Download'}
      onPress={() => downloads.start(client, settings, item.Id).catch(() => {})}
      accessibilityHint={record?.total ? formatBytes(record.total) : undefined}
    />
  );
}
