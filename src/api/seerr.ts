/**
 * Client for Seerr (Jellyseerr / Overseerr compatible) request servers.
 * Supports signing in with a Jellyfin account or an API key.
 */

export type SeerrAuthMethod = 'jellyfin' | 'local' | 'apikey';

export interface SeerrConfig {
  url: string;
  method: SeerrAuthMethod;
  /** Username (jellyfin) or email (local). */
  username?: string;
  password?: string;
  apiKey?: string;
}

export type SeerrMediaType = 'movie' | 'tv';

/** Seerr MediaStatus enum. */
export enum MediaStatus {
  Unknown = 1,
  Pending = 2,
  Processing = 3,
  PartiallyAvailable = 4,
  Available = 5,
  Deleted = 6,
}

export interface SeerrMediaInfo {
  id: number;
  tmdbId: number;
  status: MediaStatus;
  jellyfinMediaId?: string | null;
  requests?: { id: number; status: number }[];
  seasons?: { seasonNumber: number; status: MediaStatus }[];
}

export interface SeerrResult {
  id: number;
  mediaType: SeerrMediaType | 'person';
  title?: string;
  name?: string;
  originalTitle?: string;
  overview?: string;
  posterPath?: string | null;
  backdropPath?: string | null;
  releaseDate?: string;
  firstAirDate?: string;
  voteAverage?: number;
  mediaInfo?: SeerrMediaInfo;
}

export interface SeerrPage {
  page: number;
  totalPages: number;
  totalResults: number;
  results: SeerrResult[];
}

export interface SeerrSeason {
  id: number;
  seasonNumber: number;
  name: string;
  episodeCount: number;
  airDate?: string | null;
}

export interface SeerrDetails {
  id: number;
  title?: string;
  name?: string;
  overview?: string;
  tagline?: string;
  posterPath?: string | null;
  backdropPath?: string | null;
  releaseDate?: string;
  firstAirDate?: string;
  runtime?: number;
  episodeRunTime?: number[];
  voteAverage?: number;
  genres?: { id: number; name: string }[];
  seasons?: SeerrSeason[];
  numberOfSeasons?: number;
  mediaInfo?: SeerrMediaInfo;
  credits?: { cast: { id: number; name: string; character?: string; profilePath?: string | null }[] };
}

export interface SeerrUser {
  id: number;
  displayName?: string;
  username?: string;
  email?: string;
  permissions: number;
}

export class SeerrError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

export function tmdbImage(path?: string | null, size: 'w185' | 'w342' | 'w500' | 'w780' | 'w1280' | 'original' = 'w342') {
  return path ? `https://image.tmdb.org/t/p/${size}${path}` : undefined;
}

export function titleOf(r: SeerrResult | SeerrDetails): string {
  return r.title ?? r.name ?? '';
}

export function yearOf(r: SeerrResult | SeerrDetails): string | undefined {
  const d = r.releaseDate || r.firstAirDate;
  return d ? d.slice(0, 4) : undefined;
}

export function statusLabel(status?: MediaStatus): string | undefined {
  switch (status) {
    case MediaStatus.Pending:
      return 'Requested';
    case MediaStatus.Processing:
      return 'Processing';
    case MediaStatus.PartiallyAvailable:
      return 'Partially available';
    case MediaStatus.Available:
      return 'Available';
    default:
      return undefined;
  }
}

/** Short label for poster corners. */
export function statusBadge(status?: MediaStatus): string | undefined {
  switch (status) {
    case MediaStatus.Pending:
    case MediaStatus.Processing:
      return 'Requested';
    case MediaStatus.PartiallyAvailable:
      return 'Partial';
    case MediaStatus.Available:
      return 'Available';
    default:
      return undefined;
  }
}

export function normalizeSeerrUrl(input: string): string {
  let url = input.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(url)) url = `http://${url}`;
  return url;
}

export class SeerrClient {
  private signedIn = false;

  constructor(public config: SeerrConfig) {}

  private async raw(path: string, init: RequestInit = {}): Promise<Response> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...((init.headers as Record<string, string>) ?? {}),
    };
    if (this.config.method === 'apikey' && this.config.apiKey) headers['X-Api-Key'] = this.config.apiKey;
    return fetch(`${this.config.url}/api/v1${path}`, { ...init, headers, credentials: 'include' });
  }

  /** Sign in with a session cookie (the native cookie jar keeps it). */
  async login(): Promise<SeerrUser> {
    const { method, username, password } = this.config;
    if (method === 'apikey') return this.me();
    const path = method === 'jellyfin' ? '/auth/jellyfin' : '/auth/local';
    const body = method === 'jellyfin' ? { username, password } : { email: username, password };
    const res = await this.raw(path, { method: 'POST', body: JSON.stringify(body) });
    if (!res.ok) {
      throw new SeerrError(
        res.status === 401 || res.status === 403 ? 'Seerr rejected those credentials' : `Seerr returned ${res.status}`,
        res.status,
      );
    }
    this.signedIn = true;
    return res.json();
  }

  private async json<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
    if (!this.signedIn && this.config.method !== 'apikey') await this.login();
    const res = await this.raw(path, init);
    if ((res.status === 401 || res.status === 403) && retry && this.config.method !== 'apikey') {
      this.signedIn = false;
      return this.json<T>(path, init, false);
    }
    if (!res.ok) {
      let msg = `Seerr returned ${res.status}`;
      try {
        const body = await res.json();
        if (body?.message) msg = body.message;
      } catch {}
      throw new SeerrError(msg, res.status);
    }
    return res.json();
  }

  me() {
    return this.json<SeerrUser>('/auth/me');
  }

  trending(page = 1) {
    return this.json<SeerrPage>(`/discover/trending?page=${page}`);
  }

  popularMovies(page = 1) {
    return this.json<SeerrPage>(`/discover/movies?page=${page}`);
  }

  popularTv(page = 1) {
    return this.json<SeerrPage>(`/discover/tv?page=${page}`);
  }

  upcomingMovies(page = 1) {
    return this.json<SeerrPage>(`/discover/movies/upcoming?page=${page}`);
  }

  search(q: string, page = 1) {
    // encodeURIComponent leaves ! ' ( ) * alone, but Seerr's validator rejects them raw.
    const encoded = encodeURIComponent(q).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
    return this.json<SeerrPage>(`/search?query=${encoded}&page=${page}`);
  }

  details(type: SeerrMediaType, id: number) {
    return this.json<SeerrDetails>(`/${type}/${id}`);
  }

  request(type: SeerrMediaType, tmdbId: number, seasons?: number[]) {
    const body: Record<string, unknown> = { mediaType: type, mediaId: tmdbId };
    if (type === 'tv') body.seasons = seasons && seasons.length ? seasons : 'all';
    return this.json<{ id: number }>('/request', { method: 'POST', body: JSON.stringify(body) });
  }
}
