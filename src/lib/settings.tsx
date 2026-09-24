import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';

/**
 * native: ExoPlayer on Android, AVPlayer on iOS (best for HDR / Dolby Vision).
 * mpv: libmpv, Android only. vlc: libVLC. Both play nearly any codec and
 * render ASS/SSA subtitles with libass.
 */
export type PlayerEngine = 'native' | 'mpv' | 'vlc';

/** mpv is Android-only; iOS gets VLC as its all-codec player. */
export const FULL_ENGINE: PlayerEngine = Platform.OS === 'android' ? 'mpv' : 'vlc';

export function availableEngine(e: PlayerEngine): PlayerEngine {
  return e === 'mpv' && Platform.OS !== 'android' ? 'vlc' : e;
}
export const ENGINE_LABEL: Record<PlayerEngine, string> = {
  native: Platform.OS === 'android' ? 'ExoPlayer' : 'AVPlayer',
  mpv: 'mpv',
  vlc: 'VLC',
};

/** Engines that exist on this platform, all-codec player first. */
export const ENGINES: PlayerEngine[] = [FULL_ENGINE, 'native'];

export type SubtitleMode = 'Default' | 'Always' | 'OnlyForced' | 'Smart' | 'None';
export type ImageSubtitleHandling = 'burn' | 'vlc';

export interface Settings {
  /* Player engine per kind of content */
  playerMovies: PlayerEngine;
  playerEpisodes: PlayerEngine;
  playerAnime: PlayerEngine;
  playerOther: PlayerEngine;
  /** Player for HDR10 / HLG / Dolby Vision video. */
  playerHdr: PlayerEngine;
  /** Switch to mpv/VLC (libass) whenever an ASS/SSA subtitle will be shown. */
  vlcForAss: boolean;
  /** Image subtitles (PGS, VobSub, DVB) on the native player. */
  imageSubtitles: ImageSubtitleHandling;
  /** Burn ASS/SSA into the video when staying on the native player. */
  burnInAss: boolean;
  hardwareDecoding: boolean;

  /* Streaming */
  directPlay: boolean;
  directStream: boolean;
  /** Bits per second, 0 = unlimited. */
  maxBitrate: number;
  maxAudioChannels: number;
  allowHevc: boolean;
  allowAv1: boolean;

  /* Playback behaviour */
  autoplayNext: boolean;
  skipIntroButton: boolean;
  autoSkipIntro: boolean;
  autoSkipCredits: boolean;
  seekBackSeconds: number;
  seekForwardSeconds: number;
  defaultSpeed: number;
  keepScreenLandscape: boolean;

  /* Audio */
  audioLanguage: string;

  /* Subtitles */
  subtitleMode: SubtitleMode;
  subtitleLanguage: string;
  subtitleScale: number;
  subtitleColor: string;
  subtitleBackground: 'none' | 'shadow' | 'outline' | 'box';
  subtitleBold: boolean;
  /** Distance from the bottom edge in percent of the video height. */
  subtitleOffset: number;
  /** Seconds to shift overlay subtitles; positive shows them later. */
  subtitleDelay: number;

  /* Downloads */
  /** 0 = original file, otherwise transcode to this bitrate. */
  downloadBitrate: number;
  downloadSubtitles: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  playerMovies: FULL_ENGINE,
  playerEpisodes: FULL_ENGINE,
  playerAnime: FULL_ENGINE,
  playerOther: FULL_ENGINE,
  playerHdr: 'native',
  vlcForAss: true,
  imageSubtitles: 'burn',
  burnInAss: false,
  hardwareDecoding: true,

  directPlay: true,
  directStream: true,
  maxBitrate: 0,
  maxAudioChannels: 6,
  allowHevc: true,
  allowAv1: false,

  autoplayNext: true,
  skipIntroButton: true,
  autoSkipIntro: false,
  autoSkipCredits: false,
  seekBackSeconds: 10,
  seekForwardSeconds: 30,
  defaultSpeed: 1,
  keepScreenLandscape: true,

  audioLanguage: '',

  subtitleMode: 'Default',
  subtitleLanguage: 'eng',
  subtitleScale: 100,
  subtitleColor: '#FFFFFF',
  subtitleBackground: 'shadow',
  subtitleBold: false,
  subtitleOffset: 6,
  subtitleDelay: 0,

  downloadBitrate: 0,
  downloadSubtitles: true,
};

const file = () => new File(Paths.document, 'settings.json');

interface SettingsContextValue {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  reset: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    try {
      const f = file();
      if (f.exists) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(f.textSync()) });
    } catch {
      // Corrupt or unreadable settings fall back to defaults.
    }
  }, []);

  const persist = (next: Settings) => {
    try {
      file().write(JSON.stringify(next));
    } catch {}
  };

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      persist(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    persist(DEFAULT_SETTINGS);
    setSettings(DEFAULT_SETTINGS);
  }, []);

  const value = useMemo(() => ({ settings, update, reset }), [settings, update, reset]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider');
  return ctx;
}

/** ISO 639-2/B codes, which is what Jellyfin reports for stream languages. */
export const LANGUAGES: { code: string; label: string }[] = [
  { code: 'eng', label: 'English' },
  { code: 'jpn', label: 'Japanese' },
  { code: 'spa', label: 'Spanish' },
  { code: 'fre', label: 'French' },
  { code: 'ger', label: 'German' },
  { code: 'ita', label: 'Italian' },
  { code: 'por', label: 'Portuguese' },
  { code: 'dut', label: 'Dutch' },
  { code: 'rus', label: 'Russian' },
  { code: 'chi', label: 'Chinese' },
  { code: 'kor', label: 'Korean' },
  { code: 'ara', label: 'Arabic' },
  { code: 'hin', label: 'Hindi' },
  { code: 'swe', label: 'Swedish' },
  { code: 'nor', label: 'Norwegian' },
  { code: 'dan', label: 'Danish' },
  { code: 'fin', label: 'Finnish' },
  { code: 'pol', label: 'Polish' },
  { code: 'tur', label: 'Turkish' },
];

/** Jellyfin mixes ISO 639-2/B and /T codes; treat the common pairs as equal. */
const ALIASES: Record<string, string> = { nld: 'dut', deu: 'ger', fra: 'fre', zho: 'chi', ces: 'cze', ron: 'rum' };
export function sameLanguage(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  const n = (x: string) => ALIASES[x.toLowerCase()] ?? x.toLowerCase();
  return n(a) === n(b);
}
