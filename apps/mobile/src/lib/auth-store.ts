import { create } from 'zustand';
import { Platform } from 'react-native';

export type UserRole = 'SPONSOR' | 'BENEFICIARY' | 'MERCHANT' | 'ADMIN';

interface User {
  id: string;
  phone: string;
  firstName: string | null;
  role: UserRole;
  profileId: string;
}

// Storage adapter : localStorage sur web, SecureStore sur native
const storage = {
  get: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') return localStorage.getItem(key);
    const SS = require('expo-secure-store');
    return SS.getItemAsync(key);
  },
  set: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') { localStorage.setItem(key, value); return; }
    const SS = require('expo-secure-store');
    await SS.setItemAsync(key, value);
  },
  del: async (key: string): Promise<void> => {
    if (Platform.OS === 'web') { localStorage.removeItem(key); return; }
    const SS = require('expo-secure-store');
    await SS.deleteItemAsync(key);
  },
};

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  setAuth: (user: User, accessToken: string, refreshToken: string) => Promise<void>;
  clearAuth: () => Promise<void>;
  loadFromStorage: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isLoading: true,

  setAuth: async (user, accessToken, refreshToken) => {
    await storage.set('access_token', accessToken);
    await storage.set('refresh_token', refreshToken);
    await storage.set('user', JSON.stringify(user));
    set({ user, accessToken, refreshToken });
  },

  clearAuth: async () => {
    await storage.del('access_token');
    await storage.del('refresh_token');
    await storage.del('user');
    set({ user: null, accessToken: null, refreshToken: null });
  },

  loadFromStorage: async () => {
    try {
      const [token, refresh, userJson] = await Promise.all([
        storage.get('access_token'),
        storage.get('refresh_token'),
        storage.get('user'),
      ]);
      if (token && userJson) {
        set({ accessToken: token, refreshToken: refresh, user: JSON.parse(userJson) });
      }
    } finally {
      set({ isLoading: false });
    }
  },
}));
