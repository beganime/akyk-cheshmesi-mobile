import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';

import { sendChatMessage } from '@/src/lib/api/messages';
import { uploadPickedAudio } from '@/src/lib/api/media';
import { generateUUIDv4 } from '@/src/lib/utils/uuid';
import type { MessageItem } from '@/src/types/message';

type Props = {
  chatUuid?: string;
  replyToUuid?: string;
  disabled?: boolean;
  theme: any;
  onMessageCreated?: (message: MessageItem) => void;
};

export function HoldToRecordButton({
  chatUuid,
  replyToUuid,
  disabled,
  theme,
  onMessageCreated,
}: Props) {
  const recordingRef = useRef<Audio.Recording | null>(null);
  const startedAtRef = useRef<number>(0);

  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    return () => {
      const current = recordingRef.current;
      recordingRef.current = null;

      if (current) {
        void current.stopAndUnloadAsync().catch(() => undefined);
      }
    };
  }, []);

  const ensureAudioPermission = async () => {
    const current = await Audio.getPermissionsAsync();

    if (current.status === 'granted') {
      return true;
    }

    const requested = await Audio.requestPermissionsAsync();
    return requested.status === 'granted';
  };

  const startRecording = async () => {
    if (!chatUuid || disabled || busy || recording) {
      return;
    }

    const granted = await ensureAudioPermission();

    if (!granted) {
      return;
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      playThroughEarpieceAndroid: false,
    });

    const nextRecording = new Audio.Recording();

    await nextRecording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
    await nextRecording.startAsync();

    recordingRef.current = nextRecording;
    startedAtRef.current = Date.now();
    setRecording(true);
  };

  const stopRecordingAndSend = async () => {
    const currentRecording = recordingRef.current;
    recordingRef.current = null;
    setRecording(false);

    if (!currentRecording || !chatUuid) {
      return;
    }

    setBusy(true);

    try {
      await currentRecording.stopAndUnloadAsync();
    } catch {
      // swallow stop race
    }

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });
    } catch {
      // ignore audio mode reset errors
    }

    try {
      const duration = Date.now() - startedAtRef.current;
      const uri = currentRecording.getURI();

      if (!uri || duration < 400) {
        return;
      }

      const uploaded = await uploadPickedAudio({
        uri,
        fileName:
          Platform.OS === 'web'
            ? `voice-${Date.now()}.webm`
            : `voice-${Date.now()}.m4a`,
        mimeType: Platform.OS === 'web' ? 'audio/webm' : 'audio/mp4',
      });

      const savedMessage = await sendChatMessage(chatUuid, {
        client_uuid: generateUUIDv4(),
        message_type: 'audio',
        text: '',
        attachment_uuids: [uploaded.uuid],
        ...(replyToUuid ? { reply_to_uuid: replyToUuid } : {}),
      });

      onMessageCreated?.(savedMessage);
    } catch (error) {
      console.error('stopRecordingAndSend error:', error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable
      onPressIn={() => void startRecording()}
      onPressOut={() => void stopRecordingAndSend()}
      disabled={disabled || busy}
      style={[
        styles.button,
        {
          backgroundColor: recording ? theme.colors.primary : theme.colors.card,
          borderColor: theme.colors.border,
          opacity: busy ? 0.6 : 1,
        },
      ]}
    >
      <Ionicons
        name={recording ? 'radio-button-on' : 'mic-outline'}
        size={18}
        color={recording ? '#FFFFFF' : theme.colors.text}
      />
      <Text
        style={[
          styles.text,
          {
            color: recording ? '#FFFFFF' : theme.colors.text,
          },
        ]}
      >
        {recording ? 'Идёт запись…' : 'Зажми'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: 92,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  text: {
    fontSize: 13,
    fontWeight: '700',
  },
});