import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, type } from '@/lib/theme';
import { ProgressBar } from './ui';

export const POSTER_WIDTH = 116;
export const THUMB_WIDTH = 220;

export interface CardData {
  key: string;
  title: string;
  subtitle?: string;
  image?: string;
  progress?: number;
  played?: boolean;
  unplayedCount?: number;
  badge?: string;
}

export function PosterCard({
  data,
  width = POSTER_WIDTH,
  onPress,
}: {
  data: CardData;
  width?: number;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ width, opacity: pressed ? 0.75 : 1 }]}>
      <View style={[styles.poster, { width, height: width * 1.5 }]}>
        {data.image ? (
          <Image source={data.image} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} recyclingKey={data.key} />
        ) : (
          <Placeholder title={data.title} />
        )}
        <Corner data={data} />
        {data.progress !== undefined && (
          <View style={styles.progressWrap}>
            <ProgressBar value={data.progress} />
          </View>
        )}
      </View>
      <Text style={styles.title} numberOfLines={1}>
        {data.title}
      </Text>
      {data.subtitle ? (
        <Text style={styles.subtitle} numberOfLines={1}>
          {data.subtitle}
        </Text>
      ) : null}
    </Pressable>
  );
}

export function ThumbCard({
  data,
  width = THUMB_WIDTH,
  onPress,
}: {
  data: CardData;
  width?: number;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ width, opacity: pressed ? 0.75 : 1 }]}>
      <View style={[styles.poster, { width, height: (width * 9) / 16 }]}>
        {data.image ? (
          <Image source={data.image} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} recyclingKey={data.key} />
        ) : (
          <Placeholder title={data.title} />
        )}
        <Corner data={data} />
        {data.progress !== undefined && (
          <View style={styles.progressWrap}>
            <ProgressBar value={data.progress} />
          </View>
        )}
      </View>
      <Text style={styles.title} numberOfLines={1}>
        {data.title}
      </Text>
      {data.subtitle ? (
        <Text style={styles.subtitle} numberOfLines={1}>
          {data.subtitle}
        </Text>
      ) : null}
    </Pressable>
  );
}

function Corner({ data }: { data: CardData }) {
  if (data.badge) {
    return (
      <View style={[styles.corner, { backgroundColor: colors.accent }]}>
        <Text style={styles.cornerText}>{data.badge}</Text>
      </View>
    );
  }
  if (data.played) {
    return (
      <View style={[styles.corner, { backgroundColor: colors.accent }]}>
        <Ionicons name="checkmark" size={12} color="#fff" />
      </View>
    );
  }
  if (data.unplayedCount) {
    return (
      <View style={[styles.corner, { backgroundColor: colors.accent }]}>
        <Text style={styles.cornerText}>{data.unplayedCount}</Text>
      </View>
    );
  }
  return null;
}

function Placeholder({ title }: { title: string }) {
  return (
    <View style={[StyleSheet.absoluteFill, styles.placeholder]}>
      <Text style={styles.placeholderText} numberOfLines={3}>
        {title}
      </Text>
    </View>
  );
}

/** A titled horizontal row, the building block of Wholphin's home page. */
export function MediaRow({
  title,
  items,
  variant = 'poster',
  onPress,
}: {
  title: string;
  items: CardData[];
  variant?: 'poster' | 'thumb';
  onPress: (key: string) => void;
}) {
  if (!items.length) return null;
  const Card = variant === 'thumb' ? ThumbCard : PosterCard;
  return (
    <View style={styles.row}>
      <Text style={[type.rowTitle, styles.rowTitle]}>{title}</Text>
      <FlatList
        horizontal
        data={items}
        keyExtractor={(i) => i.key}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}
        renderItem={({ item }) => <Card data={item} onPress={() => onPress(item.key)} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  poster: {
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: colors.surfaceRaised,
  },
  title: { color: colors.text, fontSize: 13, fontWeight: '600', marginTop: 6 },
  subtitle: { color: colors.textDim, fontSize: 12, marginTop: 1 },
  progressWrap: { position: 'absolute', left: 6, right: 6, bottom: 6 },
  corner: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cornerText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  placeholder: { alignItems: 'center', justifyContent: 'center', padding: spacing.sm },
  placeholderText: { color: colors.textMuted, fontSize: 13, textAlign: 'center', fontWeight: '600' },
  row: { marginBottom: spacing.xl },
  rowTitle: { paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
});
