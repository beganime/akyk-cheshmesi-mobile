import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/src/theme/ThemeProvider';

const iconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
  chats: 'chatbubbles-outline',
  contacts: 'people-outline',
  stories: 'play-circle-outline',
  announcements: 'newspaper-outline',
  profile: 'person-outline',
};

const activeIconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
  chats: 'chatbubbles',
  contacts: 'people',
  stories: 'play-circle',
  announcements: 'newspaper',
  profile: 'person',
};

export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const bottomInset = Math.max(insets.bottom, 4);

  return (
    <View pointerEvents="box-none" style={styles.outerWrap}>
      <View
        style={[
          styles.bar,
          {
            backgroundColor: theme.colors.tabBar,
            borderColor: theme.colors.borderStrong,
            minHeight: 58 + bottomInset,
            paddingBottom: bottomInset,
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
  },
  bar: {
    minHeight: 62,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 6,
    paddingTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  item: {
    flex: 1,
    minHeight: 46,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  itemActive: {},
  label: {
    fontSize: 11,
    fontWeight: '700',
  },
});
