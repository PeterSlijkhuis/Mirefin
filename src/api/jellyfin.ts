import { Platform } from 'react-native';
import Constants from 'expo-constants';

export const CLIENT_NAME = 'Mirefin';
export const CLIENT_VERSION = Constants.expoConfig?.version ?? '0.1.0';

export const TICKS_PER_SECOND = 10_000_000;

export type ImageType = 'Primary' | 'Backdrop' | 'Thumb' | 'Logo' | 'Banner';

export interface UserData {
  PlaybackPositionTicks?: number;
  PlayedPercentage?: number;
  Played?: boolean;
  IsFavorite?: boolean;
  UnplayedItemCount?: number;
}

export interface BaseItem {
  Id: string;
  Name: string;
  Type: string;
  ServerId?: string;
  CollectionType?: string;
  Overview?: string;
  ProductionYear?: number;
  PremiereDate?: string;
  EndDate?: string;
  OfficialRating?: string;
  CommunityRating?: number;
  CriticRating?: number;
  RunTimeTicks?: number;
  Genres?: string[];
  Taglines?: string[];
  Status?: string;
  SeriesId?: string;
  SeriesName?: string;
  SeasonId?: string;
  SeasonName?: string;
  ParentId?: string;
  IndexNumber?: number;
  ParentIndexNumber?: number;
  ChildCount?: number;
  IsFolder?: boolean;
  MediaType?: string;
  ImageTags?: Partial<Record<ImageType, string>>;
  BackdropImageTags?: string[];
  ParentBackdropItemId?: string;
  ParentBackdropImageTags?: string[];
  ParentThumbItemId?: string;
  ParentThumbImageTag?: string;
  ParentLogoItemId?: string;
  ParentLogoImageTag?: string;
  SeriesPrimaryImageTag?: string;
  PrimaryImageAspectRatio?: number;
  UserData?: UserData;
  People?: { Id: string; Name: string; Role?: string; Type: string; PrimaryImageTag?: string }[];
  Studios?: { Name: string; Id: string }[];
  ProviderIds?: Record<string, string>;
  MediaSources?: MediaSource[];
}

export interface MediaStream {
  Index: number;
  Type: 'Video' | 'Audio' | 'Subtitle' | 'EmbeddedImage' | string;
  Codec?: string;
  Language?: string;
  Title?: string;
  DisplayTitle?: string;
  IsDefault?: boolean;
  IsForced?: boolean;
  IsExternal?: boolean;
  IsTextSubtitleStream?: boolean;
  DeliveryMethod?: 'Encode' | 'Embed' | 'External' | 'Hls' | string;
  DeliveryUrl?: string;
  Channels?: number;
  Width?: number;
  Height?: number;
  VideoRange?: string;
  VideoRangeType?: string;
}

export interface MediaSource {
  Id: string;
  Name?: string;
  Path?: string;
  Size?: number;
  Bitrate?: number;
  Container?: string;
  MediaStreams?: MediaStream[];
  SupportsDirectPlay?: boolean;
  SupportsDirectStream?: boolean;
  SupportsTranscoding?: boolean;
  TranscodingUrl?: string;
  DefaultAudioStreamIndex?: number;
  DefaultSubtitleStreamIndex?: number;
}

export interface ItemsResult {
  Items: BaseItem[];
  TotalRecordCount: number;
  StartIndex?: number;
}

export interface AuthResult {
  AccessToken: string;
  ServerId: string;
  User: { Id: string; Name: string; PrimaryImageTag?: string };
}

export interface PublicSystemInfo {
  ServerName: string;
  Version: string;
  Id: string;
}

export interface JellyfinSession {
  serverUrl: string;
  serverName: string;
  userId: string;
  userName: string;
  token: string;
  deviceId: string;
}

const DEFAULT_FIELDS = [
  'PrimaryImageAspectRatio',
  'Overview',
  'Genres',
  'ParentId',
  'ChildCount',
  'ProviderIds',
].join(',');

export class JellyfinError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

export function normalizeServerUrl(input: string): string {
  let url = input.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(url)) url = `http://${url}`;
  return url;
}

function authHeader(deviceId: string, token?: string): string {
  const device = Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : 'Web';
  const parts = [
    `Client="${CLIENT_NAME}"`,
    `Device="${device}"`,
    `DeviceId="${deviceId}"`,
    `Version="${CLIENT_VERSION}"`,
  ];
  if (token) parts.push(`Token="${token}"`);
  return `MediaBrowser ${parts.join(', ')}`;
}

function query(params: Record<string, string | number | boolean | undefined>): string {
  const q = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return q ? `?${q}` : '';
}

async function request<T>(
  serverUrl: string,
  path: string,
  deviceId: string,
  token?: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${serverUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: authHeader(deviceId, token),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const msg =
      res.status === 401
        ? 'Invalid username or password'
        : `Server returned ${res.status}`;
    throw new JellyfinError(msg, res.status);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export async function getPublicInfo(serverUrl: string): Promise<PublicSystemInfo> {
  const res = await fetch(`${serverUrl}/System/Info/Public`);
  if (!res.ok) throw new JellyfinError(`Server returned ${res.status}`, res.status);
  return res.json();
}

export async function authenticate(
  serverUrl: string,
  username: string,
  password: string,
  deviceId: string,
): Promise<AuthResult> {
  return request<AuthResult>(serverUrl, '/Users/AuthenticateByName', deviceId, undefined, {
    method: 'POST',
    body: JSON.stringify({ Username: username, Pw: password }),
  });
}

/** Thin, session-bound Jellyfin client. */
export class JellyfinClient {
  constructor(public session: JellyfinSession) {}

  private get<T>(path: string, params: Record<string, string | number | boolean | undefined> = {}) {
    const s = this.session;
    return request<T>(s.serverUrl, path + query(params), s.deviceId, s.token);
  }

  private post<T>(path: string, body?: unknown, params: Record<string, string | number | boolean | undefined> = {}) {
    const s = this.session;
    return request<T>(s.serverUrl, path + query(params), s.deviceId, s.token, {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  private del<T>(path: string) {
    const s = this.session;
    return request<T>(s.serverUrl, path, s.deviceId, s.token, { method: 'DELETE' });
  }

  get userId() {
    return this.session.userId;
  }

  userViews() {
    return this.get<ItemsResult>('/UserViews', { userId: this.userId });
  }

  resume(limit = 20) {
    return this.get<ItemsResult>('/UserItems/Resume', {
      userId: this.userId,
      limit,
      mediaTypes: 'Video',
      fields: DEFAULT_FIELDS,
      enableImageTypes: 'Primary,Backdrop,Thumb,Logo',
    });
  }

  nextUp(limit = 20, seriesId?: string) {
    return this.get<ItemsResult>('/Shows/NextUp', {
      userId: this.userId,
      limit,
      seriesId,
      fields: DEFAULT_FIELDS,
      enableResumable: false,
    });
  }

  latest(parentId: string, limit = 20) {
    return this.get<BaseItem[]>('/Items/Latest', {
      userId: this.userId,
      parentId,
      limit,
      fields: DEFAULT_FIELDS,
    });
  }

  items(params: {
    parentId?: string;
    includeItemTypes?: string;
    sortBy?: string;
    sortOrder?: 'Ascending' | 'Descending';
    startIndex?: number;
    limit?: number;
    recursive?: boolean;
    searchTerm?: string;
    filters?: string;
    ids?: string;
  }) {
    return this.get<ItemsResult>('/Items', {
      userId: this.userId,
      fields: DEFAULT_FIELDS,
      enableTotalRecordCount: true,
      ...params,
    });
  }

  item(id: string) {
    return this.get<BaseItem>(`/Items/${id}`, { userId: this.userId });
  }

  seasons(seriesId: string) {
    return this.get<ItemsResult>(`/Shows/${seriesId}/Seasons`, {
      userId: this.userId,
      fields: DEFAULT_FIELDS,
    });
  }

  episodes(seriesId: string, seasonId: string) {
    return this.get<ItemsResult>(`/Shows/${seriesId}/Episodes`, {
      userId: this.userId,
      seasonId,
      fields: `${DEFAULT_FIELDS},MediaSources`,
    });
  }

  similar(id: string, limit = 12) {
    return this.get<ItemsResult>(`/Items/${id}/Similar`, {
      userId: this.userId,
      limit,
      fields: DEFAULT_FIELDS,
    });
  }

  search(term: string, limit = 60) {
    return this.items({
      searchTerm: term,
      recursive: true,
      limit,
      includeItemTypes: 'Movie,Series,Episode,BoxSet',
    });
  }

  setPlayed(id: string, played: boolean) {
    return played ? this.post(`/UserPlayedItems/${id}`, undefined, { userId: this.userId }) : this.del(`/UserPlayedItems/${id}?userId=${this.userId}`);
  }

  setFavorite(id: string, favorite: boolean) {
    return favorite ? this.post(`/UserFavoriteItems/${id}`, undefined, { userId: this.userId }) : this.del(`/UserFavoriteItems/${id}?userId=${this.userId}`);
  }

  playbackInfo(
    id: string,
    opts: {
      startTimeTicks?: number;
      deviceProfile: unknown;
      maxStreamingBitrate?: number;
      mediaSourceId?: string;
      audioStreamIndex?: number;
      subtitleStreamIndex?: number;
      enableDirectPlay?: boolean;
      enableDirectStream?: boolean;
    },
  ) {
    return this.post<{ MediaSources: MediaSource[]; PlaySessionId: string }>(
      `/Items/${id}/PlaybackInfo`,
      {
        UserId: this.userId,
        StartTimeTicks: opts.startTimeTicks ?? 0,
        DeviceProfile: opts.deviceProfile,
        MaxStreamingBitrate: opts.maxStreamingBitrate,
        MediaSourceId: opts.mediaSourceId,
        AudioStreamIndex: opts.audioStreamIndex,
        SubtitleStreamIndex: opts.subtitleStreamIndex,
        EnableDirectPlay: opts.enableDirectPlay ?? true,
        EnableDirectStream: opts.enableDirectStream ?? true,
        EnableTranscoding: true,
        AllowVideoStreamCopy: true,
        AllowAudioStreamCopy: true,
        AutoOpenLiveStream: true,
      },
    );
  }

  reportStart(body: PlaybackReport) {
    return this.post('/Sessions/Playing', body);
  }

  reportProgress(body: PlaybackReport) {
    return this.post('/Sessions/Playing/Progress', body);
  }

  reportStopped(body: PlaybackReport) {
    return this.post('/Sessions/Playing/Stopped', body);
  }

  /** Next episode after `episodeId` in its series, if any. */
  async nextEpisode(seriesId: string, episodeId: string): Promise<BaseItem | undefined> {
    const res = await this.get<ItemsResult>(`/Shows/${seriesId}/Episodes`, {
      userId: this.userId,
      startItemId: episodeId,
      limit: 2,
      fields: DEFAULT_FIELDS,
    });
    return res.Items.find((e) => e.Id !== episodeId);
  }

  /** Intro/outro markers (Jellyfin 10.10+ media segments). */
  async mediaSegments(itemId: string): Promise<MediaSegment[]> {
    try {
      const res = await this.get<{ Items: MediaSegment[] }>(`/MediaSegments/${itemId}`);
      return res.Items ?? [];
    } catch {
      return [];
    }
  }

  /** A subtitle stream converted by the server to the given format. */
  subtitleUrl(itemId: string, mediaSourceId: string, streamIndex: number, format = 'vtt'): string {
    return this.withApiKey(
      `${this.session.serverUrl}/Videos/${itemId}/${mediaSourceId}/Subtitles/${streamIndex}/0/Stream.${format}`,
    );
  }

  searchRemoteSubtitles(itemId: string, language: string) {
    return this.get<RemoteSubtitle[]>(`/Items/${itemId}/RemoteSearch/Subtitles/${language}`);
  }

  downloadRemoteSubtitle(itemId: string, subtitleId: string) {
    return this.post(`/Items/${itemId}/RemoteSearch/Subtitles/${encodeURIComponent(subtitleId)}`);
  }

  /** Original file, or a progressive H.264/AAC MP4 transcode at `bitrate`. */
  downloadUrl(itemId: string, mediaSourceId: string, bitrate: number): string {
    const s = this.session;
    if (!bitrate) return this.withApiKey(`${s.serverUrl}/Items/${itemId}/Download`);
    return `${s.serverUrl}/Videos/${itemId}/stream.mp4${query({
      mediaSourceId,
      deviceId: s.deviceId,
      container: 'mp4',
      videoCodec: 'h264',
      audioCodec: 'aac',
      videoBitRate: bitrate - 192000,
      audioBitRate: 192000,
      maxAudioChannels: 2,
      ApiKey: s.token,
    })}`;
  }

  /**
   * Build a URL for a media source: the static file when the device can play
   * it as is, otherwise the server's HLS URL (remux or full transcode).
   */
  streamUrl(itemId: string, source: MediaSource, playSessionId: string): string {
    const s = this.session;
    if (source.SupportsDirectPlay || !source.TranscodingUrl) {
      const ext = source.Container ? `.${source.Container.split(',')[0]}` : '';
      return `${s.serverUrl}/Videos/${itemId}/stream${ext}${query({
        static: true,
        mediaSourceId: source.Id,
        deviceId: s.deviceId,
        playSessionId,
        ApiKey: s.token,
      })}`;
    }
    return this.withApiKey(`${s.serverUrl}${source.TranscodingUrl}`);
  }

  /**
   * Jellyfin 10.11 dropped the legacy `api_key` parameter; `ApiKey` works on
   * 10.9+. Players also get the Authorization header, see `authHeaders`.
   */
  withApiKey(url: string): string {
    if (/[?&]api_?key=/i.test(url)) return url;
    return `${url}${url.includes('?') ? '&' : '?'}ApiKey=${this.session.token}`;
  }

  /** Headers for native players and downloads fetching media directly. */
  get authHeaders(): Record<string, string> {
    return { Authorization: authHeader(this.session.deviceId, this.session.token) };
  }

  imageUrl(itemId: string, type: ImageType, opts: { tag?: string; width?: number; index?: number } = {}): string {
    const s = this.session;
    const idx = opts.index !== undefined ? `/${opts.index}` : '';
    return `${s.serverUrl}/Items/${itemId}/Images/${type}${idx}${query({
      fillWidth: opts.width ?? 400,
      quality: 90,
      tag: opts.tag,
    })}`;
  }

  userImageUrl(userId: string, tag?: string) {
    return `${this.session.serverUrl}/Users/${userId}/Images/Primary${query({ tag, fillWidth: 160 })}`;
  }

  personImageUrl(personId: string, tag?: string) {
    return this.imageUrl(personId, 'Primary', { tag, width: 200 });
  }
}

export interface MediaSegment {
  Type: 'Intro' | 'Outro' | 'Recap' | 'Preview' | 'Commercial' | 'Unknown';
  StartTicks: number;
  EndTicks: number;
}

export interface RemoteSubtitle {
  Id: string;
  Name?: string;
  ProviderName?: string;
  Format?: string;
  Author?: string;
  Comment?: string;
  DownloadCount?: number;
  CommunityRating?: number;
  IsHashMatch?: boolean;
  ThreeLetterISOLanguageName?: string;
}

export interface PlaybackReport {
  ItemId: string;
  MediaSourceId?: string;
  PlaySessionId?: string;
  PositionTicks?: number;
  IsPaused?: boolean;
  CanSeek?: boolean;
  PlayMethod?: 'DirectPlay' | 'DirectStream' | 'Transcode';
}

/* ---------- Image helpers, mirroring how Wholphin picks artwork ---------- */

export function posterUrl(c: JellyfinClient, item: BaseItem, width = 300): string | undefined {
  if (item.ImageTags?.Primary) return c.imageUrl(item.Id, 'Primary', { tag: item.ImageTags.Primary, width });
  if (item.SeriesId && item.SeriesPrimaryImageTag)
    return c.imageUrl(item.SeriesId, 'Primary', { tag: item.SeriesPrimaryImageTag, width });
  return undefined;
}

export function thumbUrl(c: JellyfinClient, item: BaseItem, width = 500): string | undefined {
  if (item.Type === 'Episode' && item.ImageTags?.Primary)
    return c.imageUrl(item.Id, 'Primary', { tag: item.ImageTags.Primary, width });
  if (item.ImageTags?.Thumb) return c.imageUrl(item.Id, 'Thumb', { tag: item.ImageTags.Thumb, width });
  if (item.BackdropImageTags?.length)
    return c.imageUrl(item.Id, 'Backdrop', { tag: item.BackdropImageTags[0], width, index: 0 });
  if (item.ParentThumbItemId && item.ParentThumbImageTag)
    return c.imageUrl(item.ParentThumbItemId, 'Thumb', { tag: item.ParentThumbImageTag, width });
  if (item.ParentBackdropItemId && item.ParentBackdropImageTags?.length)
    return c.imageUrl(item.ParentBackdropItemId, 'Backdrop', { tag: item.ParentBackdropImageTags[0], width, index: 0 });
  return posterUrl(c, item, width);
}

export function backdropUrl(c: JellyfinClient, item: BaseItem, width = 1280): string | undefined {
  if (item.BackdropImageTags?.length)
    return c.imageUrl(item.Id, 'Backdrop', { tag: item.BackdropImageTags[0], width, index: 0 });
  if (item.ParentBackdropItemId && item.ParentBackdropImageTags?.length)
    return c.imageUrl(item.ParentBackdropItemId, 'Backdrop', { tag: item.ParentBackdropImageTags[0], width, index: 0 });
  return thumbUrl(c, item, width);
}

export function logoUrl(c: JellyfinClient, item: BaseItem, width = 600): string | undefined {
  if (item.ImageTags?.Logo) return c.imageUrl(item.Id, 'Logo', { tag: item.ImageTags.Logo, width });
  if (item.ParentLogoItemId && item.ParentLogoImageTag)
    return c.imageUrl(item.ParentLogoItemId, 'Logo', { tag: item.ParentLogoImageTag, width });
  return undefined;
}

/* ---------- Formatting ---------- */

export function formatRuntime(ticks?: number): string | undefined {
  if (!ticks) return undefined;
  const mins = Math.round(ticks / TICKS_PER_SECOND / 60);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

export function episodeLabel(item: BaseItem): string | undefined {
  if (item.Type !== 'Episode') return undefined;
  const s = item.ParentIndexNumber;
  const e = item.IndexNumber;
  if (s === undefined && e === undefined) return undefined;
  return `S${s ?? '?'}:E${e ?? '?'}`;
}

export function progressFraction(item: BaseItem): number | undefined {
  const pct = item.UserData?.PlayedPercentage;
  if (pct && pct > 0 && pct < 100) return pct / 100;
  const pos = item.UserData?.PlaybackPositionTicks;
  if (pos && item.RunTimeTicks) return Math.min(1, pos / item.RunTimeTicks);
  return undefined;
}
