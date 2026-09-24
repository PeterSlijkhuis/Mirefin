import { router } from 'expo-router';
import {
  BaseItem,
  episodeLabel,
  JellyfinClient,
  posterUrl,
  progressFraction,
  thumbUrl,
} from '@/api/jellyfin';
import { CardData } from '@/components/cards';

export function toPosterCard(c: JellyfinClient, item: BaseItem): CardData {
  return {
    key: item.Id,
    title: item.Type === 'Episode' ? item.SeriesName ?? item.Name : item.Name,
    subtitle: item.Type === 'Episode' ? episodeLabel(item) : item.ProductionYear?.toString(),
    image: posterUrl(c, item),
    progress: progressFraction(item),
    played: item.UserData?.Played,
    unplayedCount: item.Type === 'Series' ? item.UserData?.UnplayedItemCount : undefined,
  };
}

export function toThumbCard(c: JellyfinClient, item: BaseItem): CardData {
  const ep = episodeLabel(item);
  return {
    key: item.Id,
    title: item.Type === 'Episode' ? item.SeriesName ?? item.Name : item.Name,
    subtitle: item.Type === 'Episode' ? [ep, item.Name].filter(Boolean).join(' · ') : item.ProductionYear?.toString(),
    image: thumbUrl(c, item),
    progress: progressFraction(item),
    played: item.UserData?.Played,
  };
}

const FOLDER_TYPES = new Set(['CollectionFolder', 'UserView', 'Folder', 'BoxSet', 'Playlist']);

export function openItem(item: Pick<BaseItem, 'Id' | 'Type' | 'Name'>) {
  if (FOLDER_TYPES.has(item.Type)) {
    router.push({ pathname: '/library/[id]', params: { id: item.Id, name: item.Name } });
  } else {
    router.push({ pathname: '/item/[id]', params: { id: item.Id } });
  }
}

export function playItem(id: string, startTicks?: number) {
  router.push({ pathname: '/player/[id]', params: { id, start: String(startTicks ?? 0) } });
}
