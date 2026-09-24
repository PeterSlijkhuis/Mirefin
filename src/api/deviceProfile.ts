import { Platform } from 'react-native';
import type { Settings } from '@/lib/settings';

export const TEXT_SUBTITLE_CODECS = ['srt', 'subrip', 'vtt', 'webvtt', 'ass', 'ssa', 'ttml', 'mov_text', 'smi', 'sami', 'microdvd', 'sub'];
export const IMAGE_SUBTITLE_CODECS = ['pgssub', 'pgs', 'dvdsub', 'vobsub', 'dvbsub', 'dvb_subtitle', 'xsub'];
export const ASS_CODECS = ['ass', 'ssa'];

export type ProfileTarget = 'native' | 'full' | 'cast';

/**
 * Tells the Jellyfin server what this player can handle, so it direct-plays
 * when possible and otherwise transcodes to HLS.
 *
 * - native: ExoPlayer (Android) or AVPlayer (iOS). Text subtitles are
 *   delivered as separate files and drawn by the app; image subtitles are
 *   burned in by the server.
 * - full (mpv / VLC): plays practically any container and codec and renders every
 *   subtitle format itself (ASS through libass).
 * - cast: Chromecast default receiver.
 */
export function buildDeviceProfile(target: ProfileTarget, settings: Settings) {
  const maxBitrate = settings.maxBitrate || 120_000_000;
  const channels = String(settings.maxAudioChannels);
  const isAndroid = Platform.OS === 'android';

  let directPlay: object[];
  let subtitles: object[];

  if (target === 'full') {
    // No container or codec list means "anything".
    directPlay = [{ Type: 'Video' }, { Type: 'Audio' }];
    subtitles = [...TEXT_SUBTITLE_CODECS, ...IMAGE_SUBTITLE_CODECS].flatMap((Format) => [
      { Format, Method: 'Embed' },
      { Format, Method: 'External' },
    ]);
  } else if (target === 'cast') {
    directPlay = [
      { Type: 'Video', Container: 'mp4,m4v', VideoCodec: 'h264', AudioCodec: 'aac,mp3' },
      { Type: 'Video', Container: 'webm', VideoCodec: 'vp8,vp9', AudioCodec: 'vorbis,opus' },
    ];
    subtitles = [
      { Format: 'vtt', Method: 'Hls' },
      ...[...TEXT_SUBTITLE_CODECS, ...IMAGE_SUBTITLE_CODECS].map((Format) => ({ Format, Method: 'Encode' })),
    ];
  } else {
    const video = ['h264', settings.allowHevc && 'hevc', isAndroid && 'vp8', isAndroid && 'vp9', settings.allowAv1 && 'av1']
      .filter(Boolean)
      .join(',');
    directPlay = isAndroid
      ? [
          { Type: 'Video', Container: 'mp4,m4v,mkv,webm,mov,ts', VideoCodec: video, AudioCodec: 'aac,mp3,ac3,eac3,opus,flac,vorbis' },
          { Type: 'Audio', Container: 'mp3,aac,m4a,flac,ogg,opus,wav' },
        ]
      : [
          { Type: 'Video', Container: 'mp4,m4v,mov', VideoCodec: video, AudioCodec: 'aac,mp3,ac3,eac3,alac,flac' },
          { Type: 'Audio', Container: 'mp3,aac,m4a,flac,alac,wav' },
        ];
    subtitles = [
      ...TEXT_SUBTITLE_CODECS.map((Format) => ({
        Format,
        Method: settings.burnInAss && ASS_CODECS.includes(Format) ? 'Encode' : 'External',
      })),
      ...IMAGE_SUBTITLE_CODECS.map((Format) => ({ Format, Method: 'Encode' })),
    ];
  }

  return {
    Name: 'Mirefin',
    MaxStreamingBitrate: maxBitrate,
    MaxStaticBitrate: maxBitrate,
    MusicStreamingTranscodingBitrate: 384000,
    DirectPlayProfiles: directPlay,
    TranscodingProfiles: [
      {
        Type: 'Video',
        Container: 'ts',
        Protocol: 'hls',
        Context: 'Streaming',
        VideoCodec: 'h264',
        AudioCodec: 'aac,mp3',
        MaxAudioChannels: channels,
        BreakOnNonKeyFrames: true,
        MinSegments: 1,
      },
      { Type: 'Audio', Container: 'aac', Protocol: 'http', Context: 'Streaming', AudioCodec: 'aac' },
    ],
    ContainerProfiles: [],
    CodecProfiles: [],
    SubtitleProfiles: subtitles,
  };
}
