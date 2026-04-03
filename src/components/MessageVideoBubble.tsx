import { StyleSheet, Text, View } from 'react-native';
import { Video, ResizeMode } from 'expo-av';

import { useTheme } from '@/src/theme/ThemeProvider';

type MessageVideoBubbleProps = {
  uri: string;
  isOwn: boolean;
};

export function MessageVideoBubble({ uri, isOwn }: MessageVideoBubbleProps) {
  const { theme } = useTheme();

  return (
    <View style={styles.wrap}>
      <View style={styles.circleWrap}>
        <Video
          source={{ uri }}
          style={styles.video}
          useNativeControls
          resizeMode={ResizeMode.COVER}
          shouldPlay={false}
          isLooping={false}
        />
      </View>

      <Text
        style={[
          styles.label,
          {
            color: isOwn ? 'rgba(255,255,255,0.9)' : theme.colors.muted,
          },
        ]}
      >
        Видео-сообщение
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 190,
    alignItems: 'center',
  },
  circleWrap: {
    width: 180,
    height: 180,
    borderRadius: 90,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  video: {
    width: 180,
    height: 180,
    backgroundColor: '#000000',
  },
  label: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '700',
  },
});