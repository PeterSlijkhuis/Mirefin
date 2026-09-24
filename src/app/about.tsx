import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CLIENT_VERSION } from '@/api/jellyfin';
import { colors, radius, spacing, type } from '@/lib/theme';

const LINKS = [
  { label: 'Wholphin on GitHub', url: 'https://github.com/damontecres/Wholphin' },
  { label: 'Jellyfin', url: 'https://jellyfin.org' },
  { label: 'Seerr', url: 'https://github.com/seerr-team/seerr' },
];

export default function About() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <View style={{ gap: spacing.xs }}>
        <Text style={type.title}>WholphinMobile</Text>
        <Text style={type.meta}>Version {CLIENT_VERSION}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>Credits</Text>
        <Text style={type.body}>
          WholphinMobile's look and feel is inspired by Wholphin, the open-source Android TV client for Jellyfin created
          by damontecres and its contributors. Huge thanks to them for the design this app follows on phones and
          tablets.
        </Text>
        <Text style={type.body}>
          This app is an independent project. It is not affiliated with or endorsed by the Wholphin, Jellyfin or Seerr
          projects, and it shares no code with Wholphin.
        </Text>
      </View>

      <View style={styles.card}>
        {LINKS.map((l) => (
          <Pressable key={l.url} style={styles.link} onPress={() => Linking.openURL(l.url)}>
            <Text style={styles.linkText}>{l.label}</Text>
            <Ionicons name="open-outline" size={16} color={colors.textMuted} />
          </Pressable>
        ))}
      </View>

      <Text style={type.small}>
        Movie and TV metadata and images in Discover are provided by TMDB through your Seerr server.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, gap: spacing.lg },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  heading: { color: colors.text, fontSize: 16, fontWeight: '700' },
  link: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.xs },
  linkText: { color: colors.accent, fontSize: 15, fontWeight: '600' },
});
