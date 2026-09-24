import { Platform } from 'react-native';

/**
 * Tells the Jellyfin server what this device can play natively, so it can
 * pick direct play when possible and fall back to HLS transcoding otherwise.
 * Android (ExoPlayer) handles more containers than iOS (AVPlayer).
 */
export function buildDeviceProfile(maxBitrate = 120_000_000) {
  const isAndroid = Platform.OS === 'android';

  const directPlay = isAndroid
    ? [
        { Type: 'Video', Container: 'mp4,m4v,mkv,webm,mov,ts', VideoCodec: 'h264,hevc,vp8,vp9,av1', AudioCodec: 'aac,mp3,ac3,eac3,opus,flac,vorbis' },
        { Type: 'Audio', Container: 'mp3,aac,m4a,flac,ogg,opus,wav' },
      ]
    : [
        { Type: 'Video', Container: 'mp4,m4v,mov', VideoCodec: 'h264,hevc', AudioCodec: 'aac,mp3,ac3,eac3,alac,flac' },
        { Type: 'Audio', Container: 'mp3,aac,m4a,flac,alac,wav' },
      ];

  return {
    Name: 'WholphinMobile',
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
        MaxAudioChannels: '6',
        BreakOnNonKeyFrames: true,
        MinSegments: 1,
      },
      { Type: 'Audio', Container: 'aac', Protocol: 'http', Context: 'Streaming', AudioCodec: 'aac' },
    ],
    ContainerProfiles: [],
    CodecProfiles: [],
    SubtitleProfiles: [
      { Format: 'vtt', Method: 'Hls' },
      { Format: 'srt', Method: 'Encode' },
      { Format: 'ass', Method: 'Encode' },
      { Format: 'ssa', Method: 'Encode' },
      { Format: 'pgssub', Method: 'Encode' },
    ],
  };
}
