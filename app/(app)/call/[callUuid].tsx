import { useEffect, useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { RTCView } from 'react-native-webrtc';

import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuthStore } from '@/src/state/auth';
import { useCallStore } from '@/src/state/call';

function formatUserName(user?: {
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  email?: string | null;
} | null) {
  if (!user) return 'Пользователь';

  return (
    user.full_name ||
    [user.first_name, user.last_name].filter(Boolean).join(' ') ||
    user.username ||
    user.email ||
    'Пользователь'
  );
}

function formatDuration(seconds?: number) {
  const value = Number(seconds || 0);
  const mins = Math.floor(value / 60);
  const secs = value % 60;

  const mm = String(mins).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');

  return `${mm}:${ss}`;
}

export default function CallScreen() {
  const { theme } = useTheme();
  const { user } = useAuthStore();
  const params = useLocalSearchParams<{ callUuid: string }>();

  const {
    currentCall,
    phase,
    engineState,
    busy,
    lastError,
    loadCall,
    acceptCurrent,
    rejectCurrent,
    endCurrent,
    cancelOutgoing,
    clear,
    toggleMute,
    toggleSpeaker,
    toggleVideo,
    switchCamera,
  } = useCallStore();

  useEffect(() => {
    const callUuid = typeof params.callUuid === 'string' ? params.callUuid : '';

    if (!callUuid) {
      return;
    }

    if (currentCall?.uuid === callUuid) {
      return;
    }

    void loadCall(callUuid, 'incoming');
  }, [params.callUuid, currentCall?.uuid, loadCall]);

  const peerParticipant = useMemo(() => {
    const currentUserUuid = user?.uuid;

    return (
      currentCall?.participants?.find(
        (participant) => participant.user?.uuid && participant.user.uuid !== currentUserUuid,
      ) ?? null
    );
  }, [currentCall?.participants, user?.uuid]);

  const peerName = useMemo(() => {
    return formatUserName(peerParticipant?.user);
  }, [peerParticipant?.user]);

  const callType = currentCall?.call_type ?? engineState.callType ?? 'audio';
  const isVideo = callType === 'video';

  const callStatusText = useMemo(() => {
    if (phase === 'incoming') return 'Входящий звонок';
    if (phase === 'outgoing') return 'Соединение...';
    if (phase === 'active') return 'Вызов активен';
    if (phase === 'ended') return 'Звонок завершён';
    if (phase === 'error') return lastError || 'Ошибка звонка';
    return 'Подготовка звонка...';
  }, [phase, lastError]);

  const handleClose = async () => {
    await clear();
    router.back();
  };

  const handleReject = async () => {
    await rejectCurrent();
    router.back();
  };

  const handleAccept = async () => {
    await acceptCurrent();
  };

  const handleEnd = async () => {
    if (phase === 'outgoing') {
      await cancelOutgoing();
      router.back();
      return;
    }

    await endCurrent();
    router.back();
  };

  const localStreamUrl = engineState.localStream?.toURL?.() ?? null;
  const remoteStreamUrl = engineState.remoteStream?.toURL?.() ?? null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#0B1020' }]}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => void handleClose()}
          style={({ pressed }) => [
            styles.topButton,
            { backgroundColor: 'rgba(255,255,255,0.10)' },
            pressed && { opacity: 0.75 },
          ]}
        >
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
        </Pressable>

        <View style={styles.topCenter}>
          <Text style={styles.topStatus}>{callStatusText}</Text>
          {currentCall?.duration_seconds ? (
            <Text style={styles.topDuration}>
              {formatDuration(currentCall.duration_seconds)}
            </Text>
          ) : null}
        </View>

        <View style={styles.topButtonSpacer} />
      </View>

      <View style={styles.mainContent}>
        {isVideo && remoteStreamUrl ? (
          <RTCView
            objectFit="cover"
            streamURL={remoteStreamUrl}
            style={styles.remoteVideo}
            mirror={false}
          />
        ) : (
          <View style={styles.audioPlaceholder}>
            <View style={[styles.avatar, { backgroundColor: theme.colors.primary }]}>
              <Text style={styles.avatarText}>
                {peerName.slice(0, 1).toUpperCase()}
              </Text>
            </View>

            <Text style={styles.peerName}>{peerName}</Text>
            <Text style={styles.peerSub}>
              {phase === 'incoming'
                ? 'Хочет связаться с тобой'
                : phase === 'outgoing'
                ? 'Ожидаем ответ...'
                : phase === 'active'
                ? 'Разговор идёт'
                : phase === 'ended'
                ? 'Разговор завершён'
                : lastError || 'Подключение'}
            </Text>
          </View>
        )}

        {isVideo && localStreamUrl ? (
          <View style={styles.localPreviewWrap}>
            <RTCView
              objectFit="cover"
              streamURL={localStreamUrl}
              style={styles.localPreview}
              mirror
            />
          </View>
        ) : null}

        {!currentCall ? (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator color="#FFFFFF" />
            <Text style={styles.loadingText}>Загружаем звонок...</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.bottomPanel}>
        {phase === 'incoming' ? (
          <View style={styles.incomingActions}>
            <Pressable
              onPress={() => void handleReject()}
              disabled={busy}
              style={({ pressed }) => [
                styles.callActionButton,
                { backgroundColor: '#EF4444' },
                pressed && { opacity: 0.75 },
              ]}
            >
              <Ionicons name="close" size={26} color="#FFFFFF" />
            </Pressable>

            <Pressable
              onPress={() => void handleAccept()}
              disabled={busy}
              style={({ pressed }) => [
                styles.callActionButton,
                { backgroundColor: '#10B981' },
                pressed && { opacity: 0.75 },
              ]}
            >
              <Ionicons name="call" size={24} color="#FFFFFF" />
            </Pressable>
          </View>
        ) : phase === 'ended' || phase === 'error' ? (
          <View style={styles.incomingActions}>
            <Pressable
              onPress={() => void handleClose()}
              style={({ pressed }) => [
                styles.singleCloseButton,
                { backgroundColor: '#334155' },
                pressed && { opacity: 0.75 },
              ]}
            >
              <Text style={styles.singleCloseText}>Закрыть</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.activeActions}>
            <Pressable
              onPress={() => void toggleMute()}
              style={({ pressed }) => [
                styles.iconActionButton,
                {
                  backgroundColor: engineState.muted
                    ? 'rgba(239,68,68,0.92)'
                    : 'rgba(255,255,255,0.12)',
                },
                pressed && { opacity: 0.75 },
              ]}
            >
              <Ionicons
                name={engineState.muted ? 'mic-off' : 'mic'}
                size={22}
                color="#FFFFFF"
              />
            </Pressable>

            <Pressable
              onPress={() => void toggleSpeaker()}
              style={({ pressed }) => [
                styles.iconActionButton,
                {
                  backgroundColor: engineState.speakerOn
                    ? 'rgba(59,130,246,0.92)'
                    : 'rgba(255,255,255,0.12)',
                },
                pressed && { opacity: 0.75 },
              ]}
            >
              <Ionicons
                name={engineState.speakerOn ? 'volume-high' : 'volume-medium'}
                size={22}
                color="#FFFFFF"
              />
            </Pressable>

            {isVideo ? (
              <Pressable
                onPress={() => void toggleVideo()}
                style={({ pressed }) => [
                  styles.iconActionButton,
                  {
                    backgroundColor: engineState.videoEnabled
                      ? 'rgba(255,255,255,0.12)'
                      : 'rgba(239,68,68,0.92)',
                  },
                  pressed && { opacity: 0.75 },
                ]}
              >
                <Ionicons
                  name={engineState.videoEnabled ? 'videocam' : 'videocam-off'}
                  size={22}
                  color="#FFFFFF"
                />
              </Pressable>
            ) : null}

            {isVideo ? (
              <Pressable
                onPress={() => void switchCamera()}
                style={({ pressed }) => [
                  styles.iconActionButton,
                  { backgroundColor: 'rgba(255,255,255,0.12)' },
                  pressed && { opacity: 0.75 },
                ]}
              >
                <Ionicons name="camera-reverse" size={22} color="#FFFFFF" />
              </Pressable>
            ) : null}

            <Pressable
              onPress={() => void handleEnd()}
              style={({ pressed }) => [
                styles.callActionButton,
                { backgroundColor: '#EF4444' },
                pressed && { opacity: 0.75 },
              ]}
            >
              <Ionicons
                name="call"
                size={24}
                color="#FFFFFF"
                style={{ transform: [{ rotate: '135deg' }] }}
              />
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topButtonSpacer: {
    width: 42,
    height: 42,
  },
  topCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  topStatus: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  topDuration: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    marginTop: 2,
  },
  mainContent: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  remoteVideo: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
  },
  audioPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  avatar: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 42,
    fontWeight: '800',
  },
  peerName: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
  },
  peerSub: {
    color: 'rgba(255,255,255,0.76)',
    fontSize: 15,
    marginTop: 8,
    textAlign: 'center',
  },
  localPreviewWrap: {
    position: 'absolute',
    right: 16,
    top: 16,
    width: 112,
    height: 164,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  localPreview: {
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    position: 'absolute',
    inset: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  bottomPanel: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 28,
  },
  incomingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  activeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    flexWrap: 'wrap',
  },
  callActionButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconActionButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  singleCloseButton: {
    minWidth: 160,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  singleCloseText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});