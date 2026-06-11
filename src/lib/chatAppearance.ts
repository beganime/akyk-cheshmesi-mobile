import AsyncStorage from '@react-native-async-storage/async-storage';

export type ChatBackgroundPreset =
  | 'gradient'
  | 'solid'
  | 'light'
  | 'dark'
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

export type TextSizePreset = 'small' | 'normal' | 'large';
export type MessageSizePreset = 'compact' | 'normal' | 'spacious';
export type CardRadiusPreset = 'standard' | 'soft' | 'large';
export type ColorStylePreset = 'green';

export type ChatAppearance = {
  backgroundPreset: ChatBackgroundPreset;
  ownBubblePreset: BubblePreset;
  peerBubblePreset: BubblePreset;
  colorStyle: ColorStylePreset;
  textSize: TextSizePreset;
  messageSize: MessageSizePreset;
  cardRadius: CardRadiusPreset;
  customBackgroundColor?: string | null;
  customOwnBubbleColor?: string | null;
  customPeerBubbleColor?: string | null;
  backgroundImageUri?: string | null;
  backgroundSizeMode?: 'cover' | 'contain';
  gradientPreset?: 'none' | 'sunrise' | 'ocean' | 'violet';
};

export const DEFAULT_CHAT_APPEARANCE: ChatAppearance = {
  backgroundPreset: 'gradient',
  ownBubblePreset: 'default',
  peerBubblePreset: 'default',
  colorStyle: 'green',
  textSize: 'normal',
  messageSize: 'normal',
  cardRadius: 'soft',
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
    case 'gradient':
    case 'solid':
    case 'light':
    case 'dark':
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

function normalizeTextSize(value: unknown): TextSizePreset {
  return value === 'small' || value === 'large' || value === 'normal'
    ? value
    : DEFAULT_CHAT_APPEARANCE.textSize;
}

function normalizeMessageSize(value: unknown): MessageSizePreset {
  return value === 'compact' || value === 'spacious' || value === 'normal'
    ? value
    : DEFAULT_CHAT_APPEARANCE.messageSize;
}

function normalizeCardRadius(value: unknown): CardRadiusPreset {
  return value === 'standard' || value === 'large' || value === 'soft'
    ? value
    : DEFAULT_CHAT_APPEARANCE.cardRadius;
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
    colorStyle: 'green',
    textSize: normalizeTextSize(value?.textSize),
    messageSize: normalizeMessageSize(value?.messageSize),
    cardRadius: normalizeCardRadius(value?.cardRadius),
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
    case 'gradient':
      return { backgroundColor: theme.colors.backgroundTertiary };
    case 'solid':
      return { backgroundColor: theme.colors.backgroundSecondary };
    case 'light':
      return { backgroundColor: '#F4FFF8' };
    case 'dark':
      return { backgroundColor: '#061A12' };
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

export function getTextScale(appearance: ChatAppearance) {
  if (appearance.textSize === 'small') return 0.94;
  if (appearance.textSize === 'large') return 1.1;
  return 1;
}

export function getMessagePadding(appearance: ChatAppearance) {
  if (appearance.messageSize === 'compact') {
    return { paddingHorizontal: 11, paddingVertical: 7 };
  }

  if (appearance.messageSize === 'spacious') {
    return { paddingHorizontal: 16, paddingVertical: 12 };
  }

  return { paddingHorizontal: 14, paddingVertical: 9 };
}

export function getCardRadius(appearance: ChatAppearance) {
  if (appearance.cardRadius === 'standard') return 18;
  if (appearance.cardRadius === 'large') return 30;
  return 24;
}

export function buildBubbleStyle(theme: any, appearance: ChatAppearance, isOwn: boolean) {
  const preset = isOwn ? appearance.ownBubblePreset : appearance.peerBubblePreset;
  const radius = getCardRadius(appearance);

  const base = {
    backgroundColor:
      (isOwn ? appearance.customOwnBubbleColor : appearance.customPeerBubbleColor) ||
      (isOwn ? theme.colors.primary : theme.colors.card),
    borderColor: isOwn ? 'transparent' : theme.colors.border,
    borderWidth: 1,
    borderRadius: radius,
    ...getMessagePadding(appearance),
  };

  switch (preset) {
    case 'rounded':
      return {
        ...base,
        borderRadius: Math.max(30, radius + 6),
      };
    case 'glass':
      return {
        ...base,
        backgroundColor: isOwn ? 'rgba(15,157,88,0.90)' : theme.colors.card,
        borderColor: theme.colors.borderStrong,
      };
    case 'soft':
      return {
        ...base,
        backgroundColor: isOwn ? theme.colors.primarySoft : theme.colors.cardStrong,
        borderColor: isOwn ? theme.colors.primary : theme.colors.borderStrong,
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
      ...DEFAULT_CHAT_APPEARANCE,
      backgroundPreset: 'gradient',
      ownBubblePreset: isOwn ? preset : 'default',
      peerBubblePreset: isOwn ? 'default' : preset,
    },
    isOwn
  );
}
