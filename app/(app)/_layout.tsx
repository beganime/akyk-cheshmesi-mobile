import { Stack } from 'expo-router';
import { useTheme } from '@/src/theme/ThemeProvider';

export default function AppLayout() {
  const { theme } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: theme.colors.background,
        },
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="chat/[chatUuid]" />
    </Stack>
  );
}