export type ThemeName =
  | 'lightOrange'
  | 'darkOrange'
  | 'lightGradient'
  | 'darkGradient';

type AppTheme = {
  blurTint: 'light' | 'dark';
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

export const themes: Record<ThemeName, AppTheme> = {
  lightOrange: {
    blurTint: 'light',
    colors: {
      background: '#FFFFFF',
      backgroundSecondary: '#FFFFFF',
      backgroundTertiary: '#F2F6FA',
      card: 'rgba(255,255,255,0.92)',
      cardStrong: '#F7F9FC',
      cardSolid: '#FFFFFF',
      tabBar: 'rgba(255,255,255,0.94)',
      tabItemActive: 'rgba(255,255,255,0.98)',
      border: '#E4EAF1',
      borderStrong: '#D9E2EC',
      text: '#111827',
      muted: '#6B7280',
      primary: '#2AABEE',
      primarySoft: 'rgba(42,171,238,0.13)',
      danger: '#EF4444',
      success: '#22C55E',
      inputBackground: '#F2F6FA',
      fab: '#2AABEE',
      fabText: '#FFFFFF',
      shadow: '#101828',
      heroGradient: ['#F8FBFF', '#EAF5FE', '#FFFFFF'],
      bubbleOutgoing: '#2AABEE',
      bubbleIncoming: '#FFFFFF',
      composerBackground: '#FFFFFF',
    },
  },

  darkOrange: {
    blurTint: 'dark',
    colors: {
      background: '#0E1621',
      backgroundSecondary: '#17212B',
      backgroundTertiary: '#202B36',
      card: 'rgba(23,33,43,0.88)',
      cardStrong: '#17212B',
      cardSolid: '#17212B',
      tabBar: 'rgba(14,22,33,0.94)',
      tabItemActive: '#202B36',
      border: 'rgba(255,255,255,0.07)',
      borderStrong: 'rgba(255,255,255,0.10)',
      text: '#F8FAFC',
      muted: '#8FA3B8',
      primary: '#5288C1',
      primarySoft: 'rgba(82,136,193,0.20)',
      danger: '#F87171',
      success: '#34D399',
      inputBackground: '#202B36',
      fab: '#5288C1',
      fabText: '#FFFFFF',
      shadow: '#000000',
      heroGradient: ['#202B36', '#17212B', '#0E1621'],
      bubbleOutgoing: '#5288C1',
      bubbleIncoming: '#17212B',
      composerBackground: '#17212B',
    },
  },

  lightGradient: {
    blurTint: 'light',
    colors: {
      background: '#FFFFFF',
      backgroundSecondary: '#FFFFFF',
      backgroundTertiary: '#F1F5F9',
      card: 'rgba(255,255,255,0.94)',
      cardStrong: '#F8FAFC',
      cardSolid: '#FFFFFF',
      tabBar: 'rgba(255,255,255,0.94)',
      tabItemActive: 'rgba(255,255,255,0.98)',
      border: '#E2E8F0',
      borderStrong: '#CBD5E1',
      text: '#111827',
      muted: '#64748B',
      primary: '#3390EC',
      primarySoft: 'rgba(51,144,236,0.13)',
      danger: '#EF4444',
      success: '#22C55E',
      inputBackground: '#F1F5F9',
      fab: '#3390EC',
      fabText: '#FFFFFF',
      shadow: '#0F172A',
      heroGradient: ['#F8FBFF', '#E8F4FF', '#FFFFFF'],
      bubbleOutgoing: '#3390EC',
      bubbleIncoming: '#FFFFFF',
      composerBackground: '#FFFFFF',
    },
  },

  darkGradient: {
    blurTint: 'dark',
    colors: {
      background: '#0E1621',
      backgroundSecondary: '#17212B',
      backgroundTertiary: '#202B36',
      card: 'rgba(23,33,43,0.90)',
      cardStrong: '#17212B',
      cardSolid: '#17212B',
      tabBar: 'rgba(14,22,33,0.94)',
      tabItemActive: '#202B36',
      border: 'rgba(255,255,255,0.07)',
      borderStrong: 'rgba(255,255,255,0.10)',
      text: '#F8FAFC',
      muted: '#8FA3B8',
      primary: '#5288C1',
      primarySoft: 'rgba(82,136,193,0.20)',
      danger: '#F87171',
      success: '#34D399',
      inputBackground: '#202B36',
      fab: '#5288C1',
      fabText: '#FFFFFF',
      shadow: '#000000',
      heroGradient: ['#202B36', '#17212B', '#0E1621'],
      bubbleOutgoing: '#5288C1',
      bubbleIncoming: '#17212B',
      composerBackground: '#17212B',
    },
  },
};
