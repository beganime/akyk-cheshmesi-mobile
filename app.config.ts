import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Akyl Cheshmesi',
  slug: 'akyl-cheshmesi',
  owner: 'aga_sila',
  scheme: 'akylcheshmesi',
  version: '1.0.0',
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
        cameraPermission: 'Разрешите Akyl Cheshmesi использовать камеру для видео-сообщений.',
        microphonePermission:
          'Разрешите Akyl Cheshmesi использовать микрофон для голосовых и видео-сообщений.',
        recordAudioAndroid: true,
      },
    ],
  ],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'ru.akylcheshmesi.app',
  },
  android: {
    package: 'ru.akylcheshmesi.app',
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png',
      backgroundColor: '#0B1020',
    },
    edgeToEdgeEnabled: true,
    softwareKeyboardLayoutMode: 'pan',
  },
  web: {
    bundler: 'metro',
    output: 'single',
    favicon: './assets/images/favicon.png',
  },
  extra: {
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://akyl-cheshmesi.ru/api/v1',
    wsBaseUrl: process.env.EXPO_PUBLIC_WS_BASE_URL ?? 'wss://akyl-cheshmesi.ru/ws',
    eas: {
      projectId: '1d056ce0-1890-4429-97f7-31e739a1e023',
    },
  },
  runtimeVersion: {
    policy: 'appVersion',
  },
});