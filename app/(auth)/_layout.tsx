import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuthStore } from '@/src/state/auth';

export default function AuthLayout() {
  const { hydrated, accessToken } = useAuthStore();

  if (!hydrated) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0B1020',
        }}
      >
        <ActivityIndicator />
      </View>
    );
  }

  if (accessToken) {
    return <Redirect href="/(app)/(tabs)/chats" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}