import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuthStore } from '@/src/state/auth';

export default function AppLayout() {
  const { theme } = useTheme();
  const { hydrated, accessToken } = useAuthStore();

  if (!hydrated) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.background,
        }}
      >
        <ActivityIndicator />
      </View>
    );
  }

  if (!accessToken) {
    return <Redirect href="/(auth)/login" />;
  }

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
      <Stack.Screen name="profile-edit" />
      <Stack.Screen name="chat/[chatUuid]" />
      <Stack.Screen name="chat-user/[userUuid]" />
      <Stack.Screen name="call/[callUuid]" />
    </Stack>
  );
}