import { create } from 'zustand';
import { clearTokens, getAccessToken, saveTokens } from '@/src/lib/storage/secure.native';

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  hydrated: boolean;
  bootstrap: () => Promise<void>;
  setTokens: (access: string, refresh?: string) => Promise<void>;
  logout: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: null,
  hydrated: false,

  bootstrap: async () => {
    const accessToken = await getAccessToken();
    set({ accessToken, hydrated: true });
  },

  setTokens: async (accessToken, refreshToken) => {
    await saveTokens(accessToken, refreshToken);
    set({ accessToken, refreshToken: refreshToken ?? null, hydrated: true });
  },

  logout: async () => {
    await clearTokens();
    set({ accessToken: null, refreshToken: null, hydrated: true });
  },
}));
