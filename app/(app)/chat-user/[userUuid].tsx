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

function formatPresence(presence: PresenceDetail | null) {
  if (!presence) return 'Статус неизвестен';
  if (presence.status === 'online') return 'В сети';

  if (presence.last_seen_at) {
    const date = new Date(presence.last_seen_at);
    return `Был(а) в сети ${date.toLocaleString()}`;
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={[styles.headerButton, { borderColor: theme.colors.border }]}
        >
          <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
        </Pressable>

        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          Профиль
        </Text>

        <Pressable
          onPress={() => void handleShare()}
          style={[styles.headerButton, { borderColor: theme.colors.border }]}
        >
          <Ionicons name="share-outline" size={18} color={theme.colors.text} />
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

            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: theme.colors.text }]}>
                {displayName}
              </Text>

              <Text style={[styles.username, { color: theme.colors.muted }]}>
                {username ? `@${username}` : 'Без username'}
              </Text>
            </View>
          </View>

          {loading ? (
            <View style={styles.loaderWrap}>
              <ActivityIndicator color={theme.colors.primary} />
            </View>
          ) : (
            <Text style={[styles.presence, { color: theme.colors.muted }]}>
              {formatPresence(presence)}
            </Text>
          )}
        </GlassCard>

        <GlassCard>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            О пользователе
          </Text>

          <Text style={[styles.aboutText, { color: theme.colors.muted }]}>
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
    paddingTop: 8,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    padding: 16,
    paddingBottom: 120,
    gap: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 10,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '700',
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  username: {
    fontSize: 14,
  },
  loaderWrap: {
    marginTop: 8,
    alignItems: 'flex-start',
  },
  presence: {
    fontSize: 14,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 8,
  },
  aboutText: {
    fontSize: 15,
    lineHeight: 22,
  },
});