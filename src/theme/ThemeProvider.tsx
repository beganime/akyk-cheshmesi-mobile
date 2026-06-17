import '../lib/mojibakeRuntimeFix';

import {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';
import {
  AppTheme,
  ThemeName,
  getThemeFamily,
  isDarkThemeName,
  isThemeName,
  themeNameForFamily,
  themes,
} from './themes';

const LEGACY_THEME_STORAGE_KEY = 'app_theme';
const THEME_MODE_STORAGE_KEY = 'app_theme_mode_v1';
const THEME_NAME_STORAGE_KEY = 'app_theme_name_v2';

export type ThemeMode = 'system' | 'light' | 'dark';

type ThemeContextType = {
  themeName: ThemeName;
  selectedThemeName: ThemeName;
  resolvedThemeName: ThemeName;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  setThemeName: (name: ThemeName) => Promise<void>;
  theme: AppTheme;
};

const ThemeContext = createContext<ThemeContextType | null>(null);

function isThemeMode(value: string | null): value is ThemeMode {
  return value === 'system' || value === 'light' || value === 'dark';
}

function normalizeLegacyThemeName(value: string | null): ThemeName | null {
  if (isThemeName(value)) return value;
  if (value === 'lightGradient') return 'lightGreen';
  if (value === 'darkGradient') return 'darkGreen';
  if (value === 'lightOrange') return 'lightOrange';
  if (value === 'darkOrange') return 'darkOrange';
  return null;
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('light');
  const [selectedThemeName, setSelectedThemeName] = useState<ThemeName>('lightGreen');

  useEffect(() => {
    AsyncStorage.multiGet([
      THEME_MODE_STORAGE_KEY,
      THEME_NAME_STORAGE_KEY,
      LEGACY_THEME_STORAGE_KEY,
    ]).then((entries) => {
      const mode = entries.find(([key]) => key === THEME_MODE_STORAGE_KEY)?.[1] ?? null;
      const savedThemeName =
        entries.find(([key]) => key === THEME_NAME_STORAGE_KEY)?.[1] ?? null;
      const legacyThemeName =
        entries.find(([key]) => key === LEGACY_THEME_STORAGE_KEY)?.[1] ?? null;
      const normalizedTheme = normalizeLegacyThemeName(savedThemeName || legacyThemeName);

      if (normalizedTheme) {
        setSelectedThemeName(normalizedTheme);
      }

      if (isThemeMode(mode)) {
        setThemeModeState(mode);
        return;
      }

      if (normalizedTheme) {
        setThemeModeState(isDarkThemeName(normalizedTheme) ? 'dark' : 'light');
      }
    });
  }, []);

  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    setThemeModeState(mode);

    if (mode === 'light' || mode === 'dark') {
      setSelectedThemeName((current) => {
        const next = themeNameForFamily(getThemeFamily(current), mode === 'dark');
        void AsyncStorage.setItem(THEME_NAME_STORAGE_KEY, next);
        return next;
      });
    }

    await AsyncStorage.setItem(THEME_MODE_STORAGE_KEY, mode);
  }, []);

  const setThemeName = useCallback(async (name: ThemeName) => {
    setSelectedThemeName(name);
    setThemeModeState(isDarkThemeName(name) ? 'dark' : 'light');

    await AsyncStorage.multiSet([
      [THEME_NAME_STORAGE_KEY, name],
      [LEGACY_THEME_STORAGE_KEY, name],
      [THEME_MODE_STORAGE_KEY, isDarkThemeName(name) ? 'dark' : 'light'],
    ]);
  }, []);

  const resolvedThemeName = useMemo<ThemeName>(() => {
    const current = selectedThemeName;

    if (themeMode === 'system') {
      return systemColorScheme === 'dark' ? 'darkGreen' : 'lightGreen';
    }

    if (themeMode === 'light' && isDarkThemeName(selectedThemeName)) {
      return themeNameForFamily(getThemeFamily(selectedThemeName), false);
    }

    if (themeMode === 'dark' && !isDarkThemeName(selectedThemeName)) {
      return themeNameForFamily(getThemeFamily(current), true);
    }

    return selectedThemeName;
  }, [selectedThemeName, systemColorScheme, themeMode]);

  const value = useMemo(
    () => ({
      themeName: resolvedThemeName,
      selectedThemeName,
      resolvedThemeName,
      themeMode,
      setThemeMode,
      setThemeName,
      theme: themes[resolvedThemeName],
    }),
    [resolvedThemeName, selectedThemeName, setThemeMode, setThemeName, themeMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
