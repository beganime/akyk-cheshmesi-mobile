import { PropsWithChildren, createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeName, themes } from './themes';

const STORAGE_KEY = 'app_theme';

type ThemeContextType = {
  themeName: ThemeName;
  setThemeName: (name: ThemeName) => void;
  theme: (typeof themes)[ThemeName];
};

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: PropsWithChildren) {
  const [themeName, setThemeNameState] = useState<ThemeName>('darkGradient');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((value) => {
      if (value && value in themes) setThemeNameState(value as ThemeName);
    });
  }, []);

  const setThemeName = async (name: ThemeName) => {
    setThemeNameState(name);
    await AsyncStorage.setItem(STORAGE_KEY, name);
  };

  const value = useMemo(
    () => ({ themeName, setThemeName, theme: themes[themeName] }),
    [themeName]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
