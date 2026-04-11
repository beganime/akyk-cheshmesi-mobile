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
};

export const DEFAULT_CHAT_APPEARANCE: ChatAppearance = {
  backgroundPreset: 'theme',
  ownBubblePreset: 'default',
  peerBubblePreset: 'default',
};

const STORAGE_KEY = 'chat_appearance_v1';

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
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return DEFAULT_CHAT_APPEARANCE;
    }

    const parsed = JSON.parse(raw);

    return {
      backgroundPreset: normalizeBackgroundPreset(parsed?.backgroundPreset),
      ownBubblePreset: normalizeBubblePreset(parsed?.ownBubblePreset),
      peerBubblePreset: normalizeBubblePreset(parsed?.peerBubblePreset),
    };
  } catch {
    return DEFAULT_CHAT_APPEARANCE;
  }
}

export async function saveChatAppearance(nextValue: ChatAppearance) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextValue));
}

export function buildChatBackgroundStyle(theme: any, appearance: ChatAppearance) {
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
    backgroundColor: isOwn ? theme.colors.primary : theme.colors.card,
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