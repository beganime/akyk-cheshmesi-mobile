import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Akyl Cheshmesi',
  slug: 'akyl-cheshmesi',
  owner: 'aga_sila',
  scheme: 'akylchat',
  version: '1.0.2',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  icon: './assets/images/icon.png',
  splash: {
    image: './assets/images/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#0B1020',
  },
  assetBundlePatterns: ['**/*'],
  experiments: {
    typedRoutes: true,
  },
  plugins: [
    'expo-router',
    'expo-dev-client',
    'expo-notifications',
    [
      'expo-sqlite',
      {
        enableFTS: true,
        useSQLCipher: false,
      },
    ],
    [
      'expo-secure-store',
      {
        configureAndroidBackup: true,
      },
    ],
    [
      'expo-camera',
      {
        cameraPermission:
          'Разрешите Akyl Cheshmesi использовать камеру для видео-звонков и видео-сообщений.',
        microphonePermission:
          'Разрешите Akyl Cheshmesi использовать микрофон для аудио-звонков, видео-звонков и голосовых сообщений.',
        recordAudioAndroid: true,
      },
    ],
  ],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.akylchat.app',
    googleServicesFile: './GoogleService-Info.plist',
    infoPlist: {
      UIBackgroundModes: ['remote-notification'],
      ITSAppUsesNonExemptEncryption: false,
      NSCameraUsageDescription:
        'Разрешите Akyl Cheshmesi использовать камеру для видео-звонков.',
      NSMicrophoneUsageDescription:
        'Разрешите Akyl Cheshmesi использовать микрофон для звонков и голосовых сообщений.',
    },
  },
  android: {
    package: 'com.akylchat.app',
    googleServicesFile: './google-services.json',
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png',
      backgroundColor: '#0B1020',
    },
    edgeToEdgeEnabled: true,
    softwareKeyboardLayoutMode: 'pan',
    permissions: [
      'POST_NOTIFICATIONS',
      'RECORD_AUDIO',
      'CAMERA',
      'MODIFY_AUDIO_SETTINGS',
      'WAKE_LOCK',
      'FOREGROUND_SERVICE',
    ],
  },
  web: {
    bundler: 'metro',
    output: 'single',
    favicon: './assets/images/favicon.png',
  },
  extra: {
    apiBaseUrl:
      process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://akyl-cheshmesi.ru/api/v1',
    wsBaseUrl:
      process.env.EXPO_PUBLIC_WS_BASE_URL ?? 'wss://akyl-cheshmesi.ru/ws',
    callWsBaseUrl:
      process.env.EXPO_PUBLIC_CALL_WS_BASE_URL ?? 'wss://akyl-cheshmesi.ru/ws/calls',
    callIceServers:
      process.env.EXPO_PUBLIC_CALL_ICE_SERVERS ??
      'stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302,turn:turn.akyl-cheshmesi.ru:3478?transport=udp,turn:turn.akyl-cheshmesi.ru:3478?transport=tcp,turns:turn.akyl-cheshmesi.ru:5349?transport=tcp',
    callTurnUsername:
      process.env.EXPO_PUBLIC_CALL_TURN_USERNAME ?? 'akylturn',
    callTurnCredential:
      process.env.EXPO_PUBLIC_CALL_TURN_CREDENTIAL ?? 'akylTurn_2026_X9pLq7VnA4sK2mR8',
    pushTokenSyncPath:
      process.env.EXPO_PUBLIC_PUSH_TOKEN_SYNC_PATH ?? '/push-tokens/',
    eas: {
      projectId: '1d056ce0-1890-4429-97f7-31e739a1e023',
    },
  },
  runtimeVersion: {
    policy: 'appVersion',
  },
});