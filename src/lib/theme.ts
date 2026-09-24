// Dark, Plex-style palette modeled on Wholphin's default look.
export const colors = {
  background: '#0E0F14',
  surface: '#171922',
  surfaceRaised: '#20232F',
  border: '#2A2E3C',
  text: '#F2F3F7',
  textMuted: '#A3A8B8',
  textDim: '#6E7385',
  accent: '#8B7CF6',
  accentDim: '#3B3470',
  progress: '#8B7CF6',
  success: '#4ADE80',
  warning: '#FBBF24',
  danger: '#F87171',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const radius = { sm: 6, md: 10, lg: 14, pill: 999 };

export const type = {
  hero: { fontSize: 28, fontWeight: '800' as const, color: colors.text },
  title: { fontSize: 20, fontWeight: '700' as const, color: colors.text },
  rowTitle: { fontSize: 17, fontWeight: '700' as const, color: colors.text },
  body: { fontSize: 14, color: colors.text, lineHeight: 20 },
  meta: { fontSize: 13, color: colors.textMuted },
  small: { fontSize: 12, color: colors.textDim },
};
