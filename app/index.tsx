import { Redirect } from 'expo-router';
import { useAuthStore } from '@/src/state/auth';
import { View, ActivityIndicator } from 'react-native';

export default function IndexScreen() {
  const { hydrated, accessToken } = useAuthStore();

  if (!hydrated) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0B1020' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return <Redirect href={accessToken ? '/(app)/chats' : '/(auth)/login'} />;
}
