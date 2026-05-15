import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '@/lib/auth-store';

export default function Index() {
  const { user, isLoading } = useAuthStore();

  if (isLoading) {
    return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color="#1B4FD8" /></View>;
  }
  if (!user) return <Redirect href="/(auth)/" />;
  if (user.role === 'SPONSOR') return <Redirect href="/(sponsor)/" />;
  if (user.role === 'BENEFICIARY') return <Redirect href="/(beneficiary)/" />;
  return <Redirect href="/(auth)/" />;
}
