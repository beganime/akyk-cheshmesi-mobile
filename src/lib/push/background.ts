import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import {
  parsePushTarget,
  hasVisibleNotificationContent,
  PUSH_CHANNELS,
} from '@/src/lib/push/payload';
import {
  ensureAndroidNotificationChannels,
  notificationTriggerForChannel,
} from '@/src/lib/push/channels';

const BACKGROUND_PUSH_TASK = 'AKYL_BACKGROUND_PUSH_TASK';
const BackgroundNotificationResult = {
  NoData: 1,
  NewData: 2,
  Failed: 3,
} as const;

async function scheduleFallbackNotification(
  target: ReturnType<typeof parsePushTarget>,
) {
  if (target.kind === 'call' && target.callUuid) {
    const title = target.callerName || 'Входящий звонок';
    const body = target.callType === 'video' ? 'Видеозвонок' : 'Аудиозвонок';

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: {
          ...target.data,
          type: 'call',
          event: target.event || 'incoming_call',
          channel_id: PUSH_CHANNELS.calls,
          call_uuid: target.callUuid,
          ...(target.chatUuid ? { chat_uuid: target.chatUuid } : {}),
          ...(target.roomKey ? { room_key: target.roomKey } : {}),
          ...(target.callType ? { call_type: target.callType } : {}),
          ...(target.callerUuid ? { caller_uuid: target.callerUuid } : {}),
          ...(target.callerName ? { caller_name: target.callerName } : {}),
        },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        vibrate: [0, 350, 120, 350, 120, 700],
      },
      trigger: notificationTriggerForChannel(PUSH_CHANNELS.calls),
    });
    return;
  }

  if (target.kind === 'message' && target.chatUuid) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: target.data.sender_name || 'Новое сообщение',
        body: target.data.preview || target.data.body || 'Откройте чат, чтобы прочитать сообщение',
        data: {
          ...target.data,
          type: 'message',
          channel_id: PUSH_CHANNELS.messages,
          chat_uuid: target.chatUuid,
          ...(target.messageUuid ? { message_uuid: target.messageUuid } : {}),
        },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        vibrate: [0, 200, 120, 200],
      },
      trigger: notificationTriggerForChannel(PUSH_CHANNELS.messages),
    });
  }
}

TaskManager.defineTask<Notifications.NotificationTaskPayload>(
  BACKGROUND_PUSH_TASK,
  async ({ data, error }) => {
    if (error) {
      return BackgroundNotificationResult.Failed;
    }

    const target = parsePushTarget(data);
    if (target.kind === 'unknown') {
      return BackgroundNotificationResult.NoData;
    }

    if (hasVisibleNotificationContent(data)) {
      return BackgroundNotificationResult.NoData;
    }

    await ensureAndroidNotificationChannels();
    await scheduleFallbackNotification(target);

    return BackgroundNotificationResult.NewData;
  },
);

export async function registerPushBackgroundTaskAsync() {
  if (Platform.OS === 'web') {
    return;
  }

  const isAvailable = await TaskManager.isAvailableAsync().catch(() => false);
  if (!isAvailable) {
    return;
  }

  const isRegistered = await TaskManager.isTaskRegisteredAsync(
    BACKGROUND_PUSH_TASK,
  ).catch(() => false);

  if (!isRegistered) {
    await Notifications.registerTaskAsync(BACKGROUND_PUSH_TASK);
  }
}
