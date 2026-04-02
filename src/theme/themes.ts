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
      background: '#F6F8FC',
      backgroundSecondary: '#FFFFFF',
      backgroundTertiary: '#EEF2FB',
      card: 'rgba(255,255,255,0.78)',
      cardStrong: 'rgba(255,255,255,0.94)',
      cardSolid: '#FFFFFF',
      tabBar: 'rgba(255,255,255,0.84)',
      tabItemActive: 'rgba(255,255,255,0.98)',
      border: 'rgba(86,108,173,0.10)',
      borderStrong: 'rgba(86,108,173,0.16)',
      text: '#162033',
      muted: '#71809E',
      primary: '#4E7BFF',
      primarySoft: 'rgba(78,123,255,0.14)',
      danger: '#E5484D',
      success: '#1E9B62',
      inputBackground: 'rgba(255,255,255,0.96)',
      fab: '#4E7BFF',
      fabText: '#FFFFFF',
      shadow: '#0F172A',
      heroGradient: ['#EAF1FF', '#F7F9FF', '#FFFFFF'],
      bubbleOutgoing: '#4E7BFF',
      bubbleIncoming: '#FFFFFF',
      composerBackground: '#FFFFFF',
    },
  },

  darkOrange: {
    blurTint: 'dark',
    colors: {
      background: '#0E1320',
      backgroundSecondary: '#121A2B',
      backgroundTertiary: '#182235',
      card: 'rgba(22,30,46,0.78)',
      cardStrong: 'rgba(28,38,58,0.96)',
      cardSolid: '#182235',
      tabBar: 'rgba(16,24,38,0.86)',
      tabItemActive: 'rgba(26,38,58,0.96)',
      border: 'rgba(119,146,212,0.12)',
      borderStrong: 'rgba(119,146,212,0.18)',
      text: '#F5F8FF',
      muted: '#91A0BC',
      primary: '#6C86FF',
      primarySoft: 'rgba(108,134,255,0.18)',
      danger: '#FF6C73',
      success: '#35C98A',
      inputBackground: 'rgba(19,27,42,0.96)',
      fab: '#6C86FF',
      fabText: '#FFFFFF',
      shadow: '#000000',
      heroGradient: ['#18284A', '#121B31', '#0E1320'],
      bubbleOutgoing: '#5B79FF',
      bubbleIncoming: '#182235',
      composerBackground: '#101827',
    },
  },

  lightGradient: {
    blurTint: 'light',
    colors: {
      background: '#F3F7FF',
      backgroundSecondary: '#FFFFFF',
      backgroundTertiary: '#EAF1FF',
      card: 'rgba(255,255,255,0.76)',
      cardStrong: 'rgba(255,255,255,0.96)',
      cardSolid: '#FFFFFF',
      tabBar: 'rgba(255,255,255,0.82)',
      tabItemActive: 'rgba(255,255,255,0.98)',
      border: 'rgba(92,120,200,0.10)',
      borderStrong: 'rgba(92,120,200,0.16)',
      text: '#172033',
      muted: '#7183A6',
      primary: '#5A6BFF',
      primarySoft: 'rgba(90,107,255,0.14)',
      danger: '#E5484D',
      success: '#1E9B62',
      inputBackground: 'rgba(255,255,255,0.97)',
      fab: '#5A6BFF',
      fabText: '#FFFFFF',
      shadow: '#162033',
      heroGradient: ['#E5ECFF', '#F6F8FF', '#FFFFFF'],
      bubbleOutgoing: '#5A6BFF',
      bubbleIncoming: '#FFFFFF',
      composerBackground: '#FFFFFF',
    },
  },

  darkGradient: {
    blurTint: 'dark',
    colors: {
      background: '#0B1020',
      backgroundSecondary: '#11182B',
      backgroundTertiary: '#17213A',
      card: 'rgba(18,25,43,0.78)',
      cardStrong: 'rgba(25,35,58,0.96)',
      cardSolid: '#17213A',
      tabBar: 'rgba(11,16,32,0.88)',
      tabItemActive: 'rgba(26,37,64,0.96)',
      border: 'rgba(120,146,217,0.12)',
      borderStrong: 'rgba(120,146,217,0.18)',
      text: '#F4F7FF',
      muted: '#96A4C1',
      primary: '#6D84FF',
      primarySoft: 'rgba(109,132,255,0.18)',
      danger: '#FF7077',
      success: '#39CC91',
      inputBackground: 'rgba(17,24,43,0.98)',
      fab: '#6D84FF',
      fabText: '#FFFFFF',
      shadow: '#000000',
      heroGradient: ['#18274A', '#121B31', '#0B1020'],
      bubbleOutgoing: '#5E79FF',
      bubbleIncoming: '#17213A',
      composerBackground: '#0F172A',
    },
  },
};