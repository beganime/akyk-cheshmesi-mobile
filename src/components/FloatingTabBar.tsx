import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/src/theme/ThemeProvider';

const TAB_UI = {
  dark: {
    bgSecondary: '#17212b',
    accent: '#5288c1',
    textSecondary: '#7f91a4',
    textPrimary: '#ffffff',
    separator: 'rgba(255, 255, 255, 0.06)',
  },
  light: {
    bgSecondary: '#f4f4f5',
    accent: '#3390ec',
    textSecondary: '#707579',
    textPrimary: '#000000',
    separator: '#e4e4e5',
  },
} as const;

const labelMap: Record<string, string> = {
  chats: 'Чаты',
  contacts: 'Контакты',
  stories: 'ИИ',
  announcements: 'Новости',
  profile: 'Профиль',
};

const iconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
  chats: 'chatbubble-ellipses-outline',
  contacts: 'person-outline',
  stories: 'hardware-chip-outline',
  announcements: 'newspaper-outline',
  profile: 'person-circle-outline',
};

const activeIconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
  chats: 'chatbubble-ellipses',
  contacts: 'person',
  stories: 'hardware-chip',
  announcements: 'newspaper',
  profile: 'person-circle',
};

export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { resolvedThemeName } = useTheme();
  const insets = useSafeAreaInsets();
  const isLightTheme = resolvedThemeName.toLowerCase().includes('light');
  const ui = isLightTheme ? TAB_UI.light : TAB_UI.dark;
  const bottomInset = Math.max(insets.bottom, 0);

  return (
    <View pointerEvents="box-none" style={styles.outerWrap}>
      <View
        style={[
          styles.bar,
          {
            height: 64 + bottomInset,
            paddingBottom: bottomInset,
            backgroundColor: ui.bgSecondary,
            borderTopColor: ui.separator,
          },
        ]}
      >
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const options = descriptors[route.key]?.options;
          const fallbackLabel =
            typeof options?.title === 'string' && options.title.length > 0
              ? options.title
              : route.name;
          const label = labelMap[route.name] ?? fallbackLabel;
          const iconName = isFocused
            ? activeIconMap[route.name] ?? 'ellipse'
            : iconMap[route.name] ?? 'ellipse-outline';

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              onLongPress={onLongPress}
              style={({ pressed }) => [styles.item, pressed && { opacity: 0.72 }]}
            >
              <Ionicons
                name={iconName}
                size={24}
                color={isFocused ? ui.accent : ui.textSecondary}
              />
              <Text
                style={[
                  styles.label,
                  {
                    color: isFocused ? ui.accent : ui.textSecondary,
                  },
                ]}
                numberOfLines={1}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
  bar: {
    width: '100%',
    maxWidth: 480,
    minHeight: 64,
    borderTopWidth: 1,
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  item: {
    flex: 1,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 2,
    paddingTop: 8,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
  },
});
