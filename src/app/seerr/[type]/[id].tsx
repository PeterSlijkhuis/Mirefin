import { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import {
  MediaStatus,
  SeerrDetails,
  SeerrMediaType,
  statusLabel,
  titleOf,
  tmdbImage,
  yearOf,
} from '@/api/seerr';
import { Hero } from '@/components/Hero';
import { Badge, Button, ErrorView, Loading } from '@/components/ui';
import { openItem } from '@/lib/items';
import { useSession } from '@/lib/session';
import { colors, radius, spacing, type } from '@/lib/theme';
import { useAsync } from '@/lib/useAsync';

export default function SeerrDetail() {
  const { seerr } = useSession();
  const params = useLocalSearchParams<{ type: string; id: string }>();
  const mediaType = (params.type === 'tv' ? 'tv' : 'movie') as SeerrMediaType;
  const tmdbId = Number(params.id);

  const { data, error, loading, reload } = useAsync(async () => {
    if (!seerr) throw new Error('No Seerr server is connected.');
    return seerr.details(mediaType, tmdbId);
  }, [seerr, mediaType, tmdbId]);

  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorView error={error ?? new Error('Not found')} onRetry={reload} />;

  return <Details details={data} mediaType={mediaType} tmdbId={tmdbId} onRequested={reload} />;
}

function Details({
  details,
  mediaType,
  tmdbId,
  onRequested,
}: {
  details: SeerrDetails;
  mediaType: SeerrMediaType;
  tmdbId: number;
  onRequested: () => void;
}) {
  const { seerr } = useSession();
  const [busy, setBusy] = useState(false);
  const status = details.mediaInfo?.status;
  const label = statusLabel(status);

  // Seasons that are not yet requested or available can be picked.
  const seasonStatus = new Map(details.mediaInfo?.seasons?.map((s) => [s.seasonNumber, s.status]) ?? []);
  const seasons = (details.seasons ?? []).filter((s) => s.seasonNumber > 0);
  const requestable = seasons.filter((s) => {
    const st = seasonStatus.get(s.seasonNumber);
    return !st || st === MediaStatus.Unknown || st === MediaStatus.Deleted;
  });
  const [picked, setPicked] = useState<Set<number>>(new Set());
  useEffect(() => setPicked(new Set(requestable.map((s) => s.seasonNumber))), [details]); // eslint-disable-line react-hooks/exhaustive-deps

  const canRequest =
    mediaType === 'movie'
      ? !status || status === MediaStatus.Unknown || status === MediaStatus.Deleted
      : requestable.length > 0;

  const submit = async () => {
    if (!seerr) return;
    setBusy(true);
    try {
      await seerr.request(mediaType, tmdbId, mediaType === 'tv' ? [...picked] : undefined);
      Alert.alert('Requested', `${titleOf(details)} has been requested.`);
      onRequested();
    } catch (e) {
      Alert.alert('Request failed', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const runtime = details.runtime ?? details.episodeRunTime?.[0];
  const meta = [
    yearOf(details),
    mediaType === 'tv' ? `${details.numberOfSeasons ?? seasons.length} seasons` : undefined,
    runtime ? `${runtime}m` : undefined,
    details.voteAverage ? `★ ${details.voteAverage.toFixed(1)}` : undefined,
  ]
    .filter(Boolean)
    .join('  •  ');

  const jellyfinId = details.mediaInfo?.jellyfinMediaId;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
      <Hero backdrop={tmdbImage(details.backdropPath, 'w1280')} title={titleOf(details)} meta={meta}>
        {label && (
          <Badge
            label={label}
            tone={status === MediaStatus.Available ? 'success' : status === MediaStatus.PartiallyAvailable ? 'accent' : 'warning'}
          />
        )}
      </Hero>

      <View style={styles.body}>
        {jellyfinId && (
          <Button
            label="Open in library"
            icon="play"
            onPress={() => openItem({ Id: jellyfinId, Type: mediaType === 'tv' ? 'Series' : 'Movie', Name: titleOf(details) })}
          />
        )}

        {mediaType === 'tv' && requestable.length > 0 && (
          <View style={{ gap: spacing.sm }}>
            <Text style={type.rowTitle}>Seasons to request</Text>
            {seasons.map((s) => {
              const st = seasonStatus.get(s.seasonNumber);
              const disabled = !requestable.includes(s);
              const on = picked.has(s.seasonNumber);
              return (
                <Pressable
                  key={s.id}
                  disabled={disabled}
                  onPress={() => {
                    const next = new Set(picked);
                    if (on) next.delete(s.seasonNumber);
                    else next.add(s.seasonNumber);
                    setPicked(next);
                  }}
                  style={[styles.season, disabled && { opacity: 0.5 }]}
                >
                  <Ionicons
                    name={disabled ? 'checkmark-done' : on ? 'checkbox' : 'square-outline'}
                    size={20}
                    color={on || disabled ? colors.accent : colors.textMuted}
                  />
                  <Text style={[type.body, { flex: 1 }]}>{s.name}</Text>
                  <Text style={type.small}>{disabled ? statusLabel(st) : `${s.episodeCount} episodes`}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {canRequest ? (
          <Button
            label={mediaType === 'tv' ? `Request ${picked.size} season${picked.size === 1 ? '' : 's'}` : 'Request'}
            icon="add-circle-outline"
            variant={jellyfinId ? 'secondary' : 'primary'}
            onPress={submit}
            loading={busy}
            disabled={busy || (mediaType === 'tv' && picked.size === 0)}
          />
        ) : null}

        {details.tagline ? <Text style={styles.tagline}>{details.tagline}</Text> : null}
        {details.overview ? <Text style={type.body}>{details.overview}</Text> : null}
        {details.genres?.length ? (
          <Text style={type.meta}>
            <Text style={{ color: colors.textDim }}>Genres  </Text>
            {details.genres.map((g) => g.name).join(', ')}
          </Text>
        ) : null}
      </View>

      {details.credits?.cast?.length ? (
        <View>
          <Text style={[type.rowTitle, { paddingHorizontal: spacing.lg, marginBottom: spacing.sm }]}>Cast</Text>
          <FlatList
            horizontal
            data={details.credits.cast.slice(0, 20)}
            keyExtractor={(c, i) => `${c.id}-${i}`}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}
            renderItem={({ item: c }) => (
              <View style={styles.person}>
                <View style={styles.personImg}>
                  {c.profilePath ? (
                    <Image source={tmdbImage(c.profilePath, 'w185')} style={StyleSheet.absoluteFill} contentFit="cover" />
                  ) : (
                    <Ionicons name="person" size={28} color={colors.textDim} />
                  )}
                </View>
                <Text style={styles.personName} numberOfLines={1}>
                  {c.name}
                </Text>
                <Text style={type.small} numberOfLines={1}>
                  {c.character}
                </Text>
              </View>
            )}
          />
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  body: { paddingHorizontal: spacing.lg, gap: spacing.md, marginBottom: spacing.xl },
  tagline: { color: colors.textMuted, fontStyle: 'italic', fontSize: 14 },
  season: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
  },
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
