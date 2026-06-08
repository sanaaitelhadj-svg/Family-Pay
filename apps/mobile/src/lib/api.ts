import axios from 'axios';
import { Platform } from 'react-native';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

const getStorageItem = async (key: string): Promise<string | null> => {
  if (Platform.OS === 'web') return localStorage.getItem(key);
  const SS = require('expo-secure-store');
  return SS.getItemAsync(key);
};
const removeStorageItem = async (key: string): Promise<void> => {
  if (Platform.OS === 'web') { localStorage.removeItem(key); return; }
  const SS = require('expo-secure-store');
  await SS.deleteItemAsync(key);
};

export const api = axios.create({ baseURL: BASE_URL, timeout: 10_000 });
export const apiClient = api;

api.interceptors.request.use(async (config) => {
  const token = await getStorageItem('access_token');
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
        const refresh = await getStorageItem('refresh_token');
        if (!refresh) throw new Error('no refresh token');
        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken: refresh });
        await (Platform.OS === 'web'
          ? (localStorage.setItem('access_token', data.accessToken), localStorage.setItem('refresh_token', data.refreshToken))
          : Promise.all([
              require('expo-secure-store').setItemAsync('access_token', data.accessToken),
              require('expo-secure-store').setItemAsync('refresh_token', data.refreshToken),
            ]));
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return axios(original);
      } catch {
        await removeStorageItem('access_token');
        await removeStorageItem('refresh_token');
      }
    }
    return Promise.reject(error);
  },
);
