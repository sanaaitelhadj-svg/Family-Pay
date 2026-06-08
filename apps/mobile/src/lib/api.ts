import axios from 'axios';
import { Platform } from 'react-native';

const getToken = async (key: string) => {
  if (Platform.OS === 'web') return localStorage.getItem(key);
  const SecureStore = await import('expo-secure-store');
  return SecureStore.getItemAsync(key);
};
const removeToken = async (key: string) => {
  if (Platform.OS === 'web') { localStorage.removeItem(key); return; }
  const SecureStore = await import('expo-secure-store');
  await SecureStore.deleteItemAsync(key);
};

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export const api = axios.create({ baseURL: BASE_URL, timeout: 10_000 });

api.interceptors.request.use(async (config) => {
  const token = await getToken('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refresh = await SecureStore.getItemAsync('refresh_token');
        if (!refresh) throw new Error('no refresh token');
        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken: refresh });
        await SecureStore.setItemAsync('access_token', data.accessToken);
        await SecureStore.setItemAsync('refresh_token', data.refreshToken);
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return axios(original);
      } catch {
        await removeToken('access_token');
        await removeToken('refresh_token');
      }
    }
    return Promise.reject(error);
  },
);

export const apiClient = api;
