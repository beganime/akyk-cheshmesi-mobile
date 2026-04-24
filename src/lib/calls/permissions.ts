import { Alert, Platform } from 'react-native';
import { Camera } from 'expo-camera';
import * as Notifications from 'expo-notifications';

export async function ensureCallPermissions(callType: 'audio' | 'video') {
  const mic = await Camera.requestMicrophonePermissionsAsync();

  if (!mic.granted) {
    Alert.alert(
      'Нужен микрофон',
      'Разреши доступ к микрофону для звонков.',
    );
    return false;
  }

  if (callType === 'video') {
    const camera = await Camera.requestCameraPermissionsAsync();

    if (!camera.granted) {
      Alert.alert(
        'Нужна камера',
        'Разреши доступ к камере для видео-звонков.',
      );
      return false;
    }
  }

  if (Platform.OS !== 'web') {
    await Notifications.requestPermissionsAsync();
  }

  return true;
}