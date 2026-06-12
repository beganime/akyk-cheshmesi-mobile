import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { GlassCard } from '@/src/components/GlassCard';
import {
  addBotToChat,
  fetchBots,
  fetchChatBots,
  removeBotFromChat,
} from '@/src/lib/api/bots';
import type { BotItem, ChatBotMembership } from '@/src/types/bots';
import { useTheme } from '@/src/theme/ThemeProvider';
import { getApiErrorMessage } from '@/src/utils/apiErrors';

function getMembershipBotUuid(item: ChatBotMembership) {
  return item.bot?.uuid || item.bot_uuid || item.uuid || '';
}

function getMembershipTitle(item: ChatBotMembership) {
  return item.bot?.title || item.title || item.bot?.username || item.username || 'Bot';
}

function getMembershipUsername(item: ChatBotMembership) {
  return item.bot?.username || item.username || '';
}

export default function ChatBotsScreen() {
  const { theme } = useTheme();
  const { chatUuid } = useLocalSearchParams<{ chatUuid: string }>();
  const [memberships, setMemberships] = useState<ChatBotMembership[]>([]);
  const [bots, setBots] = useState<BotItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionKey, setActionKey] = useState<string | null>(null);

  const attachedBotUuids = useMemo(
    () => new Set(memberships.map(getMembershipBotUuid).filter(Boolean)),
    [memberships],
  );

  const availableBots = useMemo(
    () => bots.filter((bot) => !attachedBotUuids.has(bot.uuid)),
    [attachedBotUuids, bots],
  );

  const load = useCallback(async () => {
    if (!chatUuid) return;

    try {
      setLoading(true);
      const [chatBots, myBots] = await Promise.all([
        fetchChatBots(chatUuid),
        fetchBots(),
      ]);
      setMemberships(chatBots);
      setBots(myBots);
    } catch (error) {
      Alert.alert('Боты чата', getApiErrorMessage(error, 'Не удалось загрузить ботов чата'));
    } finally {
      setLoading(false);
    }
  }, [chatUuid]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAdd = async (botUuid: string) => {
    if (!chatUuid || !botUuid) return;

    try {
      setActionKey(botUuid);
      await addBotToChat(chatUuid, botUuid);
      await load();
    } catch (error) {
      Alert.alert('Боты чата', getApiErrorMessage(error, 'Не удалось добавить бота'));
    } finally {
      setActionKey(null);
    }
  };

  const handleRemove = async (botUuid: string) => {
    if (!chatUuid || !botUuid) return;

    try {
      setActionKey(botUuid);
      await removeBotFromChat(chatUuid, botUuid);
      await load();
    } catch (error) {
      Alert.alert('Боты чата', getApiErrorMessage(error, 'Не удалось удалить бота из чата'));
    } finally {
      setActionKey(null);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: theme.colors.text }]}>Боты чата</Text>
          <Text style={[styles.subtitle, { color: theme.colors.muted }]} numberOfLines={1}>
            owner/admin controls через backend permissions
          </Text>
        </View>
        <Pressable onPress={() => router.push('/(app)/bots')} style={styles.headerButton}>
          <Ionicons name="add-circle-outline" size={24} color={theme.colors.primary} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <GlassCard style={styles.card}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Подключены</Text>
            {memberships.length ? (
              memberships.map((membership) => {
                const botUuid = getMembershipBotUuid(membership);
                const busy = actionKey === botUuid;

                return (
                  <View key={botUuid || getMembershipTitle(membership)} style={styles.row}>
                    <View style={[styles.avatar, { backgroundColor: theme.colors.primary }]}>
                      <Ionicons name="sparkles-outline" size={19} color="#FFFFFF" />
                    </View>
                    <View style={styles.rowText}>
                      <Text style={[styles.rowTitle, { color: theme.colors.text }]} numberOfLines={1}>
                        {getMembershipTitle(membership)}
                      </Text>
                      <Text style={[styles.rowSub, { color: theme.colors.muted }]} numberOfLines={1}>
                        @{getMembershipUsername(membership) || botUuid}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => void handleRemove(botUuid)}
                      disabled={busy || !botUuid}
                      style={[styles.iconAction, { backgroundColor: `${theme.colors.danger}18` }]}
                    >
                      {busy ? (
                        <ActivityIndicator size="small" color={theme.colors.danger} />
                      ) : (
                        <Ionicons name="remove" size={20} color={theme.colors.danger} />
                      )}
                    </Pressable>
                  </View>
                );
              })
            ) : (
              <Text style={[styles.emptyText, { color: theme.colors.muted }]}>
                В этом чате пока нет ботов.
              </Text>
            )}
          </GlassCard>

          <GlassCard style={styles.card}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Мои боты</Text>
            {availableBots.length ? (
              availableBots.map((bot) => {
                const busy = actionKey === bot.uuid;

                return (
                  <View key={bot.uuid} style={styles.row}>
                    <View style={[styles.avatar, { backgroundColor: theme.colors.primarySoft }]}>
                      <Ionicons name="sparkles-outline" size={19} color={theme.colors.primary} />
                    </View>
                    <View style={styles.rowText}>
                      <Text style={[styles.rowTitle, { color: theme.colors.text }]} numberOfLines={1}>
                        {bot.title}
                      </Text>
                      <Text style={[styles.rowSub, { color: theme.colors.primary }]} numberOfLines={1}>
                        @{bot.username}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => void handleAdd(bot.uuid)}
                      disabled={busy}
                      style={[styles.iconAction, { backgroundColor: theme.colors.primarySoft }]}
                    >
                      {busy ? (
                        <ActivityIndicator size="small" color={theme.colors.primary} />
                      ) : (
                        <Ionicons name="add" size={20} color={theme.colors.primary} />
                      )}
                    </Pressable>
                  </View>
                );
              })
            ) : (
              <Text style={[styles.emptyText, { color: theme.colors.muted }]}>
                Все доступные боты уже добавлены или список пуст.
              </Text>
            )}
          </GlassCard>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
  },
  subtitle: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '700',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 120,
    gap: 12,
  },
  card: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '900',
  },
  row: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '900',
  },
  rowSub: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '700',
  },
  iconAction: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
