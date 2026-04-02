import { useMemo } from 'react';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/src/theme/ThemeProvider';

const iconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
  chats: 'chatbubbles-outline',
  contacts: 'people-outline',
  ai: 'sparkles-outline',
  announcements: 'newspaper-outline',
  profile: 'person-outline',
};

const activeIconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
  chats: 'chatbubbles',
  contacts: 'people',
  ai: 'sparkles',
  announcements: 'newspaper',
  profile: 'person',
};

export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const bottom = useMemo(() => Math.max(insets.bottom, 10), [insets.bottom]);

  const Container = Platform.OS === 'web' ? View : BlurView;
  const containerProps =
    Platform.OS === 'web'
      ? {}
      : {
          intensity: 44,
          tint: theme.blurTint,
        };

  return (
    <View pointerEvents="box-none" style={[styles.outerWrap, { bottom }]}>
      <Container
        {...containerProps}
        style={[
          styles.bar,
          {
            backgroundColor: theme.colors.tabBar,
            borderColor: theme.colors.borderStrong,
            shadowColor: theme.colors.shadow,
          },
        ]}
      >
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const options = descriptors[route.key]?.options;
          const label =
            typeof options?.title === 'string' && options.title.length > 0
              ? options.title
              : route.name;

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
              style={[
                styles.item,
                isFocused && [
                  styles.itemActive,
                  {
                    backgroundColor: theme.colors.tabItemActive,
                    borderColor: theme.colors.borderStrong,
                  },
                ],
              ]}
            >
              <Ionicons
                name={iconName}
                size={19}
                color={isFocused ? theme.colors.primary : theme.colors.muted}
              />
              <Text
                style={[
                  styles.label,
                  {
                    color: isFocused ? theme.colors.primary : theme.colors.muted,
                  },
                ]}
                numberOfLines={1}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </Container>
    </View>
  );
}

const styles = StyleSheet.create({
  outerWrap: {
    position: 'absolute',
    left: 14,
    right: 14,
  },
  bar: {
    minHeight: 62,
    borderRadius: 26,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
    overflow: 'hidden',
  },
  item: {
    flex: 1,
    minHeight: 46,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  itemActive: {
    transform: [{ scale: 1 }],
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
  },
});