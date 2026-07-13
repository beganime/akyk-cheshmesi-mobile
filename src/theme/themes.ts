export type ThemeName =
  | 'lightGreen'
  | 'darkGreen'
  | 'lightOrange'
  | 'darkOrange'
  | 'lightBlue'
  | 'darkBlue';

export type ThemeFamily = 'green' | 'orange' | 'blue';

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
  label: string;
  family: ThemeFamily;
  isDark: boolean;
  background: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  borderStrong: string;
  text: string;
  muted: string;
  primary: string;
  primarySoft: string;
  accent: string;
  heroGradient: [string, string, string];
};

function makeTheme(input: PaletteInput): AppTheme {
  const outgoing = input.isDark ? input.primary : input.primary;

  return {
    blurTint: input.isDark ? 'dark' : 'light',
    isDark: input.isDark,
    family: input.family,
    label: input.label,
    colors: {
      background: input.background,
      backgroundSecondary: input.surface,
      backgroundTertiary: input.surfaceRaised,
      card: input.surface,
      cardStrong: input.surfaceRaised,
      cardSolid: input.surface,
      tabBar: input.surface,
      tabItemActive: input.primarySoft,
      border: input.border,
      borderStrong: input.borderStrong,
      text: input.text,
      muted: input.muted,
      primary: input.primary,
      primarySoft: input.primarySoft,
      danger: input.isDark ? '#ff8f8f' : '#a8333a',
      success: input.accent,
      inputBackground: input.surfaceRaised,
      fab: input.primary,
      fabText: '#ffffff',
      shadow: input.isDark ? '#000000' : '#292827',
      heroGradient: input.heroGradient,
      bubbleOutgoing: outgoing,
      bubbleIncoming: input.surfaceRaised,
      composerBackground: input.surface,
    },
  };
}

export const themes: Record<ThemeName, AppTheme> = {
  lightGreen: makeTheme({
    label: 'Editorial светлая',
    family: 'green',
    isDark: false,
    background: '#f2f0eb',
    surface: '#ffffff',
    surfaceRaised: '#f8f7f3',
    border: '#e3e3e2',
    borderStrong: '#d2d0cc',
    text: '#292827',
    muted: '#66635f',
    primary: '#421d24',
    primarySoft: '#eee6e8',
    accent: '#0c4243',
    heroGradient: ['#f2f0eb', '#ebe7df', '#ffffff'],
  }),
  darkGreen: makeTheme({
    label: 'Editorial тёмная',
    family: 'green',
    isDark: true,
    background: '#181716',
    surface: '#23211f',
    surfaceRaised: '#2d2a27',
    border: '#383532',
    borderStrong: '#4a4641',
    text: '#f2f0eb',
    muted: '#b2ada5',
    primary: '#d4c7ff',
    primarySoft: '#3a334c',
    accent: '#72b4aa',
    heroGradient: ['#181716', '#201b1d', '#0c4243'],
  }),
  lightOrange: makeTheme({
    label: 'Янтарная светлая',
    family: 'orange',
    isDark: false,
    background: '#f5f1e8',
    surface: '#ffffff',
    surfaceRaised: '#fbf6ea',
    border: '#e7dcc7',
    borderStrong: '#d8c49f',
    text: '#30291f',
    muted: '#756b5e',
    primary: '#8a4b16',
    primarySoft: '#f4e2cf',
    accent: '#596b3d',
    heroGradient: ['#f5f1e8', '#f3e3cf', '#ffffff'],
  }),
  darkOrange: makeTheme({
    label: 'Янтарная тёмная',
    family: 'orange',
    isDark: true,
    background: '#1c1813',
    surface: '#29231c',
    surfaceRaised: '#342b21',
    border: '#43382a',
    borderStrong: '#5b4934',
    text: '#f7efe3',
    muted: '#c4b39d',
    primary: '#e2a467',
    primarySoft: '#493321',
    accent: '#a9b987',
    heroGradient: ['#1c1813', '#2b2118', '#4e2d18'],
  }),
  lightBlue: makeTheme({
    label: 'Лагуна светлая',
    family: 'blue',
    isDark: false,
    background: '#eef2f1',
    surface: '#ffffff',
    surfaceRaised: '#f2f7f6',
    border: '#d9e3e1',
    borderStrong: '#bfd1ce',
    text: '#202b2b',
    muted: '#607170',
    primary: '#0c4243',
    primarySoft: '#dcebea',
    accent: '#714cb6',
    heroGradient: ['#eef2f1', '#dcebea', '#ffffff'],
  }),
  darkBlue: makeTheme({
    label: 'Лагуна тёмная',
    family: 'blue',
    isDark: true,
    background: '#0e1919',
    surface: '#152524',
    surfaceRaised: '#1b302f',
    border: '#28413f',
    borderStrong: '#365653',
    text: '#edf5f3',
    muted: '#a8bfbb',
    primary: '#75bbb2',
    primarySoft: '#203f3d',
    accent: '#d4c7ff',
    heroGradient: ['#0e1919', '#12302f', '#1e1830'],
  }),
};

export const themeOptions: { name: ThemeName; label: string }[] = (
  Object.keys(themes) as ThemeName[]
).map((name) => ({ name, label: themes[name].label }));

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
