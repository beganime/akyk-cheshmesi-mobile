import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Image as ExpoImage } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { GlassCard } from '@/src/components/GlassCard';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuthStore } from '@/src/state/auth';
import { updateMe, type UpdateMePayload } from '@/src/lib/api/users';
import type { PickedMediaAsset } from '@/src/lib/api/media';

type FormState = {
  first_name: string;
  last_name: string;
  bio: string;
  date_of_birth: string;
};

function normalizeValue(value?: string | null) {
  return value || '';
}

function toPrettyFieldName(field: string) {
  const map: Record<string, string> = {
    first_name: 'Имя',
    last_name: 'Фамилия',
    bio: 'О себе',
    date_of_birth: 'Дата рождения',
    avatar: 'Аватар',
    phone_number: 'Телефон',
    show_online_status: 'Онлайн-статус',
    detail: 'Ошибка',
  };

  return map[field] || field;
}

function extractErrorMessage(error: any): string {
  const responseData = error?.response?.data;

  if (!responseData) {
    return 'Не удалось сохранить изменения. Попробуй ещё раз.';
  }

  if (typeof responseData.detail === 'string' && responseData.detail.trim()) {
    return responseData.detail.trim();
  }

  if (typeof responseData === 'object') {
    const parts: string[] = [];

    Object.entries(responseData).forEach(([key, value]) => {
      if (Array.isArray(value) && value.length > 0) {
        parts.push(`${toPrettyFieldName(key)}: ${value.join(', ')}`);
        return;
      }

      if (typeof value === 'string' && value.trim()) {
        parts.push(`${toPrettyFieldName(key)}: ${value.trim()}`);
      }
    });

    if (parts.length > 0) {
      return parts.join('\n');
    }
  }

  return 'Не удалось сохранить изменения. Попробуй ещё раз.';
}

export default function ProfileEditScreen() {
  const { theme } = useTheme();
  const user = useAuthStore((s) => s.user);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);

  const initial = useMemo<FormState>(
    () => ({
      first_name: normalizeValue(user?.first_name),
      last_name: normalizeValue(user?.last_name),
      bio: normalizeValue(user?.bio),
      date_of_birth: normalizeValue(user?.date_of_birth),
    }),
    [user]
  );

  const [form, setForm] = useState<FormState>(initial);
  const [selectedAvatar, setSelectedAvatar] = useState<PickedMediaAsset | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState('');

  const avatarPreviewUri = selectedAvatar?.uri || user?.avatar || '';

  const setField = (key: keyof FormState, value: string) => {
    setErrorText('');
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const buildPayload = (): UpdateMePayload => {
    const payload: UpdateMePayload = {};

    const firstName = form.first_name.trim();
    const lastName = form.last_name.trim();
    const bio = form.bio.trim();
    const dateOfBirth = form.date_of_birth.trim();

    if (firstName !== initial.first_name) {
      payload.first_name = firstName;
    }

    if (lastName !== initial.last_name) {
      payload.last_name = lastName;
    }

    if (bio !== initial.bio) {
      payload.bio = bio;
    }

    if (dateOfBirth !== initial.date_of_birth) {
      payload.date_of_birth = dateOfBirth ? dateOfBirth : null;
    }

    if (selectedAvatar) {
      payload.avatarAsset = selectedAvatar;
    }

    return payload;
  };

  const handlePickAvatar = async () => {
    try {
      setErrorText('');

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.9,
        allowsEditing: true,
        aspect: [1, 1],
      });

      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      setSelectedAvatar(result.assets[0] as PickedMediaAsset);
    } catch (error) {
      console.error('handlePickAvatar error:', error);
      setErrorText('Не удалось выбрать изображение.');
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setErrorText('');

      const payload = buildPayload();

      if (Object.keys(payload).length === 0) {
        router.back();
        return;
      }

      await updateMe(payload);
      await refreshProfile();
      router.back();
    } catch (error) {
      console.error('handleSave profile error:', error);
      setErrorText(extractErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={[
            styles.headerButton,
            {
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.inputBackground,
            },
          ]}
        >
          <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
        </Pressable>

        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          Редактировать профиль
        </Text>

        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <GlassCard>
          <View style={styles.heroBlock}>
            <Pressable
              onPress={() => void handlePickAvatar()}
              style={[
                styles.avatarButton,
                {
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.inputBackground,
                },
              ]}
            >
              {avatarPreviewUri ? (
                <ExpoImage
                  source={{ uri: avatarPreviewUri }}
                  style={styles.avatarImage}
                  contentFit="cover"
                />
              ) : (
                <View
                  style={[
                    styles.avatarPlaceholder,
                    { backgroundColor: theme.colors.inputBackground },
                  ]}
                >
                  <Ionicons
                    name="person"
                    size={34}
                    color={theme.colors.muted}
                  />
                </View>
              )}

              <View
                style={[
                  styles.cameraBadge,
                  {
                    backgroundColor: theme.colors.primary,
                    borderColor: theme.colors.background,
                  },
                ]}
              >
                <Ionicons name="camera" size={14} color="#FFFFFF" />
              </View>
            </Pressable>

            <View style={styles.heroTextBlock}>
              <Text style={[styles.heroTitle, { color: theme.colors.text }]}>
                {user?.first_name || user?.last_name
                  ? `${user?.first_name || ''} ${user?.last_name || ''}`.trim()
                  : user?.username || 'Профиль'}
              </Text>

              <Text style={[styles.heroSubtitle, { color: theme.colors.muted }]}>
                Нажми на аватар, чтобы выбрать новое фото
              </Text>

              {!!user?.email && (
                <Text style={[styles.heroMeta, { color: theme.colors.muted }]}>
                  {user.email}
                </Text>
              )}
            </View>
          </View>
        </GlassCard>

        <GlassCard>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Основная информация
          </Text>

          <View
            style={[
              styles.staticField,
              {
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.inputBackground,
              },
            ]}
          >
            <Text style={[styles.staticLabel, { color: theme.colors.muted }]}>
              Username
            </Text>
            <Text style={[styles.staticValue, { color: theme.colors.text }]}>
              {user?.username || '—'}
            </Text>
          </View>

          <TextInput
            value={form.first_name}
            onChangeText={(value) => setField('first_name', value)}
            placeholder="Имя"
            placeholderTextColor={theme.colors.muted}
            style={[
              styles.input,
              {
                color: theme.colors.text,
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.inputBackground,
              },
            ]}
          />

          <TextInput
            value={form.last_name}
            onChangeText={(value) => setField('last_name', value)}
            placeholder="Фамилия"
            placeholderTextColor={theme.colors.muted}
            style={[
              styles.input,
              {
                color: theme.colors.text,
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.inputBackground,
              },
            ]}
          />

          <TextInput
            value={form.date_of_birth}
            onChangeText={(value) => setField('date_of_birth', value)}
            placeholder="Дата рождения (YYYY-MM-DD)"
            placeholderTextColor={theme.colors.muted}
            autoCapitalize="none"
            style={[
              styles.input,
              {
                color: theme.colors.text,
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.inputBackground,
              },
            ]}
          />

          <Text style={[styles.hintText, { color: theme.colors.muted }]}>
            Оставь пустым, если не хочешь менять
          </Text>
        </GlassCard>

        <GlassCard>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            О себе
          </Text>

          <TextInput
            value={form.bio}
            onChangeText={(value) => setField('bio', value)}
            placeholder="Напиши пару слов о себе"
            placeholderTextColor={theme.colors.muted}
            multiline
            maxLength={160}
            style={[
              styles.bioInput,
              {
                color: theme.colors.text,
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.inputBackground,
              },
            ]}
          />

          <Text style={[styles.hintText, { color: theme.colors.muted }]}>
            До 160 символов
          </Text>
        </GlassCard>

        {!!errorText && (
          <View
            style={[
              styles.errorBox,
              {
                borderColor: 'rgba(255, 59, 48, 0.28)',
                backgroundColor: 'rgba(255, 59, 48, 0.08)',
              },
            ]}
          >
            <Text style={styles.errorText}>{errorText}</Text>
          </View>
        )}

        <Pressable
          onPress={() => void handleSave()}
          disabled={saving}
          style={[
            styles.saveButton,
            {
              backgroundColor: theme.colors.primary,
              opacity: saving ? 0.7 : 1,
            },
          ]}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
              <Text style={styles.saveButtonText}>Сохранить изменения</Text>
            </>
          )}
        </Pressable>
      </ScrollView>
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
  scrollContent: {
    padding: 16,
    paddingBottom: 120,
    gap: 12,
  },
  heroBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarButton: {
    width: 112,
    height: 112,
    borderRadius: 28,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  heroTextBlock: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 13,
    marginBottom: 8,
    lineHeight: 18,
  },
  heroMeta: {
    fontSize: 13,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 10,
  },
  staticField: {
    minHeight: 56,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
    justifyContent: 'center',
  },
  staticLabel: {
    fontSize: 12,
    marginBottom: 3,
  },
  staticValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  bioInput: {
    minHeight: 120,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlignVertical: 'top',
  },
  hintText: {
    fontSize: 12,
    marginTop: 2,
  },
  errorBox: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  errorText: {
    color: '#FF453A',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  saveButton: {
    minHeight: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    flexDirection: 'row',
    gap: 8,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});