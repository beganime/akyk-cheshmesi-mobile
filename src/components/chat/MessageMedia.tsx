import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { Audio, ResizeMode, Video } from 'expo-av';

import { downloadAndShareRemoteFile } from '@/src/lib/media/download';
import type { MessageAttachment, MessageItem } from '@/src/types/message';

type Props = {
  message: MessageItem;
  isOwn: boolean;
  theme: any;
};

function getPrimaryAttachment(message: MessageItem): MessageAttachment | null {
  if (!message.attachments?.length) {
    return null;
  }

  return message.attachments[0] || null;
}

function formatDuration(millis?: number | null) {
  const safeMillis = Math.max(Number(millis || 0), 0);
  const totalSeconds = Math.floor(safeMillis / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function MessageMedia({ message, isOwn, theme }: Props) {
  const attachment = useMemo(() => getPrimaryAttachment(message), [message]);
  const [imageVisible, setImageVisible] = useState(false);
  const [videoVisible, setVideoVisible] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioPositionMillis, setAudioPositionMillis] = useState(0);
  const [audioDurationMillis, setAudioDurationMillis] = useState(0);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    return () => {
      const sound = soundRef.current;
      soundRef.current = null;

      if (sound) {
        void sound.unloadAsync();
      }
    };
  }, []);

  if (!attachment?.file_url) {
    return null;
  }

  const mediaKind = String(attachment.media_kind || '').toLowerCase();
  const contentType = String(attachment.content_type || '').toLowerCase();
  const isImage = mediaKind === 'image' || contentType.startsWith('image/');
  const isVideo = mediaKind === 'video' || contentType.startsWith('video/');
  const isAudio = mediaKind === 'audio' || contentType.startsWith('audio/');
  const isFile = !isImage && !isVideo && !isAudio;

  const textColor = isOwn ? '#FFFFFF' : theme.colors.text;
  const metaColor = isOwn ? 'rgba(255,255,255,0.84)' : theme.colors.muted;

  const handleDownload = async () => {
    try {
      setDownloading(true);

      await downloadAndShareRemoteFile({
        url: attachment.file_url,
        filename: attachment.original_name || undefined,
        contentType: attachment.content_type || undefined,
        shareDialogTitle: 'Скачать медиа',
      });
    } finally {
      setDownloading(false);
    }
  };

  const toggleAudio = async () => {
    try {
      if (!soundRef.current) {
        setAudioLoading(true);

        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          allowsRecordingIOS: false,
        });

        const { sound } = await Audio.Sound.createAsync(
          { uri: attachment.file_url },
          { shouldPlay: true },
          (status: any) => {
            if (!status?.isLoaded) {
              return;
            }

            setAudioPlaying(Boolean(status.isPlaying));
            setAudioPositionMillis(Number(status.positionMillis || 0));
            setAudioDurationMillis(Number(status.durationMillis || 0));

            if (status.didJustFinish) {
              setAudioPlaying(false);
              setAudioPositionMillis(0);
            }
          }
        );

        soundRef.current = sound;
        return;
      }

      const status: any = await soundRef.current.getStatusAsync();

      if (!status?.isLoaded) {
        return;
      }

      if (status.isPlaying) {
        await soundRef.current.pauseAsync();
      } else {
        await soundRef.current.playAsync();
      }
    } finally {
      setAudioLoading(false);
    }
  };

  if (isImage) {
    return (
      <>
        <Pressable style={styles.imageWrap} onPress={() => setImageVisible(true)}>
          <ExpoImage source={{ uri: attachment.file_url }} style={styles.image} contentFit="cover" />
          <View style={styles.topAction}>
            <Pressable
              onPress={handleDownload}
              disabled={downloading}
              style={[styles.iconButton, { backgroundColor: 'rgba(0,0,0,0.45)' }]}
            >
              <Ionicons
                name={downloading ? 'hourglass-outline' : 'download-outline'}
                size={18}
                color="#FFFFFF"
              />
            </Pressable>
          </View>
        </Pressable>

        <Modal visible={imageVisible} transparent animationType="fade" onRequestClose={() => setImageVisible(false)}>
          <View style={styles.modalRoot}>
            <ExpoImage source={{ uri: attachment.file_url }} style={styles.fullImage} contentFit="contain" />
            <View style={styles.modalActions}>
              <Pressable onPress={handleDownload} style={styles.modalActionButton}>
                <Ionicons name="download-outline" size={18} color="#FFFFFF" />
                <Text style={styles.modalActionText}>Скачать</Text>
              </Pressable>
              <Pressable onPress={() => setImageVisible(false)} style={styles.modalActionButton}>
                <Ionicons name="close-outline" size={20} color="#FFFFFF" />
                <Text style={styles.modalActionText}>Закрыть</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </>
    );
  }

  if (isVideo) {
    return (
      <>
        <Pressable style={styles.videoWrap} onPress={() => setVideoVisible(true)}>
          <Video
            style={styles.video}
            source={{ uri: attachment.file_url }}
            resizeMode={ResizeMode.COVER}
            useNativeControls={false}
            isLooping={false}
          />
          <View style={styles.videoOverlay}>
            <View style={styles.playCircle}>
              <Ionicons name="play" size={18} color="#FFFFFF" />
            </View>
          </View>
          <View style={styles.topAction}>
            <Pressable
              onPress={handleDownload}
              disabled={downloading}
              style={[styles.iconButton, { backgroundColor: 'rgba(0,0,0,0.45)' }]}
            >
              <Ionicons
                name={downloading ? 'hourglass-outline' : 'download-outline'}
                size={18}
                color="#FFFFFF"
              />
            </Pressable>
          </View>
        </Pressable>

        <Modal visible={videoVisible} animationType="slide" onRequestClose={() => setVideoVisible(false)}>
          <View style={styles.fullscreenVideoRoot}>
            <Video
              style={styles.fullscreenVideo}
              source={{ uri: attachment.file_url }}
              resizeMode={ResizeMode.CONTAIN}
              useNativeControls
              shouldPlay
            />
            <View style={styles.modalActions}>
              <Pressable onPress={handleDownload} style={styles.modalActionButton}>
                <Ionicons name="download-outline" size={18} color="#FFFFFF" />
                <Text style={styles.modalActionText}>Скачать</Text>
              </Pressable>
              <Pressable onPress={() => setVideoVisible(false)} style={styles.modalActionButton}>
                <Ionicons name="close-outline" size={20} color="#FFFFFF" />
                <Text style={styles.modalActionText}>Закрыть</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </>
    );
  }

  if (isAudio) {
    const progress =
      audioDurationMillis > 0 ? Math.min(audioPositionMillis / audioDurationMillis, 1) : 0;

    return (
      <View
        style={[
          styles.audioWrap,
          {
            backgroundColor: isOwn ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.03)',
            borderColor: isOwn ? 'rgba(255,255,255,0.14)' : theme.colors.border,
          },
        ]}
      >
        <Pressable onPress={toggleAudio} style={styles.audioButton}>
          {audioLoading ? (
            <ActivityIndicator size="small" color={textColor} />
          ) : (
            <Ionicons name={audioPlaying ? 'pause' : 'play'} size={18} color={textColor} />
          )}
        </Pressable>

        <View style={styles.audioContent}>
          <View
            style={[
              styles.audioProgressTrack,
              { backgroundColor: isOwn ? 'rgba(255,255,255,0.16)' : theme.colors.border },
            ]}
          >
            <View
              style={[
                styles.audioProgressValue,
                {
                  width: `${progress * 100}%`,
                  backgroundColor: isOwn ? '#FFFFFF' : theme.colors.primary,
                },
              ]}
            />
          </View>

          <Text style={[styles.audioTime, { color: metaColor }]}>
            {formatDuration(audioPositionMillis)} / {formatDuration(audioDurationMillis)}
          </Text>
        </View>

        <Pressable onPress={handleDownload} style={styles.audioButton}>
          <Ionicons
            name={downloading ? 'hourglass-outline' : 'download-outline'}
            size={18}
            color={textColor}
          />
        </Pressable>
      </View>
    );
  }

  if (isFile) {
    return (
      <Pressable
        onPress={handleDownload}
        style={[
          styles.fileWrap,
          {
            backgroundColor: isOwn ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.03)',
            borderColor: isOwn ? 'rgba(255,255,255,0.14)' : theme.colors.border,
          },
        ]}
      >
        <View style={styles.fileIcon}>
          <Ionicons name="document-outline" size={20} color={textColor} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={[styles.fileName, { color: textColor }]} numberOfLines={1}>
            {attachment.original_name || 'Файл'}
          </Text>
          <Text style={[styles.fileSub, { color: metaColor }]} numberOfLines={1}>
            {attachment.content_type || 'attachment'}
          </Text>
        </View>

        <Ionicons
          name={downloading ? 'hourglass-outline' : 'download-outline'}
          size={18}
          color={textColor}
        />
      </Pressable>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  imageWrap: {
    width: 220,
    height: 220,
    borderRadius: 18,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  videoWrap: {
    width: 220,
    height: 220,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.48)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topAction: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioWrap: {
    width: 240,
    minHeight: 58,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 10,
  },
  audioButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioContent: {
    flex: 1,
  },
  audioProgressTrack: {
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: 8,
  },
  audioProgressValue: {
    height: '100%',
    borderRadius: 999,
  },
  audioTime: {
    fontSize: 12,
    fontWeight: '500',
  },
  fileWrap: {
    width: 240,
    minHeight: 62,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  fileIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileName: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  fileSub: {
    fontSize: 12,
  },
  modalRoot: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
  },
  fullImage: {
    width: '100%',
    height: '78%',
  },
  fullscreenVideoRoot: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
  },
  fullscreenVideo: {
    width: '100%',
    height: '78%',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 28,
    paddingTop: 12,
  },
  modalActionButton: {
    minHeight: 44,
    minWidth: 124,
    borderRadius: 16,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.14)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  modalActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});