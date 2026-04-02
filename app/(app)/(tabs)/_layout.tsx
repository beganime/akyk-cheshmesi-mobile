import { Tabs } from 'expo-router';

import { FloatingTabBar } from '@/src/components/FloatingTabBar';
import { useTheme } from '@/src/theme/ThemeProvider';

export default function TabsLayout() {
  const { theme } = useTheme();

  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: {
          backgroundColor: theme.colors.background,
        },
      }}
    >
      <Tabs.Screen name="chats" options={{ title: 'Чаты' }} />
      <Tabs.Screen name="contacts" options={{ title: 'Контакты' }} />
      <Tabs.Screen name="ai" options={{ title: 'ИИ' }} />
      <Tabs.Screen name="announcements" options={{ title: 'Новости' }} />
      <Tabs.Screen name="profile" options={{ title: 'Профиль' }} />
    </Tabs>
  );
}