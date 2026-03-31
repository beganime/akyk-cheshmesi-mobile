import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/theme/ThemeProvider';

const iconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
  chats: 'chatbubbles-outline',
  contacts: 'people-outline',
  announcements: 'megaphone-outline',
  profile: 'person-outline',
};

export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const Container = Platform.OS === 'web' ? View : BlurView;

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrapper,
        {
          bottom: Math.max(insets.bottom, 12),
        },
      ]}
    >
      <Container
        {...(Platform.OS === 'web' ? {} : { intensity: 32, tint: theme.blurTint })}
        style={[
          styles.tabBar,
          {
            backgroundColor: theme.colors.card,
            borderColor: theme.colors.border,
          },
        ]}
      >
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const options = descriptors[route.key].options;
          const label =
            typeof options.title === 'string' ? options.title : route.name;

          return (
            <Pressable
              key={route.key}
              onPress={() => navigation.navigate(route.name)}
              style={[
                styles.item,
                {
                  backgroundColor: isFocused ? theme.colors.primary : 'transparent',
                },
              ]}
            >
              <Ionicons
                name={iconMap[route.name] ?? 'ellipse-outline'}
                size={20}
                color={isFocused ? '#fff' : theme.colors.muted}
              />
              <Text
                style={[
                  styles.label,
                  { color: isFocused ? '#fff' : theme.colors.muted },
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
  wrapper: {
    position: 'absolute',
    left: 14,
    right: 14,
  },
  tabBar: {
    minHeight: 74,
    borderRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  item: {
    flex: 1,
    minHeight: 52,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
  },
});