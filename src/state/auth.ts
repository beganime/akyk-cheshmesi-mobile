import { create } from 'zustand';
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  saveTokens,
} from '@/src/lib/storage/secure';
import { fetchMe } from '@/src/lib/api/auth';
import type { UserProfile } from '@/src/types/user';

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  user: UserProfile | null;
  hydrated: boolean;
  bootstrap: () => Promise<void>;
  setSession: (params: {
    accessToken: string;
    refreshToken?: string | null;
    user: UserProfile | null;
  }) => Promise<void>;
  refreshProfile: () => Promise<void>;
  logout: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  hydrated: false,

  bootstrap: async () => {
    try {
      const [accessToken, refreshToken] = await Promise.all([
        getAccessToken(),
        getRefreshToken(),
      ]);

      if (!accessToken) {
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          hydrated: true,
        });
        return;
      }

      set({
        accessToken,
        refreshToken,
        hydrated: false,
      });

      try {
        const user = await fetchMe();

        set({
          accessToken,
          refreshToken,
          user,
          hydrated: true,
        });
      } catch (error) {
        console.error('Bootstrap /users/me error:', error);

        await clearTokens();

        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          hydrated: true,
        });
      }
    } catch (error) {
      console.error('Auth bootstrap error:', error);

      set({
        accessToken: null,
        refreshToken: null,
        user: null,
        hydrated: true,
      });
    }
  },

  setSession: async ({ accessToken, refreshToken, user }) => {
    await saveTokens(accessToken, refreshToken ?? undefined);

    set({
      accessToken,
      refreshToken: refreshToken ?? null,
      user,
      hydrated: true,
    });
  },

  refreshProfile: async () => {
    try {
      const user = await fetchMe();
      set({ user });
    } catch (error) {
      console.error('refreshProfile error:', error);
    }
  },

  logout: async () => {
    await clearTokens();

    set({
      accessToken: null,
      refreshToken: null,
      user: null,
      hydrated: true,
    });
  },
}));