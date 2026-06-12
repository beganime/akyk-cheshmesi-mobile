import { useCallback, useEffect, useState } from 'react';
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
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { GlassCard } from '@/src/components/GlassCard';
import {
  deleteBot,
  fetchBotDetail,
  rotateBotToken,
  sendMessageAsBot,
  updateBot,
} from '@/src/lib/api/bots';
import type { BotItem, BotScope } from '@/src/types/bots';
import { useTheme } from '@/src/theme/ThemeProvider';
import { getApiErrorMessage } from '@/src/utils/apiErrors';

function parseScopes(value: string): BotScope[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function BotDetailScreen() {
  const { theme } = useTheme();
  const { botUuid } = useLocalSearchParams<{ botUuid: string }>();
  const [bot, setBot] = useState<BotItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [scopes, setScopes] = useState('send_message');
  const [visibleToken, setVisibleToken] = useState('');
  const [botToken, setBotToken] = useState('');
  const [testChatUuid, setTestChatUuid] = useState('');
  const [testText, setTestText] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

  const load = useCallback(async () => {
    if (!botUuid) return;

    try {
      setLoading(true);
      const data = await fetchBotDetail(botUuid);
      setBot(data);
      setTitle(data.title || '');
      setDescription(data.description || '');
      setWebhookUrl(data.webhook_url || '');
      setScopes((data.scopes || ['send_message']).join(', '));
    } catch (error) {
      Alert.alert('Bot', getApiErrorMessage(error, 'Не удалось загрузить бота'));
    } finally {
      setLoading(false);
    }
  }, [botUuid]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async () => {
    if (!botUuid || !title.trim()) {
      Alert.alert('Bot', 'Название не может быть пустым.');
      return;
    }

    try {
      setSaving(true);
      const updated = await updateBot(botUuid, {
        title: title.trim(),
        description: description.trim(),
        webhook_url: webhookUrl.trim(),
        scopes: parseScopes(scopes),
      });
      setBot(updated);
      Alert.alert('Bot', 'Настройки сохранены.');
    } catch (error) {
      Alert.alert('Bot', getApiErrorMessage(error, 'Не удалось сохранить бота'));
    } finally {
      setSaving(false);
    }
  };

  const handleRotate = async () => {
    if (!botUuid) return;

    try {
      setRotating(true);
      const updated = await rotateBotToken(botUuid);
      setBot(updated);
      if (updated.token) {
        setVisibleToken(updated.token);
      }
    } catch (error) {
      Alert.alert('Bot token', getApiErrorMessage(error, 'Не удалось обновить token'));
    } finally {
      setRotating(false);
    }
  };

  const handleDelete = () => {
    if (!botUuid) return;

    Alert.alert('Удалить бота?', 'Бот будет удалён из аккаунта и чатов.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: () => {
          void deleteBot(botUuid)
            .then(() => router.back())
            .catch((error) => {
              Alert.alert('Bot', getApiErrorMessage(error, 'Не удалось удалить бота'));
            });
        },
      },
    ]);
  };

  const copyVisibleToken = async () => {
    if (!visibleToken) return;
    await Clipboard.setStringAsync(visibleToken);
    Alert.alert('Bot token', 'Токен скопирован.');
  };

  const handleSendTest = async () => {
    if (!botToken.trim() || !testChatUuid.trim() || !testText.trim()) {
      Alert.alert('Bot message', 'Вставь bot token, chat_uuid и текст.');
      return;
    }

    try {
      setSendingTest(true);
      await sendMessageAsBot(botToken.trim(), {
        chat_uuid: testChatUuid.trim(),
        text: testText.trim(),
      });
      setTestText('');
      Alert.alert('Bot message', 'Сообщение отправлено.');
    } catch (error) {
      Alert.alert('Bot message', getApiErrorMessage(error, 'Не удалось отправить сообщение от бота'));
    } finally {
      setSendingTest(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centered}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: theme.colors.text }]} numberOfLines={1}>
            {bot?.title || 'Bot'}
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.primary }]} numberOfLines={1}>
            @{bot?.username || 'bot'}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <GlassCard style={styles.card}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Настройки</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Название"
            placeholderTextColor={theme.colors.muted}
            style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.borderStrong }]}
          />
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Описание"
            placeholderTextColor={theme.colors.muted}
            style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.borderStrong }]}
          />
          <TextInput
            value={webhookUrl}
            onChangeText={setWebhookUrl}
            placeholder="Webhook URL"
            autoCapitalize="none"
            placeholderTextColor={theme.colors.muted}
            style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.borderStrong }]}
          />
          <TextInput
            value={scopes}
            onChangeText={setScopes}
            placeholder="send_message, read_messages"
            autoCapitalize="none"
            placeholderTextColor={theme.colors.muted}
            style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.borderStrong }]}
          />
          <Pressable
            onPress={() => void handleSave()}
            disabled={saving}
            style={[styles.primaryButton, { backgroundColor: theme.colors.primary }]}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Сохранить</Text>
            )}
          </Pressable>
        </GlassCard>

        <GlassCard style={styles.card}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Token</Text>
          {visibleToken ? (
            <>
              <Text style={[styles.tokenText, { color: theme.colors.text }]} selectable>
                {visibleToken}
              </Text>
              <Pressable
                onPress={() => void copyVisibleToken()}
                style={[styles.secondaryButton, { borderColor: theme.colors.borderStrong }]}
              >
                <Text style={[styles.secondaryButtonText, { color: theme.colors.text }]}>
                  Скопировать token
                </Text>
              </Pressable>
            </>
          ) : (
            <Text style={[styles.helperText, { color: theme.colors.muted }]}>
              Token виден только после создания или rotation.
            </Text>
          )}
          <Pressable
            onPress={() => void handleRotate()}
            disabled={rotating}
            style={[styles.primaryButton, { backgroundColor: theme.colors.primary }]}
          >
            {rotating ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Rotate token</Text>
            )}
          </Pressable>
        </GlassCard>

        <GlassCard style={styles.card}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Send message as bot
          </Text>
          <TextInput
            value={botToken}
            onChangeText={setBotToken}
            placeholder="Bot token"
            autoCapitalize="none"
            secureTextEntry
            placeholderTextColor={theme.colors.muted}
            style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.borderStrong }]}
          />
          <TextInput
            value={testChatUuid}
            onChangeText={setTestChatUuid}
            placeholder="chat_uuid"
            autoCapitalize="none"
            placeholderTextColor={theme.colors.muted}
            style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.borderStrong }]}
          />
          <TextInput
            value={testText}
            onChangeText={setTestText}
            placeholder="Текст сообщения"
            placeholderTextColor={theme.colors.muted}
            style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.borderStrong }]}
          />
          <Pressable
            onPress={() => void handleSendTest()}
            disabled={sendingTest}
            style={[styles.primaryButton, { backgroundColor: theme.colors.primary }]}
          >
            {sendingTest ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Отправить</Text>
            )}
          </Pressable>
        </GlassCard>

        <Pressable
          onPress={handleDelete}
          style={[styles.deleteButton, { borderColor: theme.colors.danger }]}
        >
          <Ionicons name="trash-outline" size={18} color={theme.colors.danger} />
          <Text style={[styles.deleteText, { color: theme.colors.danger }]}>Удалить бота</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    fontWeight: '800',
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 120,
    gap: 12,
  },
  card: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '900',
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
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  secondaryButton: {
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
    lineHeight: 19,
  },
  deleteButton: {
    minHeight: 52,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  deleteText: {
    fontSize: 15,
    fontWeight: '900',
  },
});
