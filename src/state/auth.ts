import { create } from 'zustand';

import { fetchMe } from '@/src/lib/api/auth';
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  saveAccessToken,
  saveTokens,
} from '@/src/lib/storage/secure';
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
  setTokens: (params: {
    accessToken: string;
    refreshToken?: string;
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

      if (!accessToken && !refreshToken) {
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          hydrated: true,
        });
        return;
      }

      set({
        accessToken: accessToken ?? null,
        refreshToken: refreshToken ?? null,
        user: null,
        hydrated: false,
      });

      try {
        const user = await fetchMe();
        const [latestAccessToken, latestRefreshToken] = await Promise.all([
          getAccessToken(),
          getRefreshToken(),
        ]);

        set({
          accessToken: latestAccessToken ?? accessToken ?? null,
          refreshToken: latestRefreshToken ?? refreshToken ?? null,
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

  setTokens: async ({ accessToken, refreshToken }) => {
    if (typeof refreshToken === 'string' && refreshToken.length > 0) {
      await saveTokens(accessToken, refreshToken);
      set((state) => ({
        accessToken,
        refreshToken,
        user: state.user,
        hydrated: true,
      }));
      return;
    }

    await saveAccessToken(accessToken);

    set((state) => ({
      accessToken,
      refreshToken: state.refreshToken,
      user: state.user,
      hydrated: true,
    }));
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