import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SessionProvider, useSession } from '@/lib/session';
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
        <Stack.Screen name="player/[id]" options={{ headerShown: false, animation: 'fade', orientation: 'landscape' }} />
        <Stack.Screen name="seerr-settings" options={{ title: 'Seerr server', presentation: 'modal' }} />
        <Stack.Screen name="about" options={{ title: 'About' }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider value={theme}>
      <SessionProvider>
        <StatusBar style="light" />
        <RootStack />
      </SessionProvider>
    </ThemeProvider>
  );
}
