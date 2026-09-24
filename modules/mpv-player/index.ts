import { Platform, ViewProps } from 'react-native';
import { requireNativeView } from 'expo';

export interface MpvSubtitleStyle {
  scale?: number;
  color?: string;
  bold?: boolean;
  background?: 'none' | 'shadow' | 'outline' | 'box';
  marginY?: number;
  delay?: number;
}

type NativeEvent<T> = { nativeEvent: T };

export interface MpvTrack {
  id: number;
  type: 'video' | 'audio' | 'sub';
  lang?: string;
  title?: string;
  codec?: string;
  external?: boolean;
}

export interface MpvPlayerProps extends ViewProps {
  source: { uri: string; startSeconds?: number };
  paused?: boolean;
  rate?: number;
  /** Change `nonce` to seek again to the same time. */
  seek?: { seconds: number; nonce: number };
  /** 1-based per type; 0 turns the track off. */
  audioTrack?: number;
  subtitleTrack?: number;
  /** Sidecar subtitle to load and select; overrides `subtitleTrack`. */
  subtitleUrl?: string;
  subtitleStyle?: MpvSubtitleStyle;
  hardwareDecoding?: boolean;
  onProgress?: (e: NativeEvent<{ position: number; duration: number }>) => void;
  onStateChange?: (e: NativeEvent<{ paused?: boolean; buffering?: boolean }>) => void;
  onLoad?: (e: NativeEvent<{ duration: number; tracks: MpvTrack[] }>) => void;
  onEnd?: (e: NativeEvent<{ position: number; duration: number }>) => void;
  onError?: (e: NativeEvent<{ message: string }>) => void;
}

export const MpvPlayerView: React.ComponentType<MpvPlayerProps> | null =
  Platform.OS === 'android' ? requireNativeView<MpvPlayerProps>('MpvPlayer') : null;
