import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Directory, File, Paths } from 'expo-file-system';
import { BaseItem, episodeLabel, JellyfinClient, MediaStream, posterUrl } from '@/api/jellyfin';
import { TEXT_SUBTITLE_CODECS } from '@/api/deviceProfile';
import { Settings } from './settings';

export interface DownloadedSubtitle {
  index: number;
  language?: string;
  label: string;
  uri: string;
}

export interface DownloadRecord {
  itemId: string;
  item: BaseItem;
  title: string;
  subtitle?: string;
  status: 'downloading' | 'done' | 'error';
  error?: string;
  bytes: number;
  total: number;
  /** True when the original file was downloaded rather than a transcode. */
  original: boolean;
  videoUri?: string;
  posterUri?: string;
  streams: MediaStream[];
  subtitles: DownloadedSubtitle[];
  addedAt: number;
}

const root = () => new Directory(Paths.document, 'downloads');
const indexFile = () => new File(root(), 'index.json');

interface DownloadsContextValue {
  records: DownloadRecord[];
  get: (itemId: string) => DownloadRecord | undefined;
  start: (client: JellyfinClient, settings: Settings, itemId: string) => Promise<void>;
  cancel: (itemId: string) => void;
  remove: (itemId: string) => void;
}

const DownloadsContext = createContext<DownloadsContextValue | null>(null);

export function DownloadsProvider({ children }: { children: React.ReactNode }) {
  const [records, setRecords] = useState<DownloadRecord[]>([]);
  const controllers = useRef(new Map<string, AbortController>());

  useEffect(() => {
    try {
      const f = indexFile();
      if (!f.exists) return;
      const saved: DownloadRecord[] = JSON.parse(f.textSync());
      // Anything still "downloading" was interrupted when the app closed.
      setRecords(saved.map((r) => (r.status === 'downloading' ? { ...r, status: 'error', error: 'Interrupted' } : r)));
    } catch {}
  }, []);

  const save = (next: DownloadRecord[]) => {
    try {
      root().create({ idempotent: true, intermediates: true });
      indexFile().write(JSON.stringify(next));
    } catch {}
  };

  const patch = useCallback((itemId: string, change: Partial<DownloadRecord>, persist = true) => {
    setRecords((prev) => {
      const next = prev.map((r) => (r.itemId === itemId ? { ...r, ...change } : r));
      if (persist) save(next);
      return next;
    });
  }, []);

  const start = useCallback(
    async (client: JellyfinClient, settings: Settings, itemId: string) => {
      const item = await client.item(itemId);
      const source = item.MediaSources?.[0];
      if (!source) throw new Error('This item has no downloadable media.');
      const original = !settings.downloadBitrate;
      const dir = new Directory(root(), itemId);
      if (dir.exists) dir.delete();
      dir.create({ intermediates: true });

      const record: DownloadRecord = {
        itemId,
        item,
        title: item.Type === 'Episode' ? item.SeriesName ?? item.Name : item.Name,
        subtitle: item.Type === 'Episode' ? [episodeLabel(item), item.Name].filter(Boolean).join(' · ') : item.ProductionYear?.toString(),
        status: 'downloading',
        bytes: 0,
        total: source.Size ?? 0,
        original,
        streams: source.MediaStreams ?? [],
        subtitles: [],
        addedAt: Date.now(),
      };
      setRecords((prev) => {
        const next = [record, ...prev.filter((r) => r.itemId !== itemId)];
        save(next);
        return next;
      });

      const controller = new AbortController();
      controllers.current.set(itemId, controller);
      try {
        const poster = posterUrl(client, item, 400);
        let posterUri: string | undefined;
        if (poster) {
          posterUri = (await File.downloadFileAsync(poster, new File(dir, 'poster.jpg'), { idempotent: true })).uri;
        }

        // Text subtitles as WebVTT, so every player can show them offline.
        const subtitles: DownloadedSubtitle[] = [];
        if (settings.downloadSubtitles) {
          for (const s of record.streams) {
            if (s.Type !== 'Subtitle' || !TEXT_SUBTITLE_CODECS.includes((s.Codec ?? '').toLowerCase())) continue;
            try {
              const f = await File.downloadFileAsync(
                client.subtitleUrl(itemId, source.Id, s.Index, 'vtt'),
                new File(dir, `sub-${s.Index}.vtt`),
                { idempotent: true, headers: client.authHeaders },
              );
              subtitles.push({ index: s.Index, language: s.Language, label: s.DisplayTitle ?? s.Language ?? `Track ${s.Index}`, uri: f.uri });
            } catch {}
          }
        }

        const ext = original ? (source.Container ?? 'mkv').split(',')[0] : 'mp4';
        let lastUpdate = 0;
        const video = await File.downloadFileAsync(
          client.downloadUrl(itemId, source.Id, settings.downloadBitrate),
          new File(dir, `video.${ext}`),
          {
            idempotent: true,
            headers: client.authHeaders,
            signal: controller.signal,
            onProgress: ({ bytesWritten, totalBytes }) => {
              const now = Date.now();
              if (now - lastUpdate < 500) return;
              lastUpdate = now;
              patch(itemId, { bytes: bytesWritten, total: totalBytes > 0 ? totalBytes : record.total }, false);
            },
          },
        );
        patch(itemId, {
          status: 'done',
          videoUri: video.uri,
          posterUri,
          subtitles,
          bytes: video.size ?? record.total,
          total: video.size ?? record.total,
        });
      } catch (e) {
        const aborted = controller.signal.aborted;
        patch(itemId, { status: 'error', error: aborted ? 'Cancelled' : e instanceof Error ? e.message : String(e) });
      } finally {
        controllers.current.delete(itemId);
      }
    },
    [patch],
  );

  const cancel = useCallback((itemId: string) => controllers.current.get(itemId)?.abort(), []);

  const remove = useCallback((itemId: string) => {
    controllers.current.get(itemId)?.abort();
    try {
      const dir = new Directory(root(), itemId);
      if (dir.exists) dir.delete();
    } catch {}
    setRecords((prev) => {
      const next = prev.filter((r) => r.itemId !== itemId);
      save(next);
      return next;
    });
  }, []);

  const get = useCallback((itemId: string) => records.find((r) => r.itemId === itemId), [records]);

  const value = useMemo(() => ({ records, get, start, cancel, remove }), [records, get, start, cancel, remove]);
  return <DownloadsContext.Provider value={value}>{children}</DownloadsContext.Provider>;
}

export function useDownloads() {
  const ctx = useContext(DownloadsContext);
  if (!ctx) throw new Error('useDownloads must be used inside DownloadsProvider');
  return ctx;
}

export function formatBytes(n: number): string {
  if (!n) return '0 MB';
  const gb = n / 1024 ** 3;
  return gb >= 1 ? `${gb.toFixed(2)} GB` : `${Math.round(n / 1024 ** 2)} MB`;
}
