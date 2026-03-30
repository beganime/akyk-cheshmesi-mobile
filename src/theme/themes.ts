export type ThemeName = 'lightOrange' | 'darkOrange' | 'lightGradient' | 'darkGradient';

export const themes = {
  lightOrange: {
    blurTint: 'light' as const,
    colors: {
      background: '#FFF7F0',
      card: 'rgba(255,255,255,0.58)',
      border: 'rgba(255,153,51,0.25)',
      text: '#1D1B16',
      muted: '#7D6D5B',
      primary: '#FF7A00',
    },
  },
  darkOrange: {
    blurTint: 'dark' as const,
    colors: {
      background: '#121212',
      card: 'rgba(28,28,30,0.62)',
      border: 'rgba(255,153,51,0.22)',
      text: '#FFFFFF',
      muted: '#A1A1AA',
      primary: '#FF8A1F',
    },
  },
  lightGradient: {
    blurTint: 'light' as const,
    colors: {
      background: '#F6F8FF',
      card: 'rgba(255,255,255,0.56)',
      border: 'rgba(77,107,255,0.18)',
      text: '#172033',
      muted: '#5F6C8A',
      primary: '#405CF5',
    },
  },
  darkGradient: {
    blurTint: 'dark' as const,
    colors: {
      background: '#0B1020',
      card: 'rgba(17,25,40,0.62)',
      border: 'rgba(86,119,252,0.20)',
      text: '#F8FAFC',
      muted: '#94A3B8',
      primary: '#4F6BFF',
    },
  },
};
