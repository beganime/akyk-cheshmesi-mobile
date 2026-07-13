import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { PUSH_CHANNELS } from '@/src/lib/push/payload';

export async function ensureAndroidNotificationChannels() {
  if (Platform.OS !== 'android') {
    return;
  }

  await Notifications.setNotificationChannelAsync(PUSH_CHANNELS.calls, {
    name: 'Звонки',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 350, 120, 350, 120, 700],
    lightColor: '#1DB954',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    sound: 'default',
    audioAttributes: {
      usage: Notifications.AndroidAudioUsage.NOTIFICATION_COMMUNICATION_REQUEST,
      contentType: Notifications.AndroidAudioContentType.SONIFICATION,
    },
  });

  await Notifications.setNotificationChannelAsync(PUSH_CHANNELS.messages, {
    name: 'Сообщения',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 200, 120, 200],
    lightColor: '#1DB954',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    sound: 'default',
    audioAttributes: {
      usage: Notifications.AndroidAudioUsage.NOTIFICATION_COMMUNICATION_INSTANT,
      contentType: Notifications.AndroidAudioContentType.SONIFICATION,
    },
  });
}

export function notificationTriggerForChannel(channelId: string) {
  if (Platform.OS !== 'android') {
    return null;
  }

  return { channelId };
}
