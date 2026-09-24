import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button, Field } from '@/components/ui';
import { useSession } from '@/lib/session';
import { colors, spacing, type } from '@/lib/theme';

export default function Login() {
  const { signIn } = useSession();
  const [server, setServer] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const submit = async () => {
    if (!server || !username) return;
    setBusy(true);
    setError(undefined);
    try {
      await signIn(server, username, password);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <View style={styles.logo}>
              <Ionicons name="play" size={34} color={colors.background} />
            </View>
            <Text style={type.hero}>WholphinMobile</Text>
            <Text style={[type.meta, { textAlign: 'center' }]}>
              Sign in to your Jellyfin server to get started.
            </Text>
          </View>

          <Field
            label="Server address"
            placeholder="https://jellyfin.example.com or 192.168.1.10:8096"
            value={server}
            onChangeText={setServer}
            keyboardType="url"
            textContentType="URL"
          />
          <Field label="Username" value={username} onChangeText={setUsername} textContentType="username" />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="password"
            onSubmitEditing={submit}
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <Button label="Sign in" onPress={submit} loading={busy} disabled={busy || !server || !username} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.xl, gap: spacing.lg, flexGrow: 1, justifyContent: 'center', maxWidth: 480, width: '100%', alignSelf: 'center' },
  brand: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xl },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  error: { color: colors.danger, fontSize: 14 },
});
