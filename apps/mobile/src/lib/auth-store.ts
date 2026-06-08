import { create } from 'zustand';
import { Platform } from 'react-native';

// SecureStore ne fonctionne pas sur web → fallback localStorage
const storage = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    }
    const SecureStore = await import('expo-secure-store');
    return SecureStore.getItemAsync(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
      return;
    }
    const SecureStore = await import('expo-secure-store');
    await storage.setItem(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
      return;
    }
    const SecureStore = await import('expo-secure-store');
    await storage.removeItem(key);
  },
};

export type UserRole = 'SPONSOR' | 'BENEFICIARY' | 'MERCHANT' | 'ADMIN';

interface User {
  id: string;
  phone: string;
  firstName: string | null;
  role: UserRole;
  profileId: string;
}

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
    await storage.setItem('access_token', accessToken);
    await storage.setItem('refresh_token', refreshToken);
    await storage.setItem('user', JSON.stringify(user));
    set({ user, accessToken, refreshToken });
  },

  clearAuth: async () => {
    await storage.removeItem('access_token');
    await storage.removeItem('refresh_token');
    await storage.removeItem('user');
    set({ user: null, accessToken: null, refreshToken: null });
  },

  loadFromStorage: async () => {
    try {
      const [token, refresh, userJson] = await Promise.all([
        SecureStore.getItemAsync('access_token'),
        SecureStore.getItemAsync('refresh_token'),
        SecureStore.getItemAsync('user'),
      ]);
      if (token && userJson) {
        set({ accessToken: token, refreshToken: refresh, user: JSON.parse(userJson) });
      }
    } finally {
      set({ isLoading: false });
    }
  },
}));
