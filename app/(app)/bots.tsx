import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { GlassCard } from '@/src/components/GlassCard';
import { createBot, fetchBots } from '@/src/lib/api/bots';
import type { BotItem, BotScope } from '@/src/types/bots';
import { useTheme } from '@/src/theme/ThemeProvider';
import { getApiErrorMessage } from '@/src/utils/apiErrors';

const DEFAULT_SCOPE: BotScope = 'send_message';

export default function BotsScreen() {
  const { theme } = useTheme();
  const [bots, setBots] = useState<BotItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [createVisible, setCreateVisible] = useState(false);
  const [tokenVisible, setTokenVisible] = useState(false);
  const [createdToken, setCreatedToken] = useState('');
  const [username, setUsername] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const normalizedUsername = useMemo(
    () => username.trim().replace(/^@+/, '').toLowerCase(),
    [username],
  );

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      const data = await fetchBots();
      setBots(data);
    } catch (error) {
      Alert.alert('Bots', getApiErrorMessage(error, 'Не удалось загрузить ботов'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const resetForm = () => {
    setUsername('');
    setTitle('');
    setDescription('');
    setWebhookUrl('');
  };

  const handleCreate = async () => {
    if (!normalizedUsername || !title.trim()) {
      Alert.alert('Bot', 'Укажи username и название бота.');
      return;
    }

    try {
      setSaving(true);
      const created = await createBot({
        username: normalizedUsername,
        title: title.trim(),
        description: description.trim(),
        webhook_url: webhookUrl.trim(),
        scopes: [DEFAULT_SCOPE],
      });

      setBots((current) => [created, ...current.filter((item) => item.uuid !== created.uuid)]);
      setCreateVisible(false);
      resetForm();

      if (created.token) {
        setCreatedToken(created.token);
        setTokenVisible(true);
      }
    } catch (error) {
      Alert.alert('Bot', getApiErrorMessage(error, 'Не удалось создать бота'));
    } finally {
      setSaving(false);
    }
  };

  const copyToken = async () => {
    if (!createdToken) return;
    await Clipboard.setStringAsync(createdToken);
    Alert.alert('Bot token', 'Токен скопирован.');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: theme.colors.text }]}>Боты</Text>
          <Text style={[styles.subtitle, { color: theme.colors.muted }]}>
            Telegram-like bot management
          </Text>
        </View>
        <Pressable
          onPress={() => setCreateVisible(true)}
          style={[styles.createButton, { backgroundColor: theme.colors.primary }]}
        >
          <Ionicons name="add" size={22} color="#FFFFFF" />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            onPress={() => void load()}
            disabled={refreshing}
            style={[styles.refreshButton, { borderColor: theme.colors.borderStrong }]}
          >
            <Ionicons name="refresh" size={18} color={theme.colors.primary} />
            <Text style={[styles.refreshText, { color: theme.colors.text }]}>
              {refreshing ? 'Обновление...' : 'Обновить список'}
            </Text>
          </Pressable>

          {bots.length ? (
            bots.map((bot) => (
              <Pressable
                key={bot.uuid}
                onPress={() =>
                  router.push({
                    pathname: '/(app)/bot/[botUuid]',
                    params: { botUuid: bot.uuid },
                  })
                }
              >
                <GlassCard style={styles.botCard}>
                  <View style={[styles.botAvatar, { backgroundColor: theme.colors.primary }]}>
                    <Ionicons name="sparkles-outline" size={22} color="#FFFFFF" />
                  </View>
                  <View style={styles.botText}>
                    <Text style={[styles.botTitle, { color: theme.colors.text }]} numberOfLines={1}>
                      {bot.title || bot.username}
                    </Text>
                    <Text style={[styles.botUsername, { color: theme.colors.primary }]} numberOfLines={1}>
                      @{bot.username}
                    </Text>
                    {bot.description ? (
                      <Text style={[styles.botDescription, { color: theme.colors.muted }]} numberOfLines={2}>
                        {bot.description}
                      </Text>
                    ) : null}
                  </View>
                  <Ionicons name="chevron-forward" size={19} color={theme.colors.muted} />
                </GlassCard>
              </Pressable>
            ))
          ) : (
            <GlassCard style={styles.emptyCard}>
              <Ionicons name="sparkles-outline" size={34} color={theme.colors.primary} />
              <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>Ботов пока нет</Text>
              <Text style={[styles.emptyText, { color: theme.colors.muted }]}>
                Создай helper_bot, подключи webhook и добавь его в нужный чат.
              </Text>
            </GlassCard>
          )}
        </ScrollView>
      )}

      <Modal
        visible={createVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCreateVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setCreateVisible(false)} />
          <GlassCard style={styles.sheet}>
            <Text style={[styles.sheetTitle, { color: theme.colors.text }]}>Новый бот</Text>
            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder="helper_bot"
              autoCapitalize="none"
              placeholderTextColor={theme.colors.muted}
              style={[
                styles.input,
                { color: theme.colors.text, borderColor: theme.colors.borderStrong },
              ]}
            />
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Helper Bot"
              placeholderTextColor={theme.colors.muted}
              style={[
                styles.input,
                { color: theme.colors.text, borderColor: theme.colors.borderStrong },
              ]}
            />
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Описание"
              placeholderTextColor={theme.colors.muted}
              style={[
                styles.input,
                { color: theme.colors.text, borderColor: theme.colors.borderStrong },
              ]}
            />
            <TextInput
              value={webhookUrl}
              onChangeText={setWebhookUrl}
              placeholder="https://example.com/webhook"
              autoCapitalize="none"
              placeholderTextColor={theme.colors.muted}
              style={[
                styles.input,
                { color: theme.colors.text, borderColor: theme.colors.borderStrong },
              ]}
            />
            <Pressable
              onPress={() => void handleCreate()}
              disabled={saving}
              style={[styles.primaryButton, { backgroundColor: theme.colors.primary }]}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Создать</Text>
              )}
            </Pressable>
          </GlassCard>
        </View>
      </Modal>

      <Modal
        visible={tokenVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setTokenVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <GlassCard style={styles.sheet}>
            <Text style={[styles.sheetTitle, { color: theme.colors.text }]}>Bot token</Text>
            <Text style={[styles.tokenText, { color: theme.colors.text }]} selectable>
              {createdToken}
            </Text>
            <Text style={[styles.helperText, { color: theme.colors.muted }]}>
              Backend показывает токен только один раз. Скопируй его сейчас.
            </Text>
            <View style={styles.buttonRow}>
              <Pressable
                onPress={() => void copyToken()}
                style={[styles.secondaryButton, { borderColor: theme.colors.borderStrong }]}
              >
                <Text style={[styles.secondaryButtonText, { color: theme.colors.text }]}>
                  Скопировать
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setTokenVisible(false)}
                style={[styles.primaryButtonSmall, { backgroundColor: theme.colors.primary }]}
              >
                <Text style={styles.primaryButtonText}>Готово</Text>
              </Pressable>
            </View>
          </GlassCard>
        </View>
      </Modal>
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
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
  },
  subtitle: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '700',
  },
  createButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
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
  refreshButton: {
    minHeight: 44,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  refreshText: {
    fontSize: 14,
    fontWeight: '800',
  },
  botCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  botAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botText: {
    flex: 1,
    minWidth: 0,
  },
  botTitle: {
    fontSize: 17,
    fontWeight: '900',
  },
  botUsername: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '800',
  },
  botDescription: {
    marginTop: 5,
    fontSize: 13,
    lineHeight: 18,
  },
  emptyCard: {
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 14,
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  sheet: {
    gap: 10,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 4,
  },
  input: {
    minHeight: 50,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonSmall: {
    flex: 1,
    minHeight: 48,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '800',
  },
  tokenText: {
    borderRadius: 16,
    padding: 12,
    backgroundColor: 'rgba(127,127,127,0.12)',
    fontSize: 13,
    fontWeight: '700',
  },
  helperText: {
    fontSize: 13,
    lineHeight: 18,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
});
