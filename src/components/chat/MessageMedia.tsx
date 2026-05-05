import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { Audio, ResizeMode, Video } from 'expo-av';

import type { MessageItem } from '@/src/types/message';
import { downloadAndShareRemoteFile } from '@/src/lib/media/download';

type Props = {
  message: MessageItem;
  isOwn: boolean;
  theme: any;
};

function getAttachmentByKind(message: MessageItem) {
  const attachments = Array.isArray(message.attachments) ? message.attachments : [];

  if (!attachments.length) {
    return null;
  }

  const type = String(message.message_type || '').toLowerCase();

  const byType = attachments.find((item) => {
    const mediaKind = String(item.media_kind || '').toLowerCase();
    const contentType = String(item.content_type || '').toLowerCase();

    if (type === 'image') return mediaKind === 'image' || contentType.startsWith('image/');
    if (type === 'video') return mediaKind === 'video' || contentType.startsWith('video/');
    if (type === 'audio') return mediaKind === 'audio' || contentType.startsWith('audio/');
    if (type === 'file') return true;

    return false;
  });

  return byType || attachments[0] || null;
}

function formatDuration(millis?: number | null) {
  const safeMillis = Math.max(Number(millis || 0), 0);
  const totalSeconds = Math.floor(safeMillis / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function getVideoNote(message: MessageItem) {
  const meta = message.metadata as Record<string, unknown> | null | undefined;
  return Boolean(meta?.is_video_note || meta?.shape === 'circle');
}

export function MessageMedia({ message, isOwn, theme }: Props) {
  const attachment = useMemo(() => getAttachmentByKind(message), [message]);
  const soundRef = useRef<Audio.Sound | null>(null);

  const [imageVisible, setImageVisible] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioPositionMillis, setAudioPositionMillis] = useState(0);
  const [audioDurationMillis, setAudioDurationMillis] = useState(0);
  const [downloadLoading, setDownloadLoading] = useState(false);

  useEffect(() => {
    return () => {
      const sound = soundRef.current;
      soundRef.current = null;

      if (sound) {
        void sound.unloadAsync().catch(() => undefined);
      }
    };
  }, []);

  if (!attachment?.file_url) {
    return null;
  }

  const fileUrl = attachment.file_url;
  const mediaKind = String(attachment.media_kind || '').toLowerCase();
  const contentType = String(attachment.content_type || '').toLowerCase();

  const isImage =
    message.message_type === 'image' ||
    mediaKind === 'image' ||
    contentType.startsWith('image/');

  const isVideo =
    message.message_type === 'video' ||
    mediaKind === 'video' ||
    contentType.startsWith('video/');

  const isAudio =
    message.message_type === 'audio' ||
    mediaKind === 'audio' ||
    contentType.startsWith('audio/');

  const textColor = isOwn ? '#FFFFFF' : theme.colors.text;
  const metaColor = isOwn ? 'rgba(255,255,255,0.82)' : theme.colors.muted;
  const videoNote = getVideoNote(message);

  const openFile = async () => {
    try {
      const url = attachment.file_url;

      if (!url) return;

      const canOpen = await Linking.canOpenURL(url);

      if (canOpen) {
        await Linking.openURL(url);
        return;
      }

      await Share.share({
        message: url,
      });
    } catch (error) {
      console.error('openFile error:', error);
    }
  };

  const handleDownload = async () => {
    try {
      if (!attachment?.file_url || downloadLoading) return;
      setDownloadLoading(true);

      await downloadAndShareRemoteFile({
        url: attachment.file_url,
        filename: attachment.original_name || undefined,
        contentType: attachment.content_type || undefined,
        shareDialogTitle: isImage ? 'Скачать фото' : isVideo ? 'Скачать видео' : 'Скачать файл',
      });
    } catch (error) {
      console.error('handleDownload error:', error);
    } finally {
      setDownloadLoading(false);
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
          { uri: fileUrl },
          { shouldPlay: true, progressUpdateIntervalMillis: 180 },
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
              void soundRef.current?.setPositionAsync(0).catch(() => undefined);
            }
          },
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
        if (status.positionMillis >= status.durationMillis) {
          await soundRef.current.setPositionAsync(0);
        }
        await soundRef.current.playAsync();
      }
    } catch (error) {
      console.error('toggleAudio error:', error);
    } finally {
      setAudioLoading(false);
    }
  };

  if (isImage) {
    return (
      <>
        <Pressable style={styles.imageWrap} onPress={() => setImageVisible(true)}>
          <ExpoImage
            source={{ uri: attachment.file_url }}
            style={styles.image}
            contentFit="cover"
            cachePolicy="memory-disk"
          />

          <View style={styles.zoomBadge}>
            <Ionicons name="expand-outline" size={16} color="#FFFFFF" />
          </View>
        </Pressable>

        <Modal
          visible={imageVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setImageVisible(false)}
        >
          <View style={styles.modalRoot}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setImageVisible(false)} />

            <ExpoImage
              source={{ uri: attachment.file_url }}
              style={styles.fullImage}
              contentFit="contain"
              cachePolicy="memory-disk"
            />

            <Pressable style={styles.closeButton} onPress={() => setImageVisible(false)}>
              <Ionicons name="close" size={20} color="#FFFFFF" />
            </Pressable>

            <Pressable style={styles.downloadButton} onPress={() => void handleDownload()}>
              {downloadLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="download-outline" size={18} color="#FFFFFF" />
              )}
            </Pressable>
          </View>
        </Modal>
      </>
    );
  }

  if (isVideo) {
    return (
      <View style={[styles.videoWrap, videoNote ? styles.videoNoteWrap : null]}>
        <Video
          style={[styles.video, videoNote ? styles.videoNote : null]}
          source={{ uri: attachment.file_url }}
          resizeMode={ResizeMode.COVER}
          shouldPlay={videoPlaying}
          isLooping={false}
          useNativeControls={false}
          onPlaybackStatusUpdate={(status: any) => {
            if (!status?.isLoaded) return;
            setVideoPlaying(Boolean(status.isPlaying));
            if (status.didJustFinish) {
              setVideoPlaying(false);
            }
          }}
        />

        <Pressable
          onPress={() => setVideoPlaying((current) => !current)}
          style={styles.videoOverlay}
        >
          <View style={[styles.playCircle, videoNote ? styles.playCircleVideoNote : null]}>
            <Ionicons name={videoPlaying ? 'pause' : 'play'} size={20} color="#FFFFFF" />
          </View>
        </Pressable>

        <Pressable style={styles.videoDownloadButton} onPress={() => void handleDownload()}>
          {downloadLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="download-outline" size={15} color="#FFFFFF" />
          )}
        </Pressable>
      </View>
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
            backgroundColor: isOwn ? 'rgba(99,102,241,0.92)' : theme.colors.cardStrong,
            borderColor: isOwn ? 'rgba(255,255,255,0.16)' : theme.colors.borderStrong,
          },
        ]}
      >
        <Pressable onPress={() => void toggleAudio()} style={styles.audioButton}>
          {audioLoading ? (
            <ActivityIndicator size="small" color={textColor} />
          ) : (
            <Ionicons name={audioPlaying ? 'pause' : 'play'} size={20} color={textColor} />
          )}
        </Pressable>

        <View style={styles.audioWaveArea}>
          <View style={styles.fakeWaveRow}>
            {Array.from({ length: 24 }).map((_, index) => {
              const active = index / 24 <= progress;
              const height = 8 + ((index * 7) % 18);

              return (
                <View
                  key={index}
                  style={[
                    styles.fakeWaveBar,
                    {
                      height,
                      backgroundColor: active
                        ? textColor
                        : isOwn
                          ? 'rgba(255,255,255,0.26)'
                          : theme.colors.borderStrong,
                    },
                  ]}
                />
              );
            })}
          </View>

          <Text style={[styles.audioTime, { color: metaColor }]}>
            {formatDuration(audioPositionMillis)} / {formatDuration(audioDurationMillis)}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => void openFile()}
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

      <Ionicons name="open-outline" size={18} color={textColor} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  imageWrap: {
    width: 224,
    height: 224,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#111827',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  zoomBadge: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  videoWrap: {
    width: 224,
    height: 224,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  videoNoteWrap: {
    width: 224,
    height: 224,
    borderRadius: 112,
  },
  video: {
    width: '100%',
    height: '100%',
  },
  videoNote: {
    borderRadius: 112,
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.52)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playCircleVideoNote: {
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  videoDownloadButton: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.44)',
  },
  audioWrap: {
    width: 254,
    minHeight: 68,
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  audioButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  audioWaveArea: {
    flex: 1,
    minWidth: 0,
  },
  fakeWaveRow: {
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: 4,
  },
  fakeWaveBar: {
    width: 3,
    borderRadius: 999,
  },
  audioTime: {
    fontSize: 12,
    fontWeight: '700',
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullImage: {
    width: '100%',
    height: '82%',
  },
  closeButton: {
    position: 'absolute',
    top: 56,
    right: 18,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.48)',
  },
  downloadButton: {
    position: 'absolute',
    top: 56,
    right: 66,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.48)',
  },
});
