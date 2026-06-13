export type ThemeName =
  | 'lightGreen'
  | 'darkGreen'
  | 'lightOrange'
  | 'darkOrange'
  | 'lightBlue'
  | 'darkBlue'
  | 'lightRed'
  | 'darkRed';

export type ThemeFamily = 'green' | 'orange' | 'blue' | 'red';

export type AppTheme = {
  blurTint: 'light' | 'dark';
  isDark: boolean;
  family: ThemeFamily;
  label: string;
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

type PaletteInput = {
  name: ThemeName;
  label: string;
  family: ThemeFamily;
  isDark: boolean;
  background: string;
  backgroundSecondary: string;
  backgroundTertiary: string;
  card: string;
  cardStrong: string;
  border: string;
  borderStrong: string;
  text: string;
  muted: string;
  primary: string;
  primarySoft: string;
  inputBackground: string;
  heroGradient: [string, string, string];
  bubbleIncoming?: string;
};

function makeTheme(input: PaletteInput): AppTheme {
  return {
    blurTint: input.isDark ? 'dark' : 'light',
    isDark: input.isDark,
    family: input.family,
    label: input.label,
    colors: {
      background: input.background,
      backgroundSecondary: input.backgroundSecondary,
      backgroundTertiary: input.backgroundTertiary,
      card: input.card,
      cardStrong: input.cardStrong,
      cardSolid: input.isDark ? input.backgroundSecondary : '#FFFFFF',
      tabBar: input.isDark ? 'rgba(8,14,20,0.96)' : 'rgba(255,255,255,0.96)',
      tabItemActive: input.primarySoft,
      border: input.border,
      borderStrong: input.borderStrong,
      text: input.text,
      muted: input.muted,
      primary: input.primary,
      primarySoft: input.primarySoft,
      danger: input.isDark ? '#F87171' : '#DC2626',
      success: '#22C55E',
      inputBackground: input.inputBackground,
      fab: input.primary,
      fabText: '#FFFFFF',
      shadow: input.isDark ? '#000000' : '#0F172A',
      heroGradient: input.heroGradient,
      bubbleOutgoing: input.primary,
      bubbleIncoming: input.bubbleIncoming || input.cardStrong,
      composerBackground: input.isDark ? input.backgroundSecondary : '#FFFFFF',
    },
  };
}

export const themes: Record<ThemeName, AppTheme> = {
  lightGreen: makeTheme({
    name: 'lightGreen',
    label: 'Светлая зелёная',
    family: 'green',
    isDark: false,
    background: '#FFFFFF',
    backgroundSecondary: '#F6FFF9',
    backgroundTertiary: '#E9FFF3',
    card: '#FFFFFF',
    cardStrong: '#F2FFF7',
    border: '#DCF7E7',
    borderStrong: '#BEEFD4',
    text: '#0B1F16',
    muted: '#5C7768',
    primary: '#0F9D58',
    primarySoft: 'rgba(52,199,89,0.14)',
    inputBackground: '#F1FFF6',
    heroGradient: ['#E9FFF3', '#D7FBE8', '#FFFFFF'],
    bubbleIncoming: '#FFFFFF',
  }),
  darkGreen: makeTheme({
    name: 'darkGreen',
    label: 'Тёмная зелёная',
    family: 'green',
    isDark: true,
    background: '#061A12',
    backgroundSecondary: '#0B2A1A',
    backgroundTertiary: '#0F5132',
    card: '#0B2A1A',
    cardStrong: '#0E3020',
    border: 'rgba(233,255,243,0.10)',
    borderStrong: 'rgba(233,255,243,0.16)',
    text: '#E9FFF3',
    muted: '#A7C7B5',
    primary: '#1DB954',
    primarySoft: 'rgba(29,185,84,0.20)',
    inputBackground: '#0B2A1A',
    heroGradient: ['#0F5132', '#0B2A1A', '#061A12'],
  }),
  lightOrange: makeTheme({
    name: 'lightOrange',
    label: 'Светлая оранжевая',
    family: 'orange',
    isDark: false,
    background: '#FFFFFF',
    backgroundSecondary: '#FFF8F1',
    backgroundTertiary: '#FFEBD5',
    card: '#FFFFFF',
    cardStrong: '#FFF5EA',
    border: '#FAD7B5',
    borderStrong: '#FDBA74',
    text: '#26170A',
    muted: '#80634A',
    primary: '#F97316',
    primarySoft: 'rgba(249,115,22,0.15)',
    inputBackground: '#FFF7ED',
    heroGradient: ['#FFF7ED', '#FFEDD5', '#FFFFFF'],
    bubbleIncoming: '#FFFFFF',
  }),
  darkOrange: makeTheme({
    name: 'darkOrange',
    label: 'Тёмная оранжевая',
    family: 'orange',
    isDark: true,
    background: '#1B1008',
    backgroundSecondary: '#2A170B',
    backgroundTertiary: '#5A2A0C',
    card: '#2A170B',
    cardStrong: '#331D0E',
    border: 'rgba(255,237,213,0.10)',
    borderStrong: 'rgba(255,237,213,0.17)',
    text: '#FFF7ED',
    muted: '#E5B98D',
    primary: '#FB923C',
    primarySoft: 'rgba(251,146,60,0.20)',
    inputBackground: '#2A170B',
    heroGradient: ['#5A2A0C', '#2A170B', '#1B1008'],
  }),
  lightBlue: makeTheme({
    name: 'lightBlue',
    label: 'Светлая синяя',
    family: 'blue',
    isDark: false,
    background: '#FFFFFF',
    backgroundSecondary: '#F4F9FF',
    backgroundTertiary: '#E4F1FF',
    card: '#FFFFFF',
    cardStrong: '#EFF6FF',
    border: '#D6E8FF',
    borderStrong: '#93C5FD',
    text: '#071A2F',
    muted: '#526D8A',
    primary: '#2AABEE',
    primarySoft: 'rgba(42,171,238,0.15)',
    inputBackground: '#EFF6FF',
    heroGradient: ['#EFF6FF', '#DBEAFE', '#FFFFFF'],
    bubbleIncoming: '#FFFFFF',
  }),
  darkBlue: makeTheme({
    name: 'darkBlue',
    label: 'Тёмная синяя',
    family: 'blue',
    isDark: true,
    background: '#07111F',
    backgroundSecondary: '#0E1B2D',
    backgroundTertiary: '#12385A',
    card: '#0E1B2D',
    cardStrong: '#13243A',
    border: 'rgba(219,234,254,0.10)',
    borderStrong: 'rgba(219,234,254,0.17)',
    text: '#EAF4FF',
    muted: '#9DB8D6',
    primary: '#38BDF8',
    primarySoft: 'rgba(56,189,248,0.20)',
    inputBackground: '#0E1B2D',
    heroGradient: ['#12385A', '#0E1B2D', '#07111F'],
  }),
  lightRed: makeTheme({
    name: 'lightRed',
    label: 'Светлая красная',
    family: 'red',
    isDark: false,
    background: '#FFFFFF',
    backgroundSecondary: '#FFF5F5',
    backgroundTertiary: '#FFE4E6',
    card: '#FFFFFF',
    cardStrong: '#FFF1F2',
    border: '#FAD1D8',
    borderStrong: '#FDA4AF',
    text: '#2A0B13',
    muted: '#81515D',
    primary: '#E11D48',
    primarySoft: 'rgba(225,29,72,0.14)',
    inputBackground: '#FFF1F2',
    heroGradient: ['#FFF1F2', '#FFE4E6', '#FFFFFF'],
    bubbleIncoming: '#FFFFFF',
  }),
  darkRed: makeTheme({
    name: 'darkRed',
    label: 'Тёмная красная',
    family: 'red',
    isDark: true,
    background: '#1C070D',
    backgroundSecondary: '#2A0D15',
    backgroundTertiary: '#5F1125',
    card: '#2A0D15',
    cardStrong: '#35111B',
    border: 'rgba(255,228,230,0.10)',
    borderStrong: 'rgba(255,228,230,0.17)',
    text: '#FFF1F2',
    muted: '#E6A3AF',
    primary: '#FB7185',
    primarySoft: 'rgba(251,113,133,0.20)',
    inputBackground: '#2A0D15',
    heroGradient: ['#5F1125', '#2A0D15', '#1C070D'],
  }),
};

export const themeOptions: { name: ThemeName; label: string }[] = [
  { name: 'lightGreen', label: themes.lightGreen.label },
  { name: 'darkGreen', label: themes.darkGreen.label },
  { name: 'lightOrange', label: themes.lightOrange.label },
  { name: 'darkOrange', label: themes.darkOrange.label },
  { name: 'lightBlue', label: themes.lightBlue.label },
  { name: 'darkBlue', label: themes.darkBlue.label },
  { name: 'lightRed', label: themes.lightRed.label },
  { name: 'darkRed', label: themes.darkRed.label },
];

export function isThemeName(value: string | null | undefined): value is ThemeName {
  return Boolean(value && value in themes);
}

export function isDarkThemeName(name: ThemeName) {
  return themes[name].isDark;
}

export function getThemeFamily(name: ThemeName): ThemeFamily {
  return themes[name].family;
}

export function themeNameForFamily(family: ThemeFamily, dark: boolean): ThemeName {
  const prefix = dark ? 'dark' : 'light';
  const capitalized = `${family.slice(0, 1).toUpperCase()}${family.slice(1)}`;
  return `${prefix}${capitalized}` as ThemeName;
}
