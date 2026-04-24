import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { GlassCard } from '@/src/components/GlassCard';
import { useTheme } from '@/src/theme/ThemeProvider';
import { fetchPresence } from '@/src/lib/api/presence';
import { createDirectChat } from '@/src/lib/api/chats';
import { fetchCalls } from '@/src/lib/api/calls';
import { ensureCallPermissions } from '@/src/lib/calls/permissions';
import { useCallStore } from '@/src/state/call';
import type { CallSession, CallType } from '@/src/types/calls';
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
    return `Был(а) ${date.toLocaleDateString()} в ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }

  return 'Не в сети';
}

function formatCallStatus(call: CallSession) {
  const map: Record<string, string> = {
    requested: 'Создан',
    ringing: 'Идёт вызов',
    accepted: 'Принят',
    rejected: 'Отклонён',
    canceled: 'Отменён',
    missed: 'Пропущен',
    ended: 'Завершён',
    failed: 'Ошибка',
    busy: 'Занято',
  };

  return map[call.status] || call.status;
}

function formatCallDate(value?: string | null) {
  if (!value) return 'Без даты';

  const date = new Date(value);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function formatCallDuration(seconds?: number) {
  const total = Number(seconds || 0);
  const mins = Math.floor(total / 60);
  const secs = total % 60;

  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export default function ChatUserProfileScreen() {
  const { theme } = useTheme();
  const startOutgoing = useCallStore((s) => s.startOutgoing);

  const params = useLocalSearchParams<{
    userUuid: string;
    chatUuid?: string;
    fullName?: string;
    username?: string;
    bio?: string;
  }>();

  const [presence, setPresence] = useState<PresenceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [history, setHistory] = useState<CallSession[]>([]);
  const [directChatUuid, setDirectChatUuid] = useState<string | null>(
    typeof params.chatUuid === 'string' && params.chatUuid ? params.chatUuid : null,
  );
  const [actionLoading, setActionLoading] = useState(false);

  const displayName = useMemo(() => formatDisplayName(params), [params]);
  const username = typeof params.username === 'string' ? params.username : '';
  const bio = typeof params.bio === 'string' ? params.bio : '';

  const loadPresence = useCallback(async () => {
    try {
      if (!params.userUuid) return;
      const data = await fetchPresence(params.userUuid);
      setPresence(data);
    } catch (error) {
      console.error('fetchPresence error:', error);
    } finally {
      setLoading(false);
    }
  }, [params.userUuid]);

  const ensureDirectChat = useCallback(async () => {
    if (directChatUuid) {
      return directChatUuid;
    }

    if (!params.userUuid) {
      throw new Error('Нет userUuid для открытия direct chat');
    }

    const created = await createDirectChat(params.userUuid);
    if (!created?.uuid) {
      throw new Error('Не удалось создать direct chat');
    }

    setDirectChatUuid(created.uuid);
    return created.uuid;
  }, [directChatUuid, params.userUuid]);

  const loadHistory = useCallback(async () => {
    try {
      setHistoryLoading(true);

      const chatUuid = await ensureDirectChat();
      const data = await fetchCalls({
        chatUuid,
        pageSize: 50,
      });

      setHistory(data);
    } catch (error) {
      console.error('loadHistory error:', error);
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [ensureDirectChat]);

  useEffect(() => {
    void loadPresence();
  }, [loadPresence]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useFocusEffect(
    useCallback(() => {
      void loadPresence();
      void loadHistory();
    }, [loadPresence, loadHistory]),
  );

  const handleShare = async () => {
    try {
      await Share.share({
        message: `${displayName}${username ? ` (@${username})` : ''}`,
      });
    } catch (error) {
      console.error('share profile error:', error);
    }
  };

  const openChat = async () => {
    try {
      setActionLoading(true);
      const chatUuid = await ensureDirectChat();

      router.push({
        pathname: '/(app)/chat/[chatUuid]',
        params: { chatUuid },
      });
    } catch (error) {
      console.error('openChat error:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const startCall = async (callType: CallType) => {
    try {
      setActionLoading(true);

      const allowed = await ensureCallPermissions(callType);
      if (!allowed) {
        return;
      }

      const chatUuid = await ensureDirectChat();
      const created = await startOutgoing(chatUuid, callType);

      router.push({
        pathname: '/(app)/call/[callUuid]',
        params: { callUuid: created.uuid },
      });
    } catch (error) {
      console.error('startCall error:', error);
    } finally {
      setActionLoading(false);
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
            pressed && { opacity: 0.7 },
          ]}
        >
          <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
        </Pressable>

        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          Контакт
        </Text>

        <Pressable
          onPress={() => void handleShare()}
          style={({ pressed }) => [
            styles.headerButton,
            { backgroundColor: theme.colors.card },
            pressed && { opacity: 0.7 },
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
                    { backgroundColor: isOnline ? '#10B981' : theme.colors.muted },
                  ]}
                />
                <Text style={[styles.presenceText, { color: theme.colors.text }]}>
                  {formatPresenceText(presence)}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.actionRow}>
            <Pressable
              onPress={() => void openChat()}
              disabled={actionLoading}
              style={[styles.secondaryButton, { backgroundColor: theme.colors.card }]}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={16} color={theme.colors.text} />
              <Text style={[styles.secondaryButtonText, { color: theme.colors.text }]}>
                Чат
              </Text>
            </Pressable>

            <Pressable
              onPress={() => void startCall('audio')}
              disabled={actionLoading}
              style={[styles.primaryButton, { backgroundColor: '#10B981' }]}
            >
              <Ionicons name="call-outline" size={16} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>Аудио</Text>
            </Pressable>

            <Pressable
              onPress={() => void startCall('video')}
              disabled={actionLoading}
              style={[styles.primaryButton, { backgroundColor: '#3B82F6' }]}
            >
              <Ionicons name="videocam-outline" size={16} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>Видео</Text>
            </Pressable>
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

        <GlassCard>
          <View style={styles.sectionHeader}>
            <Ionicons name="time-outline" size={20} color={theme.colors.primary} />
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              История звонков
            </Text>
          </View>

          {historyLoading ? (
            <View style={styles.historyLoading}>
              <ActivityIndicator color={theme.colors.primary} />
            </View>
          ) : history.length === 0 ? (
            <Text style={[styles.emptyHistoryText, { color: theme.colors.muted }]}>
              Пока нет звонков с этим пользователем.
            </Text>
          ) : (
            <View style={styles.historyList}>
              {history.slice(0, 20).map((call) => (
                <View
                  key={call.uuid}
                  style={[
                    styles.historyItem,
                    { backgroundColor: theme.colors.backgroundTertiary },
                  ]}
                >
                  <View style={styles.historyIconWrap}>
                    <Ionicons
                      name={call.call_type === 'video' ? 'videocam' : 'call'}
                      size={18}
                      color={call.call_type === 'video' ? '#3B82F6' : '#10B981'}
                    />
                  </View>

                  <View style={styles.historyInfo}>
                    <Text style={[styles.historyTitle, { color: theme.colors.text }]}>
                      {call.call_type === 'video' ? 'Видео-звонок' : 'Аудио-звонок'}
                    </Text>

                    <Text style={[styles.historyMeta, { color: theme.colors.muted }]}>
                      {formatCallStatus(call)} • {formatCallDate(call.created_at)}
                    </Text>
                  </View>

                  <View style={styles.historyRight}>
                    <Text style={[styles.historyDuration, { color: theme.colors.text }]}>
                      {formatCallDuration(call.duration_seconds)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
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
  actionRow: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  secondaryButton: {
    height: 40,
    borderRadius: 16,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  primaryButton: {
    height: 40,
    borderRadius: 16,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
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
  historyLoading: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyHistoryText: {
    fontSize: 14,
  },
  historyList: {
    gap: 10,
  },
  historyItem: {
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  historyIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  historyInfo: {
    flex: 1,
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  historyMeta: {
    fontSize: 12,
  },
  historyRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  historyDuration: {
    fontSize: 13,
    fontWeight: '700',
  },
});