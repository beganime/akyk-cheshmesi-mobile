export type ThemeName =
  | 'lightOrange'
  | 'darkOrange'
  | 'lightGradient'
  | 'darkGradient';

export type AppTheme = {
  blurTint: 'light' | 'dark';
  isDark: boolean;
  colors: {
    background: string;
    backgroundSecondary: string;
    backgroundTertiary: string;
    card: string;
    cardStrong: string;
    cardSolid: string;
    tabBar: string;
    tabItemActive: string;
    border: string;
    borderStrong: string;
    text: string;
    muted: string;
    primary: string;
    primarySoft: string;
    danger: string;
    success: string;
    inputBackground: string;
    fab: string;
    fabText: string;
    shadow: string;
    heroGradient: [string, string, string];
    bubbleOutgoing: string;
    bubbleIncoming: string;
    composerBackground: string;
  };
};

const lightGreen: AppTheme = {
  blurTint: 'light',
  isDark: false,
  colors: {
    background: '#FFFFFF',
    backgroundSecondary: '#F7FFF9',
    backgroundTertiary: '#E9FFF3',
    card: 'rgba(255,255,255,0.94)',
    cardStrong: '#F4FFF8',
    cardSolid: '#FFFFFF',
    tabBar: 'rgba(255,255,255,0.95)',
    tabItemActive: '#E9FFF3',
    border: '#D7FBE8',
    borderStrong: '#BEEFD4',
    text: '#0B1F16',
    muted: '#5C7768',
    primary: '#0F9D58',
    primarySoft: 'rgba(52,199,89,0.14)',
    danger: '#EF4444',
    success: '#34C759',
    inputBackground: '#F1FFF6',
    fab: '#0F9D58',
    fabText: '#FFFFFF',
    shadow: '#0F2A1D',
    heroGradient: ['#E9FFF3', '#D7FBE8', '#FFFFFF'],
    bubbleOutgoing: '#0F9D58',
    bubbleIncoming: '#FFFFFF',
    composerBackground: '#FFFFFF',
  },
};

const darkGreen: AppTheme = {
  blurTint: 'dark',
  isDark: true,
  colors: {
    background: '#061A12',
    backgroundSecondary: '#0B2A1A',
    backgroundTertiary: '#0F5132',
    card: 'rgba(11,42,26,0.90)',
    cardStrong: '#0E3020',
    cardSolid: '#0B2A1A',
    tabBar: 'rgba(6,26,18,0.96)',
    tabItemActive: '#0F5132',
    border: 'rgba(233,255,243,0.10)',
    borderStrong: 'rgba(233,255,243,0.16)',
    text: '#E9FFF3',
    muted: '#A7C7B5',
    primary: '#1DB954',
    primarySoft: 'rgba(29,185,84,0.20)',
    danger: '#F87171',
    success: '#34C759',
    inputBackground: '#0B2A1A',
    fab: '#1DB954',
    fabText: '#FFFFFF',
    shadow: '#000000',
    heroGradient: ['#0F5132', '#0B2A1A', '#061A12'],
    bubbleOutgoing: '#0F9D58',
    bubbleIncoming: '#0B2A1A',
    composerBackground: '#0B2A1A',
  },
};

export const themes: Record<ThemeName, AppTheme> = {
  lightOrange: lightGreen,
  darkOrange: darkGreen,
  lightGradient: lightGreen,
  darkGradient: darkGreen,
};
