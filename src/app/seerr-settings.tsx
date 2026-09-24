import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SeerrAuthMethod } from '@/api/seerr';
import { Button, Chip, Field } from '@/components/ui';
import { useSession } from '@/lib/session';
import { colors, spacing, type } from '@/lib/theme';

const METHODS: { key: SeerrAuthMethod; label: string }[] = [
  { key: 'jellyfin', label: 'Jellyfin account' },
  { key: 'local', label: 'Seerr account' },
  { key: 'apikey', label: 'API key' },
];

export default function SeerrSettings() {
  const { session, seerrConfig, saveSeerr, clearSeerr } = useSession();
  const [url, setUrl] = useState(seerrConfig?.url ?? '');
  const [method, setMethod] = useState<SeerrAuthMethod>(seerrConfig?.method ?? 'jellyfin');
  const [username, setUsername] = useState(seerrConfig?.username ?? session?.userName ?? '');
  const [password, setPassword] = useState(seerrConfig?.password ?? '');
  const [apiKey, setApiKey] = useState(seerrConfig?.apiKey ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const save = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await saveSeerr(
        method === 'apikey' ? { url, method, apiKey } : { url, method, username, password },
      );
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : `Could not connect: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const disconnect = () =>
    Alert.alert('Disconnect Seerr', 'Remove this Seerr server from the app?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: async () => {
          await clearSeerr();
          router.back();
        },
      },
    ]);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={type.meta}>
          Connect Seerr (or Jellyseerr / Overseerr) to discover new titles and request them straight from the app.
        </Text>

        <Field
          label="Seerr address"
          placeholder="https://requests.example.com or 192.168.1.10:5055"
          value={url}
          onChangeText={setUrl}
          keyboardType="url"
        />

        <View style={{ gap: spacing.xs }}>
          <Text style={type.meta}>Sign in with</Text>
          <View style={styles.methods}>
            {METHODS.map((m) => (
              <Chip key={m.key} label={m.label} active={method === m.key} onPress={() => setMethod(m.key)} />
            ))}
          </View>
        </View>

        {method === 'apikey' ? (
          <Field label="API key" value={apiKey} onChangeText={setApiKey} secureTextEntry />
        ) : (
          <>
            <Field
              label={method === 'local' ? 'Email' : 'Jellyfin username'}
              value={username}
              onChangeText={setUsername}
              keyboardType={method === 'local' ? 'email-address' : 'default'}
            />
            <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry />
          </>
        )}

        {error && <Text style={{ color: colors.danger }}>{error}</Text>}

        <Button label="Save & connect" onPress={save} loading={busy} disabled={busy || !url} />
        {seerrConfig && <Button label="Disconnect" variant="ghost" onPress={disconnect} />}

        <Text style={type.small}>
          Credentials are stored in the device's secure storage and only sent to your Seerr server.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, gap: spacing.lg },
  methods: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
