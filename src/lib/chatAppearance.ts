import AsyncStorage from '@react-native-async-storage/async-storage';

export type ChatBackgroundPreset =
  | 'theme'
  | 'plain'
  | 'midnight'
  | 'sunset'
  | 'forest';

export type BubblePreset =
  | 'default'
  | 'rounded'
  | 'glass'
  | 'soft';

export type ChatAppearance = {
  backgroundPreset: ChatBackgroundPreset;
  ownBubblePreset: BubblePreset;
  peerBubblePreset: BubblePreset;
  customBackgroundColor?: string | null;
  customOwnBubbleColor?: string | null;
  customPeerBubbleColor?: string | null;
  backgroundImageUri?: string | null;
  backgroundSizeMode?: 'cover' | 'contain';
  gradientPreset?: 'none' | 'sunrise' | 'ocean' | 'violet';
};

export const DEFAULT_CHAT_APPEARANCE: ChatAppearance = {
  backgroundPreset: 'theme',
  ownBubblePreset: 'default',
  peerBubblePreset: 'default',
  customBackgroundColor: null,
  customOwnBubbleColor: null,
  customPeerBubbleColor: null,
  backgroundImageUri: null,
  backgroundSizeMode: 'cover',
  gradientPreset: 'none',
};

const STORAGE_KEY = 'chat_appearance_v2';

function normalizeBackgroundPreset(value: unknown): ChatBackgroundPreset {
  switch (value) {
    case 'plain':
    case 'midnight':
    case 'sunset':
    case 'forest':
    case 'theme':
      return value;
    default:
      return DEFAULT_CHAT_APPEARANCE.backgroundPreset;
  }
}

function normalizeBubblePreset(value: unknown): BubblePreset {
  switch (value) {
    case 'rounded':
    case 'glass':
    case 'soft':
    case 'default':
      return value;
    default:
      return 'default';
  }
}

export async function loadChatAppearance(): Promise<ChatAppearance> {
  return loadChatAppearanceForChat();
}

type ChatAppearanceStorage = {
  global?: Partial<ChatAppearance>;
  perChat?: Record<string, Partial<ChatAppearance>>;
};

function normalizeAppearance(value: Partial<ChatAppearance> | null | undefined): ChatAppearance {
  return {
    backgroundPreset: normalizeBackgroundPreset(value?.backgroundPreset),
    ownBubblePreset: normalizeBubblePreset(value?.ownBubblePreset),
    peerBubblePreset: normalizeBubblePreset(value?.peerBubblePreset),
    customBackgroundColor:
      typeof value?.customBackgroundColor === 'string' ? value.customBackgroundColor : null,
    customOwnBubbleColor:
      typeof value?.customOwnBubbleColor === 'string' ? value.customOwnBubbleColor : null,
    customPeerBubbleColor:
      typeof value?.customPeerBubbleColor === 'string' ? value.customPeerBubbleColor : null,
    backgroundImageUri:
      typeof value?.backgroundImageUri === 'string' ? value.backgroundImageUri : null,
    backgroundSizeMode: value?.backgroundSizeMode === 'contain' ? 'contain' : 'cover',
    gradientPreset:
      value?.gradientPreset === 'sunrise' ||
      value?.gradientPreset === 'ocean' ||
      value?.gradientPreset === 'violet'
        ? value.gradientPreset
        : 'none',
  };
}

async function readStorage(): Promise<ChatAppearanceStorage> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function loadChatAppearanceForChat(chatUuid?: string | null): Promise<ChatAppearance> {
  const storage = await readStorage();
  const global = normalizeAppearance(storage.global);

  if (!chatUuid) {
    return global;
  }

  const perChat = normalizeAppearance(storage.perChat?.[chatUuid]);
  return {
    ...global,
    ...perChat,
  };
}

export async function saveChatAppearance(nextValue: ChatAppearance) {
  return saveChatAppearanceForChat(nextValue);
}

export async function saveChatAppearanceForChat(
  nextValue: ChatAppearance,
  chatUuid?: string | null,
) {
  const storage = await readStorage();
  if (!chatUuid) {
    const next: ChatAppearanceStorage = {
      ...storage,
      global: nextValue,
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return;
  }

  const next: ChatAppearanceStorage = {
    ...storage,
    perChat: {
      ...(storage.perChat || {}),
      [chatUuid]: nextValue,
    },
  };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function buildChatBackgroundStyle(theme: any, appearance: ChatAppearance) {
  if (appearance.customBackgroundColor?.trim()) {
    return { backgroundColor: appearance.customBackgroundColor.trim() };
  }

  switch (appearance.backgroundPreset) {
    case 'plain':
      return { backgroundColor: theme.colors.background };
    case 'midnight':
      return { backgroundColor: '#0B1220' };
    case 'sunset':
      return { backgroundColor: '#2A1628' };
    case 'forest':
      return { backgroundColor: '#10251D' };
    case 'theme':
    default:
      return { backgroundColor: theme.colors.background };
  }
}

export function buildBubbleStyle(theme: any, appearance: ChatAppearance, isOwn: boolean) {
  const preset = isOwn ? appearance.ownBubblePreset : appearance.peerBubblePreset;

  const base = {
    backgroundColor:
      (isOwn ? appearance.customOwnBubbleColor : appearance.customPeerBubbleColor) ||
      (isOwn ? theme.colors.primary : theme.colors.card),
    borderColor: isOwn ? 'transparent' : theme.colors.border,
    borderWidth: 1,
    borderRadius: 24,
  };

  switch (preset) {
    case 'rounded':
      return {
        ...base,
        borderRadius: 30,
      };
    case 'glass':
      return {
        ...base,
        backgroundColor: isOwn ? 'rgba(255,122,0,0.88)' : 'rgba(255,255,255,0.08)',
        borderColor: 'rgba(255,255,255,0.14)',
      };
    case 'soft':
      return {
        ...base,
        backgroundColor: isOwn ? 'rgba(255,122,0,0.18)' : 'rgba(255,255,255,0.05)',
        borderColor: isOwn ? 'rgba(255,122,0,0.22)' : 'rgba(255,255,255,0.10)',
      };
    case 'default':
    default:
      return base;
  }
}

export function buildBubblePreviewStyle(theme: any, preset: BubblePreset, isOwn: boolean) {
  return buildBubbleStyle(
    theme,
    {
      backgroundPreset: 'theme',
      ownBubblePreset: isOwn ? preset : 'default',
      peerBubblePreset: isOwn ? 'default' : preset,
    },
    isOwn
  );
}
