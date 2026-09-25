import { Platform } from 'react-native';
import { BaseItem, JellyfinClient, MediaSource, MediaStream, PlaybackReport } from '@/api/jellyfin';
import { ASS_CODECS, buildDeviceProfile, IMAGE_SUBTITLE_CODECS } from '@/api/deviceProfile';
import { availableEngine, FULL_ENGINE, PlayerEngine, sameLanguage, Settings } from './settings';
import type { DownloadRecord } from './downloads';

/** How the selected subtitle reaches the screen. */
export type SubtitleDelivery =
  | { kind: 'none' }
  /** Converted to WebVTT by the server and drawn by the app over the video. */
  | { kind: 'overlay'; url: string }
  /** Burned into the video by a server transcode. */
  | { kind: 'burned' }
  /** One of the file's own tracks, rendered by mpv/VLC (order among embedded subtitle streams). */
  | { kind: 'embedded'; order: number }
  /** A sidecar file mpv/VLC loads alongside the video. */
  | { kind: 'external'; url: string; codec: string };

export interface PlaybackPlan {
  engine: PlayerEngine;
  item: BaseItem;
  source: MediaSource;
  playSessionId: string;
  uri: string;
  headers: Record<string, string>;
  method: NonNullable<PlaybackReport['PlayMethod']>;
  /** Why the server isn't direct playing, e.g. AudioCodecNotSupported. */
  transcodeReasons: string[];
  isHls: boolean;
  audioStreams: MediaStream[];
  subtitleStreams: MediaStream[];
  audioIndex?: number;
  subtitleIndex: number;
  /** Position of the selected audio stream among the file's audio streams. */
  audioOrder: number;
  subtitle: SubtitleDelivery;
}

export interface PlanOptions {
  startTicks?: number;
  audioIndex?: number;
  /** -1 turns subtitles off. */
  subtitleIndex?: number;
  engine?: PlayerEngine;
  forceTranscode?: boolean;
  /** Overrides the streaming bitrate setting for this session; 0 = unlimited. */
  maxBitrate?: number;
}

const VIDEO_REASONS = /^(Video|Subtitle|ContainerBitrate|Anamorphic|Interlaced|RefFrames)/;

const isAnime = (item: BaseItem) =>
  (item.Genres ?? []).some((g) => /anime/i.test(g)) || /anime/i.test(item.SeriesName ?? '');

export function isHdr(streams: MediaStream[]): boolean {
  const v = streams.find((s) => s.Type === 'Video');
  return !!v && (v.VideoRange === 'HDR' || /HDR|HLG|DOVI/i.test(v.VideoRangeType ?? ''));
}

export function engineForContent(settings: Settings, item: BaseItem, streams: MediaStream[] = []): PlayerEngine {
  let e: PlayerEngine;
  if (isHdr(streams)) e = settings.playerHdr;
  else if (isAnime(item)) e = settings.playerAnime;
  else if (item.Type === 'Movie') e = settings.playerMovies;
  else if (item.Type === 'Episode') e = settings.playerEpisodes;
  else e = settings.playerOther;
  return availableEngine(e);
}

export function pickAudio(streams: MediaStream[], settings: Settings): MediaStream | undefined {
  const audio = streams.filter((s) => s.Type === 'Audio');
  return (
    (settings.audioLanguage && audio.find((s) => sameLanguage(s.Language, settings.audioLanguage))) ||
    audio.find((s) => s.IsDefault) ||
    audio[0]
  );
}

/** Mirrors Jellyfin's subtitle modes. */
export function pickSubtitle(streams: MediaStream[], settings: Settings, audio?: MediaStream): MediaStream | undefined {
  const subs = streams.filter((s) => s.Type === 'Subtitle');
  const lang = settings.subtitleLanguage;
  const inLang = subs.filter((s) => !lang || sameLanguage(s.Language, lang));
  const forced = (list: MediaStream[]) => list.find((s) => s.IsForced);
  switch (settings.subtitleMode) {
    case 'None':
      return undefined;
    case 'OnlyForced':
      return forced(inLang) ?? forced(subs);
    case 'Always':
      return inLang.find((s) => !s.IsForced) ?? inLang[0] ?? subs.find((s) => s.IsDefault);
    case 'Smart':
      // Only when the audio is in a language other than the preferred one.
      if (audio && lang && sameLanguage(audio.Language, lang)) return forced(inLang);
      return inLang.find((s) => !s.IsForced) ?? inLang[0];
    case 'Default':
    default:
      return inLang.find((s) => s.IsDefault) ?? forced(inLang) ?? subs.find((s) => s.IsDefault);
  }
}

const codecOf = (s?: MediaStream) => (s?.Codec ?? '').toLowerCase();

function chooseEngine(settings: Settings, item: BaseItem, streams: MediaStream[], sub?: MediaStream): PlayerEngine {
  const engine = engineForContent(settings, item, streams);
  if (engine !== 'native' || !sub) return engine;
  const codec = codecOf(sub);
  if (settings.vlcForAss && ASS_CODECS.includes(codec)) return FULL_ENGINE;
  if (settings.imageSubtitles === 'vlc' && IMAGE_SUBTITLE_CODECS.includes(codec)) return FULL_ENGINE;
  return engine;
}

export async function planPlayback(
  client: JellyfinClient,
  settings: Settings,
  itemId: string,
  opts: PlanOptions = {},
): Promise<PlaybackPlan> {
  const item = await client.item(itemId);
  let streams = item.MediaSources?.[0]?.MediaStreams ?? [];

  const audio =
    opts.audioIndex !== undefined ? streams.find((s) => s.Index === opts.audioIndex) : pickAudio(streams, settings);
  const sub =
    opts.subtitleIndex !== undefined
      ? streams.find((s) => s.Index === opts.subtitleIndex)
      : pickSubtitle(streams, settings, audio);

  const engine = availableEngine(opts.engine ?? chooseEngine(settings, item, streams, sub));
  const force = !!opts.forceTranscode;

  const info = await client.playbackInfo(itemId, {
    startTimeTicks: opts.startTicks,
    deviceProfile: buildDeviceProfile(engine === 'native' ? 'native' : 'full', settings),
    maxStreamingBitrate: (opts.maxBitrate ?? settings.maxBitrate) || undefined,
    mediaSourceId: item.MediaSources?.[0]?.Id,
    audioStreamIndex: audio?.Index,
    subtitleStreamIndex: sub?.Index ?? -1,
    enableDirectPlay: settings.directPlay && !force,
    enableDirectStream: settings.directStream && !force,
  });
  const source = info.MediaSources?.[0];
  if (!source) throw new Error('The server returned no playable source for this item.');
  if (source.MediaStreams?.length) streams = source.MediaStreams;

  const direct = !!source.SupportsDirectPlay && !force && settings.directPlay;
  const reasonsParam = /[?&]TranscodeReasons=([^&]*)/i.exec(source.TranscodingUrl ?? '')?.[1];
  const transcodeReasons = direct || !reasonsParam ? [] : decodeURIComponent(reasonsParam).split(',').filter(Boolean);
  // Without a video reason the server copies the video and only remuxes or converts audio.
  const videoTouched = transcodeReasons.some((r) => VIDEO_REASONS.test(r)) || force;
  const method: PlaybackPlan['method'] = direct ? 'DirectPlay' : videoTouched ? 'Transcode' : 'DirectStream';
  const uri = client.streamUrl(itemId, direct ? source : { ...source, SupportsDirectPlay: false }, info.PlaySessionId);

  const audioStreams = streams.filter((s) => s.Type === 'Audio');
  const subtitleStreams = streams.filter((s) => s.Type === 'Subtitle');
  const selected = sub && streams.find((s) => s.Index === sub.Index);

  let subtitle: SubtitleDelivery = { kind: 'none' };
  if (selected) {
    const codec = codecOf(selected);
    if (engine !== 'native') {
      if (selected.IsExternal) {
        subtitle = { kind: 'external', url: client.subtitleUrl(itemId, source.Id, selected.Index, codec || 'srt'), codec };
      } else {
        const embedded = subtitleStreams.filter((s) => !s.IsExternal);
        subtitle = { kind: 'embedded', order: embedded.findIndex((s) => s.Index === selected.Index) };
      }
    } else if (selected.DeliveryMethod === 'Encode') {
      subtitle = { kind: 'burned' };
    } else {
      subtitle = { kind: 'overlay', url: client.subtitleUrl(itemId, source.Id, selected.Index, 'vtt') };
    }
  }

  return {
    engine,
    item,
    source,
    playSessionId: info.PlaySessionId,
    uri,
    headers: client.authHeaders,
    method,
    transcodeReasons,
    isHls: !direct || /\.m3u8/i.test(uri),
    audioStreams,
    subtitleStreams,
    audioIndex: audio?.Index,
    subtitleIndex: selected?.Index ?? -1,
    audioOrder: Math.max(0, audioStreams.findIndex((s) => s.Index === audio?.Index)),
    subtitle,
  };
}

/** Playback of a downloaded file; no server involved. */
export function offlineEngine(settings: Settings, item: BaseItem, original: boolean): PlayerEngine {
  // AVPlayer can't open MKV and friends, so originals go to VLC on iOS.
  if (original && Platform.OS === 'ios') return 'vlc';
  return engineForContent(settings, item, item.MediaSources?.[0]?.MediaStreams);
}

export function streamLabel(s: MediaStream): string {
  return s.DisplayTitle || [s.Language, s.Codec, s.Title].filter(Boolean).join(' · ') || `Track ${s.Index}`;
}

/** Plays a downloaded item from disk, choosing tracks the same way as streaming. */
export function planOffline(record: DownloadRecord, settings: Settings, opts: PlanOptions = {}): PlaybackPlan {
  const streams = record.streams;
  const audio =
    opts.audioIndex !== undefined ? streams.find((s) => s.Index === opts.audioIndex) : pickAudio(streams, settings);
  // Transcoded downloads only keep the subtitles saved next to the video.
  const usable = streams.filter(
    (s) => s.Type !== 'Subtitle' || (record.original && !s.IsExternal) || record.subtitles.some((d) => d.index === s.Index),
  );
  const sub =
    opts.subtitleIndex !== undefined
      ? usable.find((s) => s.Index === opts.subtitleIndex)
      : pickSubtitle(usable, settings, audio);
  const engine = availableEngine(opts.engine ?? offlineEngine(settings, record.item, record.original));
  const local = sub && record.subtitles.find((d) => d.index === sub.Index);

  let subtitle: SubtitleDelivery = { kind: 'none' };
  if (sub) {
    if (engine === 'native') {
      if (local) subtitle = { kind: 'overlay', url: local.uri };
    } else if (record.original && !sub.IsExternal) {
      const embedded = streams.filter((s) => s.Type === 'Subtitle' && !s.IsExternal);
      subtitle = { kind: 'embedded', order: embedded.findIndex((s) => s.Index === sub.Index) };
    } else if (local) {
      subtitle = { kind: 'external', url: local.uri, codec: 'vtt' };
    }
  }

  const audioStreams = streams.filter((s) => s.Type === 'Audio');
  return {
    engine,
    item: record.item,
    source: record.item.MediaSources?.[0] ?? { Id: record.itemId },
    playSessionId: '',
    uri: record.videoUri ?? '',
    headers: {},
    method: 'DirectPlay',
    transcodeReasons: [],
    isHls: false,
    audioStreams: record.original ? audioStreams : audioStreams.slice(0, 1),
    subtitleStreams: usable.filter((s) => s.Type === 'Subtitle'),
    audioIndex: audio?.Index,
    subtitleIndex: sub && subtitle.kind !== 'none' ? sub.Index : -1,
    audioOrder: record.original ? Math.max(0, audioStreams.findIndex((s) => s.Index === audio?.Index)) : 0,
    subtitle,
  };
}
