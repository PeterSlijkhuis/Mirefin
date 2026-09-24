// Night-sea palette: deep indigo water with a wave-blue accent, after the Mirefin logo.
export const colors = {
  background: '#0A1018',
  surface: '#121B26',
  surfaceRaised: '#1A2634',
  border: '#243244',
  text: '#F4EEE2',
  textMuted: '#A8B3C2',
  textDim: '#6B7888',
  accent: '#5BB4E5',
  accentDim: '#1D3F5A',
  progress: '#5BB4E5',
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
