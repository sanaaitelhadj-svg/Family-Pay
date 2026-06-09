import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '../src/lib/auth-store';

const queryClient = new QueryClient();

export default function RootLayout() {
  const { user, isLoading, loadFromStorage } = useAuthStore();

  useEffect(() => {
    loadFromStorage();
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F8FC' }}>
        <ActivityIndicator size="large" color="#6C47FF" />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ headerShown: false }}>
        {!user ? (
          <Stack.Screen name="(auth)" />
        ) : user.role === 'SPONSOR' ? (
          <Stack.Screen name="(sponsor)" />
        ) : user.role === 'BENEFICIARY' ? (
          <Stack.Screen name="(beneficiary)" />
        ) : (
          <Stack.Screen name="(merchant)" />
        )}
      </Stack>
    </QueryClientProvider>
  );
}
