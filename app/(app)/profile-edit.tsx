import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
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
import { updateMe } from '@/src/lib/api/users';
import { uploadPickedImage } from '@/src/lib/api/media';

export default function ProfileEditScreen() {
  const { theme } = useTheme();
  const user = useAuthStore((s) => s.user);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);

  const initial = useMemo(
    () => ({
      username: user?.username || '',
      first_name: user?.first_name || '',
      last_name: user?.last_name || '',
      bio: user?.bio || '',
      date_of_birth: user?.date_of_birth || '',
    }),
    [user]
  );

  const [form, setForm] = useState(initial);
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar || '');
  const [saving, setSaving] = useState(false);

  const setField = (key: keyof typeof form, value: string) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      await updateMe({
        username: form.username.trim() || null,
        first_name: form.first_name.trim() || null,
        last_name: form.last_name.trim() || null,
        bio: form.bio.trim() || null,
        date_of_birth: form.date_of_birth.trim() || null,
        avatar: avatarUrl.trim() || null,
      });

      await refreshProfile();
      router.back();
    } catch (error) {
      console.error('handleSave profile error:', error);
    } finally {
      setSaving(false);
    }
  };

  const handlePickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets?.[0]) return;
    const uploaded = await uploadPickedImage(result.assets[0]);
    if (uploaded.file_url) {
      setAvatarUrl(uploaded.file_url);
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
          Редактировать профиль
        </Text>

        <View style={{ width: 44 }} />
      </View>

      <View style={styles.content}>
        <GlassCard>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Основное</Text>

          <Pressable
            onPress={() => void handlePickAvatar()}
            style={[styles.avatarPicker, { borderColor: theme.colors.border, backgroundColor: theme.colors.inputBackground }]}
          >
            {avatarUrl ? (
              <ExpoImage source={{ uri: avatarUrl }} style={styles.avatarPreview} contentFit="cover" />
            ) : (
              <Text style={{ color: theme.colors.muted }}>Выбрать аватар</Text>
            )}
          </Pressable>

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
            value={form.username}
            onChangeText={(value) => setField('username', value)}
            placeholder="Username"
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

          <TextInput
            value={form.date_of_birth}
            onChangeText={(value) => setField('date_of_birth', value)}
            placeholder="Дата рождения (YYYY-MM-DD)"
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
        </GlassCard>

        <GlassCard>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>О себе</Text>

          <TextInput
            value={form.bio}
            onChangeText={(value) => setField('bio', value)}
            placeholder="Напиши пару слов о себе"
            placeholderTextColor={theme.colors.muted}
            multiline
            style={[
              styles.bioInput,
              {
                color: theme.colors.text,
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.inputBackground,
              },
            ]}
          />
        </GlassCard>

        <Pressable
          onPress={() => void handleSave()}
          disabled={saving}
          style={[styles.saveButton, { backgroundColor: theme.colors.primary }]}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>Сохранить</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 10,
  },
  avatarPicker: {
    height: 90,
    borderWidth: 1,
    borderRadius: 18,
    marginBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarPreview: {
    width: '100%',
    height: '100%',
  },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  bioInput: {
    minHeight: 110,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlignVertical: 'top',
  },
  saveButton: {
    minHeight: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
