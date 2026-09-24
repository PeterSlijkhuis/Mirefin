import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  authenticate,
  getPublicInfo,
  JellyfinClient,
  JellyfinSession,
  normalizeServerUrl,
} from '@/api/jellyfin';
import { normalizeSeerrUrl, SeerrClient, SeerrConfig } from '@/api/seerr';
import { load, remove, save } from './storage';

const KEY_SESSION = 'wm.session';
const KEY_DEVICE = 'wm.deviceId';
const KEY_SEERR = 'wm.seerr';

interface SessionContextValue {
  ready: boolean;
  session?: JellyfinSession;
  client?: JellyfinClient;
  seerr?: SeerrClient;
  seerrConfig?: SeerrConfig;
  signIn: (server: string, username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  saveSeerr: (config: SeerrConfig) => Promise<void>;
  clearSeerr: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

function newDeviceId() {
  const rand = () => Math.random().toString(36).slice(2, 10);
  return `wm-${Date.now().toString(36)}-${rand()}${rand()}`;
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [deviceId, setDeviceId] = useState<string>('');
  const [session, setSession] = useState<JellyfinSession>();
  const [seerrConfig, setSeerrConfig] = useState<SeerrConfig>();

  useEffect(() => {
    (async () => {
      let id = await load<string>(KEY_DEVICE);
      if (!id) {
        id = newDeviceId();
        await save(KEY_DEVICE, id);
      }
      setDeviceId(id);
      setSession(await load<JellyfinSession>(KEY_SESSION));
      setSeerrConfig(await load<SeerrConfig>(KEY_SEERR));
      setReady(true);
    })();
  }, []);

  const signIn = useCallback(
    async (server: string, username: string, password: string) => {
      const serverUrl = normalizeServerUrl(server);
      const info = await getPublicInfo(serverUrl).catch(() => {
        throw new Error(`Could not reach a Jellyfin server at ${serverUrl}`);
      });
      const auth = await authenticate(serverUrl, username, password, deviceId);
      const next: JellyfinSession = {
        serverUrl,
        serverName: info.ServerName,
        userId: auth.User.Id,
        userName: auth.User.Name,
        token: auth.AccessToken,
        deviceId,
      };
      await save(KEY_SESSION, next);
      setSession(next);
    },
    [deviceId],
  );

  const signOut = useCallback(async () => {
    if (session) {
      // Best effort: tell the server to revoke this device's token.
      fetch(`${session.serverUrl}/Sessions/Logout`, {
        method: 'POST',
        headers: { Authorization: `MediaBrowser Token="${session.token}"` },
      }).catch(() => {});
    }
    await remove(KEY_SESSION);
    setSession(undefined);
  }, [session]);

  const saveSeerr = useCallback(async (config: SeerrConfig) => {
    const normalized = { ...config, url: normalizeSeerrUrl(config.url) };
    // Validate before persisting so a bad config never sticks.
    await new SeerrClient(normalized).login();
    await save(KEY_SEERR, normalized);
    setSeerrConfig(normalized);
  }, []);

  const clearSeerr = useCallback(async () => {
    await remove(KEY_SEERR);
    setSeerrConfig(undefined);
  }, []);

  const client = useMemo(() => (session ? new JellyfinClient(session) : undefined), [session]);
  const seerr = useMemo(() => (seerrConfig ? new SeerrClient(seerrConfig) : undefined), [seerrConfig]);

  const value = useMemo(
    () => ({ ready, session, client, seerr, seerrConfig, signIn, signOut, saveSeerr, clearSeerr }),
    [ready, session, client, seerr, seerrConfig, signIn, signOut, saveSeerr, clearSeerr],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}

/** For screens that are only reachable while signed in. */
export function useClient(): JellyfinClient {
  const { client } = useSession();
  if (!client) throw new Error('Not signed in');
  return client;
}
