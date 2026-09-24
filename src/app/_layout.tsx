import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { DownloadsProvider } from '@/lib/downloads';
import { SessionProvider, useSession } from '@/lib/session';
import { SettingsProvider, useSettings } from '@/lib/settings';
import { colors } from '@/lib/theme';
import { Loading } from '@/components/ui';

const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.accent,
    background: colors.background,
    card: colors.background,
    text: colors.text,
    border: colors.border,
  },
};

function RootStack() {
  const { ready, session } = useSession();
  const { settings } = useSettings();
  if (!ready) return <Loading />;
  const signedIn = !!session;
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="library/[id]" options={{ title: '' }} />
        <Stack.Screen name="item/[id]" options={{ headerTransparent: true, title: '' }} />
        <Stack.Screen name="seerr/[type]/[id]" options={{ headerTransparent: true, title: '' }} />
        <Stack.Screen
          name="player/[id]"
          options={{ headerShown: false, animation: 'fade', orientation: settings.keepScreenLandscape ? 'landscape' : 'default' }}
        />
        <Stack.Screen name="subtitles/[id]" options={{ title: 'Subtitles', presentation: 'modal' }} />
        <Stack.Screen name="downloads" options={{ title: 'Downloads' }} />
        <Stack.Screen name="playback-settings" options={{ title: 'Playback & subtitles' }} />
        <Stack.Screen name="seerr-settings" options={{ title: 'Seerr server', presentation: 'modal' }} />
        <Stack.Screen name="about" options={{ title: 'About' }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider value={theme}>
      <SettingsProvider>
        <SessionProvider>
          <DownloadsProvider>
            <StatusBar style="light" />
            <RootStack />
          </DownloadsProvider>
        </SessionProvider>
      </SettingsProvider>
    </ThemeProvider>
  );
}
