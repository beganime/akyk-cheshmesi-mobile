import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GlassCard } from '@/src/components/GlassCard';
import { useTheme } from '@/src/theme/ThemeProvider';
import { fetchPresence } from '@/src/lib/api/presence';
import type { PresenceDetail } from '@/src/types/presence';

function formatDisplayName(params: Record<string, string | string[] | undefined>) {
  const fullName = typeof params.fullName === 'string' ? params.fullName : '';
  const username = typeof params.username === 'string' ? params.username : '';
  return fullName || username || 'Пользователь';
}

function formatPresenceText(presence: PresenceDetail | null) {
  if (!presence) return 'Статус неизвестен';
  if (presence.status === 'online') return 'В сети';

  if (presence.last_seen_at) {
    const date = new Date(presence.last_seen_at);
    // Можно улучшить форматирование даты (например, "Сегодня в 14:00")
    return `Был(а) ${date.toLocaleDateString()} в ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }

  return 'Не в сети';
}

export default function ChatUserProfileScreen() {
  const { theme } = useTheme();
  const params = useLocalSearchParams<{
    userUuid: string;
    fullName?: string;
    username?: string;
    bio?: string;
  }>();

  const [presence, setPresence] = useState<PresenceDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const displayName = useMemo(() => formatDisplayName(params), [params]);
  const username = typeof params.username === 'string' ? params.username : '';
  const bio = typeof params.bio === 'string' ? params.bio : '';

  useEffect(() => {
    const run = async () => {
      try {
        if (!params.userUuid) return;
        const data = await fetchPresence(params.userUuid);
        setPresence(data);
      } catch (error) {
        console.error('fetchPresence error:', error);
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [params.userUuid]);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `${displayName}${username ? ` (@${username})` : ''}`,
      });
    } catch (error) {
      console.error('share profile error:', error);
    }
  };

  const isOnline = presence?.status === 'online';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.headerButton,
            { backgroundColor: theme.colors.card },
            pressed && { opacity: 0.7 }
          ]}
        >
          <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
        </Pressable>

        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          Профиль
        </Text>

        <Pressable
          onPress={() => void handleShare()}
          style={({ pressed }) => [
            styles.headerButton,
            { backgroundColor: theme.colors.card },
            pressed && { opacity: 0.7 }
          ]}
        >
          <Ionicons name="share-outline" size={20} color={theme.colors.text} style={{ marginLeft: 2 }} />
        </Pressable>
      </View>

      <View style={styles.content}>
        <GlassCard>
          <View style={styles.topRow}>
            <View style={[styles.avatar, { backgroundColor: theme.colors.primary }]}>
              <Text style={styles.avatarText}>
                {displayName.slice(0, 1).toUpperCase()}
              </Text>
            </View>

            <View style={styles.userInfo}>
              <Text style={[styles.name, { color: theme.colors.text }]} numberOfLines={2}>
                {displayName}
              </Text>

              <Text style={[styles.username, { color: theme.colors.muted }]}>
                {username ? `@${username}` : 'Без username'}
              </Text>
            </View>
          </View>

          <View style={[styles.presenceContainer, { backgroundColor: theme.colors.backgroundTertiary }]}>
            {loading ? (
              <ActivityIndicator color={theme.colors.primary} size="small" />
            ) : (
              <View style={styles.presenceRow}>
                <View 
                  style={[
                    styles.statusDot, 
                    { backgroundColor: isOnline ? theme.colors.success : theme.colors.muted }
                  ]} 
                />
                <Text style={[styles.presenceText, { color: theme.colors.text }]}>
                  {formatPresenceText(presence)}
                </Text>
              </View>
            )}
          </View>
        </GlassCard>

        <GlassCard>
          <View style={styles.sectionHeader}>
            <Ionicons name="information-circle-outline" size={20} color={theme.colors.primary} />
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              О пользователе
            </Text>
          </View>

          <Text style={[styles.aboutText, { color: theme.colors.text }]}>
            {bio || 'Пользователь пока не добавил описание.'}
          </Text>
        </GlassCard>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
  },
  userInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
    lineHeight: 26,
  },
  username: {
    fontSize: 15,
    fontWeight: '500',
  },
  presenceContainer: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'flex-start',
  },
  presenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  presenceText: {
    fontSize: 14,
    fontWeight: '500',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  aboutText: {
    fontSize: 15,
    lineHeight: 22,
    opacity: 0.9,
  },
});