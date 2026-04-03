import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio, type AVPlaybackStatus } from 'expo-av';

import { useTheme } from '@/src/theme/ThemeProvider';

type MessageAudioBubbleProps = {
  uri: string;
  isOwn: boolean;
};

function formatMillis(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function MessageAudioBubble({ uri, isOwn }: MessageAudioBubbleProps) {
  const { theme } = useTheme();

  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [playing, setPlaying] = useState(false);
  const [positionMillis, setPositionMillis] = useState(0);
  const [durationMillis, setDurationMillis] = useState(0);

  useEffect(() => {
    return () => {
      if (sound) {
        void sound.unloadAsync();
      }
    };
  }, [sound]);

  const onStatusUpdate = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      return;
    }

    setPlaying(status.isPlaying);
    setPositionMillis(status.positionMillis ?? 0);

    if (typeof status.durationMillis === 'number') {
      setDurationMillis(status.durationMillis);
    }

    if (status.didJustFinish) {
      setPlaying(false);
      setPositionMillis(0);
    }
  };

  const ensureSound = async () => {
    if (sound) {
      return sound;
    }

    const { sound: createdSound, status } = await Audio.Sound.createAsync(
      { uri },
      { shouldPlay: false },
      onStatusUpdate,
    );

    if ((status as AVPlaybackStatus).isLoaded) {
      const loaded = status as any;
      if (typeof loaded.durationMillis === 'number') {
        setDurationMillis(loaded.durationMillis);
      }
    }

    setSound(createdSound);
    return createdSound;
  };

  const togglePlayback = async () => {
    const activeSound = await ensureSound();
    const status = await activeSound.getStatusAsync();

    if (!status.isLoaded) {
      return;
    }

    if (status.isPlaying) {
      await activeSound.pauseAsync();
      return;
    }

    if (
      typeof status.positionMillis === 'number' &&
      typeof status.durationMillis === 'number' &&
      status.positionMillis >= status.durationMillis
    ) {
      await activeSound.replayAsync();
      return;
    }

    await activeSound.playAsync();
  };

  const progress =
    durationMillis > 0
      ? Math.min(1, Math.max(0, positionMillis / durationMillis))
      : 0;

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => void togglePlayback()}
        style={[
          styles.playButton,
          {
            backgroundColor: isOwn ? 'rgba(255,255,255,0.18)' : theme.colors.primarySoft,
          },
        ]}
      >
        <Ionicons
          name={playing ? 'pause' : 'play'}
          size={18}
          color={isOwn ? '#FFFFFF' : theme.colors.primary}
        />
      </Pressable>

      <View style={styles.center}>
        <Text
          style={[
            styles.title,
            {
              color: isOwn ? '#FFFFFF' : theme.colors.text,
            },
          ]}
        >
          Голосовое сообщение
        </Text>

        <View
          style={[
            styles.progressTrack,
            {
              backgroundColor: isOwn ? 'rgba(255,255,255,0.18)' : theme.colors.backgroundTertiary,
            },
          ]}
        >
          <View
            style={[
              styles.progressFill,
              {
                width: `${progress * 100}%`,
                backgroundColor: isOwn ? '#FFFFFF' : theme.colors.primary,
              },
            ]}
          />
        </View>
      </View>

      <Text
        style={[
          styles.time,
          {
            color: isOwn ? 'rgba(255,255,255,0.86)' : theme.colors.muted,
          },
        ]}
      >
        {formatMillis(durationMillis || positionMillis)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minWidth: 210,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 6,
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 999,
  },
  time: {
    fontSize: 12,
    fontWeight: '700',
    minWidth: 42,
    textAlign: 'right',
  },
});