import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSession } from '@/lib/session';
import { colors, radius, spacing, type } from '@/lib/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function Row({ icon, label, value, onPress, danger }: { icon: IconName; label: string; value?: string; onPress?: () => void; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceRaised }]}>
      <Ionicons name={icon} size={20} color={danger ? colors.danger : colors.textMuted} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, danger && { color: colors.danger }]}>{label}</Text>
        {value ? (
          <Text style={type.small} numberOfLines={1}>
            {value}
          </Text>
        ) : null}
      </View>
      {onPress && !danger && <Ionicons name="chevron-forward" size={18} color={colors.textDim} />}
    </Pressable>
  );
}

export default function Settings() {
  const { session, seerrConfig, signOut } = useSession();

  const confirmSignOut = () =>
    Alert.alert('Sign out', `Sign out of ${session?.serverName ?? 'this server'}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
    ]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl }}>
      <View style={styles.group}>
        <Text style={styles.groupTitle}>Jellyfin</Text>
        <View style={styles.card}>
          <Row icon="server-outline" label={session?.serverName ?? 'Server'} value={session?.serverUrl} />
          <Row icon="person-circle-outline" label="Signed in as" value={session?.userName} />
        </View>
      </View>

      <View style={styles.group}>
        <Text style={styles.groupTitle}>Playback</Text>
        <View style={styles.card}>
          <Row
            icon="play-circle-outline"
            label="Playback & subtitles"
            value="Players, quality, subtitle style, skipping"
            onPress={() => router.push('/playback-settings')}
          />
          <Row icon="download-outline" label="Downloads" value="Watch offline" onPress={() => router.push('/downloads')} />
        </View>
      </View>

      <View style={styles.group}>
        <Text style={styles.groupTitle}>Requests</Text>
        <View style={styles.card}>
          <Row
            icon="compass-outline"
            label="Seerr server"
            value={seerrConfig ? seerrConfig.url : 'Not connected'}
            onPress={() => router.push('/seerr-settings')}
          />
        </View>
      </View>

      <View style={styles.group}>
        <Text style={styles.groupTitle}>App</Text>
        <View style={styles.card}>
          <Row icon="information-circle-outline" label="About & credits" onPress={() => router.push('/about')} />
          <Row icon="log-out-outline" label="Sign out" danger onPress={confirmSignOut} />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  group: { gap: spacing.sm },
  groupTitle: { color: colors.textDim, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  rowLabel: { color: colors.text, fontSize: 15, fontWeight: '500' },
});
