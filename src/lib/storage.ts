import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// SecureStore has no web implementation, so fall back to localStorage there.
const web = Platform.OS === 'web';

export async function load<T>(key: string): Promise<T | undefined> {
  try {
    const raw = web ? globalThis.localStorage?.getItem(key) : await SecureStore.getItemAsync(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

export async function save(key: string, value: unknown): Promise<void> {
  const raw = JSON.stringify(value);
  if (web) globalThis.localStorage?.setItem(key, raw);
  else await SecureStore.setItemAsync(key, raw);
}

export async function remove(key: string): Promise<void> {
  if (web) globalThis.localStorage?.removeItem(key);
  else await SecureStore.deleteItemAsync(key);
}
