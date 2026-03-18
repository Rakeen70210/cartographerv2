export const cartographerTheme = {
  colors: {
    background: '#07131F',
    backgroundElevated: '#0D1B2A',
    surface: 'rgba(15, 35, 50, 0.92)',
    surfaceSoft: 'rgba(28, 52, 71, 0.88)',
    border: 'rgba(190, 220, 240, 0.12)',
    textPrimary: '#F4FAFF',
    textSecondary: '#9BB3C6',
    accent: '#69D2FF',
    accentWarm: '#F6C96C',
    accentSuccess: '#84F1BA',
    accentDanger: '#FF9A8A',
    accentMuted: '#6E89A0',
    overlay: 'rgba(5, 12, 19, 0.78)',
    pill: 'rgba(255, 255, 255, 0.08)',
  },
  spacing: {
    xs: 6,
    sm: 10,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
  },
  radius: {
    sm: 12,
    md: 18,
    lg: 24,
    pill: 999,
  },
};

export type CartographerTheme = typeof cartographerTheme;
