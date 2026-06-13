import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { GlassCard } from '@/src/components/GlassCard';
import {
  addGroupMembers,
  deleteGroupChat,
  demoteGroupAdmin,
  fetchChatDetail,
  leaveGroupChat,
  promoteGroupAdmin,
  removeGroupMember,
} from '@/src/lib/api/chats';
import { useAuthStore } from '@/src/state/auth';
import type { ChatListItem, ChatMember } from '@/src/types/chat';
import { useTheme } from '@/src/theme/ThemeProvider';
import { getApiErrorMessage } from '@/src/utils/apiErrors';

function getMemberUserUuid(member: ChatMember) {
  return member.user?.uuid || member.uuid || '';
}

function getMemberName(member: ChatMember) {
  const user = member.user;
  return (
    user?.full_name ||
    [user?.first_name, user?.last_name].filter(Boolean).join(' ') ||
    user?.username ||
    user?.email ||
    getMemberUserUuid(member) ||
    'Member'
  );
}

function getRoleLabel(role?: string | null) {
  if (role === 'owner') return 'owner';
  if (role === 'admin') return 'admin';
  return 'member';
}

export default function GroupMembersScreen() {
  const { theme } = useTheme();
  const { chatUuid } = useLocalSearchParams<{ chatUuid: string }>();
  const currentUserUuid = useAuthStore((state) => state.user?.uuid);
  const [chat, setChat] = useState<ChatListItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [newMemberUuid, setNewMemberUuid] = useState('');

  const members = useMemo(() => chat?.members || [], [chat?.members]);
  const myMember = useMemo(
    () => members.find((member) => getMemberUserUuid(member) === currentUserUuid),
    [currentUserUuid, members],
  );
  const myRole = myMember?.role || 'member';
  const canManageMembers = myRole === 'owner' || myRole === 'admin';
  const canManageAdmins = myRole === 'owner';

  const load = useCallback(async () => {
    if (!chatUuid) return;

    try {
      setLoading(true);
      const data = await fetchChatDetail(chatUuid);
      setChat(data);
    } catch (error) {
      Alert.alert('Участники', getApiErrorMessage(error, 'Не удалось загрузить участников'));
    } finally {
      setLoading(false);
    }
  }, [chatUuid]);

  useEffect(() => {
    void load();
  }, [load]);

  const runMemberAction = async (
    key: string,
    action: () => Promise<unknown>,
    fallbackMessage: string,
  ) => {
    try {
      setActionKey(key);
      await action();
      await load();
    } catch (error) {
      Alert.alert('Участники', getApiErrorMessage(error, fallbackMessage));
    } finally {
      setActionKey(null);
    }
  };

  const handleAddMember = async () => {
    const userUuid = newMemberUuid.trim();
    if (!chatUuid || !userUuid) return;

    await runMemberAction(
      `add:${userUuid}`,
      async () => addGroupMembers(chatUuid, [userUuid]),
      'Не удалось добавить участника',
    );
    setNewMemberUuid('');
  };

  const handleLeave = () => {
    if (!chatUuid) return;

    Alert.alert('Выйти из группы?', 'Чат исчезнет из списка после выхода.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Выйти',
        style: 'destructive',
        onPress: () => {
          void leaveGroupChat(chatUuid)
            .then(() => router.replace('/(app)/(tabs)/chats'))
            .catch((error) => {
              Alert.alert('Группа', getApiErrorMessage(error, 'Не удалось выйти из группы'));
            });
        },
      },
    ]);
  };

  const handleDeleteGroup = () => {
    if (!chatUuid) return;

    Alert.alert('Удалить группу?', 'Группа и история будут удалены для участников по правилам backend.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: () => {
          void deleteGroupChat(chatUuid)
            .then(() => router.replace('/(app)/(tabs)/chats'))
            .catch((error) => {
              Alert.alert('Группа', getApiErrorMessage(error, 'Не удалось удалить группу'));
            });
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: theme.colors.text }]} numberOfLines={1}>
            Участники
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.muted }]} numberOfLines={1}>
            {chat?.display_title || chat?.title || 'Group'} · {members.length}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {canManageMembers ? (
            <GlassCard style={styles.card}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                Добавить участника
              </Text>
              <View style={styles.addRow}>
                <TextInput
                  value={newMemberUuid}
                  onChangeText={setNewMemberUuid}
                  placeholder="user_uuid"
                  autoCapitalize="none"
                  placeholderTextColor={theme.colors.muted}
                  style={[
                    styles.input,
                    { color: theme.colors.text, borderColor: theme.colors.borderStrong },
                  ]}
                />
                <Pressable
                  onPress={() => void handleAddMember()}
                  disabled={!newMemberUuid.trim() || Boolean(actionKey)}
                  style={[styles.addButton, { backgroundColor: theme.colors.primary }]}
                >
                  <Ionicons name="add" size={20} color="#FFFFFF" />
                </Pressable>
              </View>
            </GlassCard>
          ) : null}

          <GlassCard style={styles.card}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Роли и доступ
            </Text>
            {members.map((member) => {
              const userUuid = getMemberUserUuid(member);
              const role = getRoleLabel(member.role);
              const isSelf = userUuid === currentUserUuid;
              const busy = actionKey?.endsWith(userUuid);
              const canRemove =
                canManageMembers && !isSelf && role !== 'owner' && Boolean(userUuid);
              const canPromote =
                canManageAdmins && role === 'member' && !isSelf && Boolean(userUuid);
              const canDemote =
                canManageAdmins && role === 'admin' && !isSelf && Boolean(userUuid);

              return (
                <View key={`${member.uuid}:${userUuid}`} style={styles.memberRow}>
                  {member.user?.avatar ? (
                    <ExpoImage
                      source={{ uri: member.user.avatar }}
                      style={styles.avatarImage}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                    />
                  ) : (
                    <View style={[styles.avatar, { backgroundColor: theme.colors.primary }]}>
                      <Text style={styles.avatarText}>
                        {getMemberName(member).slice(0, 1).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.memberText}>
                    <Text style={[styles.memberName, { color: theme.colors.text }]} numberOfLines={1}>
                      {getMemberName(member)}
                    </Text>
                    <Text style={[styles.memberRole, { color: theme.colors.primary }]} numberOfLines={1}>
                      {role}{isSelf ? ' · you' : ''}
                    </Text>
                  </View>
                  {busy ? (
                    <ActivityIndicator color={theme.colors.primary} />
                  ) : (
                    <View style={styles.actions}>
                      {canPromote ? (
                        <Pressable
                          onPress={() =>
                            void runMemberAction(
                              `promote:${userUuid}`,
                              async () => promoteGroupAdmin(chatUuid, userUuid),
                              'Не удалось назначить admin',
                            )
                          }
                          style={[styles.iconAction, { backgroundColor: theme.colors.primarySoft }]}
                        >
                          <Ionicons name="arrow-up" size={18} color={theme.colors.primary} />
                        </Pressable>
                      ) : null}
                      {canDemote ? (
                        <Pressable
                          onPress={() =>
                            void runMemberAction(
                              `demote:${userUuid}`,
                              async () => demoteGroupAdmin(chatUuid, userUuid),
                              'Не удалось снять admin',
                            )
                          }
                          style={[styles.iconAction, { backgroundColor: theme.colors.primarySoft }]}
                        >
                          <Ionicons name="arrow-down" size={18} color={theme.colors.primary} />
                        </Pressable>
                      ) : null}
                      {canRemove ? (
                        <Pressable
                          onPress={() =>
                            void runMemberAction(
                              `remove:${userUuid}`,
                              async () => removeGroupMember(chatUuid, userUuid),
                              'Не удалось удалить участника',
                            )
                          }
                          style={[styles.iconAction, { backgroundColor: `${theme.colors.danger}18` }]}
                        >
                          <Ionicons name="remove" size={18} color={theme.colors.danger} />
                        </Pressable>
                      ) : null}
                    </View>
                  )}
                </View>
              );
            })}
          </GlassCard>

          <Pressable
            onPress={handleLeave}
            style={[styles.outlineButton, { borderColor: theme.colors.danger }]}
          >
            <Ionicons name="exit-outline" size={18} color={theme.colors.danger} />
            <Text style={[styles.outlineButtonText, { color: theme.colors.danger }]}>
              Выйти из группы
            </Text>
          </Pressable>

          {canManageAdmins ? (
            <Pressable
              onPress={handleDeleteGroup}
              style={[styles.outlineButton, { borderColor: theme.colors.danger }]}
            >
              <Ionicons name="trash-outline" size={18} color={theme.colors.danger} />
              <Text style={[styles.outlineButtonText, { color: theme.colors.danger }]}>
                Удалить группу
              </Text>
            </Pressable>
          ) : null}
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
  addRow: {
    flexDirection: 'row',
    gap: 10,
  },
  input: {
    flex: 1,
    minHeight: 50,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  addButton: {
    width: 50,
    height: 50,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberRow: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#E5E7EB',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  memberText: {
    flex: 1,
    minWidth: 0,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '900',
  },
  memberRole: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '800',
  },
  actions: {
    flexDirection: 'row',
    gap: 6,
  },
  iconAction: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineButton: {
    minHeight: 52,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  outlineButtonText: {
    fontSize: 15,
    fontWeight: '900',
  },
});
