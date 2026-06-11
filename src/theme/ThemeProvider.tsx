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
import { AppTheme, ThemeName, themes } from './themes';

const LEGACY_THEME_STORAGE_KEY = 'app_theme';
const THEME_MODE_STORAGE_KEY = 'app_theme_mode_v1';

export type ThemeMode = 'system' | 'light' | 'dark';

type ThemeContextType = {
  themeName: ThemeName;
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

function modeToThemeName(mode: Exclude<ThemeMode, 'system'>): ThemeName {
  return mode === 'dark' ? 'darkGradient' : 'lightGradient';
}

function themeNameToMode(name: ThemeName): Exclude<ThemeMode, 'system'> {
  return name === 'darkGradient' || name === 'darkOrange' ? 'dark' : 'light';
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    AsyncStorage.multiGet([THEME_MODE_STORAGE_KEY, LEGACY_THEME_STORAGE_KEY]).then((entries) => {
      const mode = entries.find(([key]) => key === THEME_MODE_STORAGE_KEY)?.[1] ?? null;
      const legacyThemeName =
        entries.find(([key]) => key === LEGACY_THEME_STORAGE_KEY)?.[1] ?? null;

      if (isThemeMode(mode)) {
        setThemeModeState(mode);
        return;
      }

      if (legacyThemeName && legacyThemeName in themes) {
        setThemeModeState(themeNameToMode(legacyThemeName as ThemeName));
      }
    });
  }, []);

  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    setThemeModeState(mode);
    await AsyncStorage.setItem(THEME_MODE_STORAGE_KEY, mode);
  }, []);

  const setThemeName = useCallback(
    async (name: ThemeName) => {
      const nextMode = themeNameToMode(name);
      setThemeModeState(nextMode);
      await AsyncStorage.multiSet([
        [THEME_MODE_STORAGE_KEY, nextMode],
        [LEGACY_THEME_STORAGE_KEY, name],
      ]);
    },
    [],
  );

  const resolvedThemeName = useMemo<ThemeName>(() => {
    if (themeMode === 'system') {
      return systemColorScheme === 'dark' ? 'darkGradient' : 'lightGradient';
    }

    return modeToThemeName(themeMode);
  }, [systemColorScheme, themeMode]);

  const themeName = resolvedThemeName;

  const value = useMemo(
    () => ({
      themeName,
      resolvedThemeName,
      themeMode,
      setThemeMode,
      setThemeName,
      theme: themes[resolvedThemeName],
    }),
    [resolvedThemeName, setThemeMode, setThemeName, themeMode, themeName],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
