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
      background: '#FFF7F0',
      backgroundSecondary: '#FFFFFF',
      backgroundTertiary: '#FFF0E2',
      card: 'rgba(255,255,255,0.78)',
      cardStrong: 'rgba(255,255,255,0.96)',
      cardSolid: '#FFFFFF',
      tabBar: 'rgba(255,255,255,0.86)',
      tabItemActive: 'rgba(255,255,255,0.98)',
      border: 'rgba(255,122,0,0.12)',
      borderStrong: 'rgba(255,122,0,0.18)',
      text: '#2B1D13',
      muted: '#8E6D58',
      primary: '#FF7A00',
      primarySoft: 'rgba(255,122,0,0.14)',
      danger: '#E5484D',
      success: '#1E9B62',
      inputBackground: 'rgba(255,255,255,0.96)',
      fab: '#FF7A00',
      fabText: '#FFFFFF',
      shadow: '#2B1D13',
      heroGradient: ['#FFE3C7', '#FFF2E5', '#FFFFFF'],
      bubbleOutgoing: '#FF7A00',
      bubbleIncoming: '#FFFFFF',
      composerBackground: '#FFFFFF',
    },
  },

  darkOrange: {
    blurTint: 'dark',
    colors: {
      background: '#17100D',
      backgroundSecondary: '#201612',
      backgroundTertiary: '#2A1D18',
      card: 'rgba(35,24,20,0.82)',
      cardStrong: 'rgba(43,29,24,0.96)',
      cardSolid: '#2A1D18',
      tabBar: 'rgba(23,16,13,0.90)',
      tabItemActive: 'rgba(48,33,27,0.96)',
      border: 'rgba(255,145,77,0.14)',
      borderStrong: 'rgba(255,145,77,0.22)',
      text: '#FFF5EE',
      muted: '#D1A98F',
      primary: '#FF8F33',
      primarySoft: 'rgba(255,143,51,0.18)',
      danger: '#FF6C73',
      success: '#35C98A',
      inputBackground: 'rgba(33,23,18,0.96)',
      fab: '#FF8F33',
      fabText: '#FFFFFF',
      shadow: '#000000',
      heroGradient: ['#4A2A1D', '#271A15', '#17100D'],
      bubbleOutgoing: '#FF8F33',
      bubbleIncoming: '#2A1D18',
      composerBackground: '#211712',
    },
  },

  lightGradient: {
    blurTint: 'light',
    colors: {
      background: '#F6F4FF',
      backgroundSecondary: '#FFFFFF',
      backgroundTertiary: '#ECEBFF',
      card: 'rgba(255,255,255,0.78)',
      cardStrong: 'rgba(255,255,255,0.96)',
      cardSolid: '#FFFFFF',
      tabBar: 'rgba(255,255,255,0.84)',
      tabItemActive: 'rgba(255,255,255,0.98)',
      border: 'rgba(98,112,255,0.12)',
      borderStrong: 'rgba(98,112,255,0.18)',
      text: '#1C2038',
      muted: '#737AA0',
      primary: '#5F6FFF',
      primarySoft: 'rgba(95,111,255,0.14)',
      danger: '#E5484D',
      success: '#1E9B62',
      inputBackground: 'rgba(255,255,255,0.97)',
      fab: '#5F6FFF',
      fabText: '#FFFFFF',
      shadow: '#1C2038',
      heroGradient: ['#FFE5EE', '#EEF0FF', '#FFFFFF'],
      bubbleOutgoing: '#5F6FFF',
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