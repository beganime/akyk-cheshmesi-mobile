import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { fetchStories } from '@/src/lib/api/stories';
import { resolveMediaUrl } from '@/src/lib/media/url';
import { useAuthStore } from '@/src/state/auth';
import { useTheme } from '@/src/theme/ThemeProvider';
import type { StoryItem } from '@/src/types/stories';

function getStoryPreview(story: StoryItem) {
  return story.media?.thumbnail_url || story.media?.file_url || story.file_url || null;
}

function getStoryAuthorUuid(story: StoryItem) {
  return story.author?.uuid || story.user?.uuid || null;
}

export default function ProfileScreen() {
  const { theme } = useTheme();
  const { user, logout, refreshProfile } = useAuthStore();
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [storiesLoading, setStoriesLoading] = useState(true);
  const [notificationGranted, setNotificationGranted] = useState<boolean | null>(null);

  const name =
    [user?.first_name, user?.last_name].filter(Boolean).join(' ') ||
    user?.username ||
    'Пользователь';
  const username = user?.username ? `@${user.username}` : 'Username не указан';
  const email = user?.email || 'Email не указан';
  const phone = user?.phone_number || 'Телефон не указан';
  const avatarUrl = avatarFailed ? null : resolveMediaUrl(user?.avatar);

  const ownStories = useMemo(
    () =>
      stories.filter(
        (story) => story.is_own || getStoryAuthorUuid(story) === user?.uuid,
      ),
    [stories, user?.uuid],
  );

  useEffect(() => {
    setAvatarFailed(false);
  }, [user?.avatar]);

  const loadProfileContent = useCallback(async () => {
    setStoriesLoading(true);
    try {
      const [storyItems] = await Promise.all([
        fetchStories().catch(() => []),
        refreshProfile().catch(() => undefined),
      ]);
      setStories(storyItems);

      if (Platform.OS !== 'web') {
        const permissions = await Notifications.getPermissionsAsync().catch(() => null);
        setNotificationGranted(permissions?.granted ?? false);
      }
    } finally {
      setStoriesLoading(false);
    }
  }, [refreshProfile]);

  useFocusEffect(
    useCallback(() => {
      void loadProfileContent();
    }, [loadProfileContent]),
  );

  const onLogout = () => {
    Alert.alert('Выйти из аккаунта?', 'На этом устройстве потребуется повторный вход.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Выйти',
        style: 'destructive',
        onPress: () => {
          void logout().then(() => router.replace('/(auth)/login'));
        },
      },
    ]);
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['top', 'left', 'right']}
    >
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Профиль</Text>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() =>
              router.push({
                pathname: '/(app)/settings/[section]',
                params: { section: 'notifications' },
              })
            }
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
            accessibilityLabel="Настройки уведомлений"
          >
            <Ionicons name="notifications-outline" size={23} color={theme.colors.text} />
            {notificationGranted === false ? (
              <View style={[styles.notificationDot, { backgroundColor: theme.colors.danger }]} />
            ) : null}
          </Pressable>
          <Pressable
            onPress={() => router.push('/(app)/settings')}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
            accessibilityLabel="Настройки"
          >
            <Ionicons name="settings-outline" size={23} color={theme.colors.text} />
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={theme.colors.heroGradient}
          style={[styles.hero, { borderBottomColor: theme.colors.border }]}
        >
          <Pressable
            onPress={() => router.push('/(app)/profile-edit')}
            style={({ pressed }) => [styles.avatarButton, pressed && styles.pressed]}
            accessibilityLabel="Изменить аватар"
          >
            {avatarUrl ? (
              <ExpoImage
                source={{ uri: avatarUrl }}
                style={styles.avatarImage}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={180}
                onError={() => setAvatarFailed(true)}
              />
            ) : (
              <View style={[styles.avatar, { backgroundColor: theme.colors.primary }]}>
                <Text style={[styles.avatarText, { color: theme.colors.fabText }]}>
                  {name.slice(0, 1).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={[styles.cameraBadge, { backgroundColor: theme.colors.primary, borderColor: theme.colors.background }]}>
              <Ionicons name="camera" size={15} color={theme.colors.fabText} />
            </View>
          </Pressable>

          <Text style={[styles.name, { color: theme.colors.text }]} numberOfLines={2}>
            {name}
          </Text>
          <Text style={[styles.status, { color: theme.colors.success }]}>В сети</Text>
          <Pressable
            onPress={() => router.push('/(app)/profile-edit')}
            style={[styles.editButton, { borderColor: theme.colors.borderStrong, backgroundColor: theme.colors.backgroundSecondary }]}
          >
            <Ionicons name="create-outline" size={17} color={theme.colors.primary} />
            <Text style={[styles.editButtonText, { color: theme.colors.primary }]}>Редактировать профиль</Text>
          </Pressable>
        </LinearGradient>

        <SectionTitle title="Аккаунт" />
        <View style={[styles.group, { borderColor: theme.colors.border }]}>
          <InfoRow icon="person-outline" label={username} />
          <InfoRow icon="call-outline" label={phone} />
          <InfoRow icon="mail-outline" label={email} last />
        </View>

        <View style={styles.storyHeader}>
          <View>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Мои истории</Text>
            <Text style={[styles.sectionSubtitle, { color: theme.colors.muted }]}>Активны в течение 24 часов</Text>
          </View>
          <Pressable
            onPress={() => router.push('/(app)/(tabs)/stories')}
            style={[styles.addStoryButton, { backgroundColor: theme.colors.primarySoft }]}
          >
            <Ionicons name="add" size={20} color={theme.colors.primary} />
            <Text style={[styles.addStoryText, { color: theme.colors.primary }]}>Добавить</Text>
          </Pressable>
        </View>

        {storiesLoading ? (
          <ActivityIndicator style={styles.storyLoader} color={theme.colors.primary} />
        ) : ownStories.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.storyRow}
          >
            {ownStories.map((story) => {
              const preview = getStoryPreview(story);
              return (
                <Pressable
                  key={story.uuid}
                  onPress={() =>
                    router.push({
                      pathname: '/(app)/story-viewer',
                      params: { storyUuid: story.uuid },
                    })
                  }
                  style={({ pressed }) => [styles.storyItem, pressed && styles.pressed]}
                >
                  <View style={[styles.storyRing, { borderColor: theme.colors.primary }]}>
                    {preview ? (
                      <ExpoImage
                        source={{ uri: preview }}
                        style={styles.storyImage}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                      />
                    ) : (
                      <View style={[styles.storyImage, styles.textStory, { backgroundColor: story.background || theme.colors.primary }]}>
                        <Text style={styles.textStoryCaption} numberOfLines={3}>{story.caption}</Text>
                      </View>
                    )}
                    {story.media_type === 'video' ? (
                      <View style={styles.videoBadge}>
                        <Ionicons name="play" size={12} color="#FFFFFF" />
                      </View>
                    ) : null}
                  </View>
                  <Text style={[styles.storyLabel, { color: theme.colors.muted }]}>
                    {typeof story.viewers_count === 'number'
                      ? `${story.viewers_count} просмотров`
                      : 'Открыть'}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : (
          <Pressable
            onPress={() => router.push('/(app)/(tabs)/stories')}
            style={[styles.emptyStories, { borderColor: theme.colors.border }]}
          >
            <View style={[styles.emptyStoryIcon, { backgroundColor: theme.colors.primarySoft }]}>
              <Ionicons name="add" size={24} color={theme.colors.primary} />
            </View>
            <View style={styles.emptyStoryText}>
              <Text style={[styles.emptyStoryTitle, { color: theme.colors.text }]}>Опубликовать историю</Text>
              <Text style={[styles.emptyStorySubtitle, { color: theme.colors.muted }]}>Фото, видео или текст</Text>
            </View>
            <Ionicons name="chevron-forward" size={19} color={theme.colors.muted} />
          </Pressable>
        )}

        <SectionTitle title="Приложение" />
        <View style={[styles.group, { borderColor: theme.colors.border }]}>
          <MenuRow icon="settings-outline" title="Настройки" onPress={() => router.push('/(app)/settings')} />
          <MenuRow icon="information-circle-outline" title="О приложении" onPress={() => router.push('/(app)/about')} last />
        </View>

        <Pressable
          onPress={onLogout}
          style={({ pressed }) => [
            styles.logoutRow,
            {
              borderColor: theme.colors.border,
              backgroundColor: pressed ? theme.colors.backgroundSecondary : 'transparent',
            },
          ]}
        >
          <Ionicons name="log-out-outline" size={21} color={theme.colors.danger} />
          <Text style={[styles.logoutText, { color: theme.colors.danger }]}>Выйти</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );

  function SectionTitle({ title }: { title: string }) {
    return <Text style={[styles.sectionTitle, styles.sectionTitleSpacing, { color: theme.colors.text }]}>{title}</Text>;
  }

  function InfoRow({ icon, label, last = false }: { icon: keyof typeof Ionicons.glyphMap; label: string; last?: boolean }) {
    return (
      <View style={[styles.infoRow, !last && { borderBottomColor: theme.colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
        <Ionicons name={icon} size={20} color={theme.colors.muted} />
        <Text style={[styles.infoText, { color: theme.colors.text }]} numberOfLines={1}>{label}</Text>
      </View>
    );
  }

  function MenuRow({ icon, title, onPress, last = false }: { icon: keyof typeof Ionicons.glyphMap; title: string; onPress: () => void; last?: boolean }) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.menuRow,
          !last && { borderBottomColor: theme.colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
          pressed && { backgroundColor: theme.colors.backgroundSecondary },
        ]}
      >
        <Ionicons name={icon} size={21} color={theme.colors.primary} />
        <Text style={[styles.menuText, { color: theme.colors.text }]}>{title}</Text>
        <Ionicons name="chevron-forward" size={19} color={theme.colors.muted} />
      </Pressable>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { minHeight: 58, paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 22, fontWeight: '700' },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  iconButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  notificationDot: { position: 'absolute', top: 7, right: 7, width: 8, height: 8, borderRadius: 4 },
  pressed: { opacity: 0.68 },
  content: { paddingBottom: 112 },
  hero: { paddingHorizontal: 20, paddingVertical: 26, borderBottomWidth: StyleSheet.hairlineWidth, alignItems: 'center' },
  avatarButton: { width: 96, height: 96 },
  avatar: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#E5E7EB' },
  avatarText: { fontSize: 36, fontWeight: '800' },
  cameraBadge: { position: 'absolute', right: 0, bottom: 1, width: 30, height: 30, borderRadius: 15, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  name: { maxWidth: 340, marginTop: 14, fontSize: 25, fontWeight: '700', textAlign: 'center' },
  status: { marginTop: 4, fontSize: 13, fontWeight: '700' },
  editButton: { minHeight: 40, marginTop: 16, paddingHorizontal: 14, borderWidth: 1, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 7 },
  editButtonText: { fontSize: 14, fontWeight: '700' },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  sectionTitleSpacing: { marginTop: 22, marginBottom: 9, paddingHorizontal: 18 },
  sectionSubtitle: { marginTop: 2, fontSize: 12 },
  group: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  infoRow: { minHeight: 52, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoText: { flex: 1, fontSize: 15, fontWeight: '600' },
  storyHeader: { marginTop: 22, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  addStoryButton: { minHeight: 36, paddingHorizontal: 11, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 4 },
  addStoryText: { fontSize: 13, fontWeight: '700' },
  storyLoader: { marginVertical: 26 },
  storyRow: { paddingHorizontal: 18, paddingTop: 14, gap: 14 },
  storyItem: { width: 86, alignItems: 'center' },
  storyRing: { width: 82, height: 112, padding: 2, borderWidth: 2, borderRadius: 15 },
  storyImage: { flex: 1, borderRadius: 11, overflow: 'hidden' },
  textStory: { padding: 6, alignItems: 'center', justifyContent: 'center' },
  textStoryCaption: { color: '#FFFFFF', fontSize: 9, lineHeight: 12, fontWeight: '700', textAlign: 'center' },
  videoBadge: { position: 'absolute', right: 7, bottom: 7, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  storyLabel: { width: 86, marginTop: 5, fontSize: 10, textAlign: 'center' },
  emptyStories: { minHeight: 68, marginTop: 12, paddingHorizontal: 18, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: 12 },
  emptyStoryIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  emptyStoryText: { flex: 1 },
  emptyStoryTitle: { fontSize: 15, fontWeight: '700' },
  emptyStorySubtitle: { marginTop: 2, fontSize: 12 },
  menuRow: { minHeight: 54, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuText: { flex: 1, fontSize: 15, fontWeight: '700' },
  logoutRow: { minHeight: 54, marginTop: 22, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoutText: { fontSize: 15, fontWeight: '700' },
});
