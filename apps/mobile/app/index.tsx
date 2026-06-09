import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../src/lib/auth-store';

export default function RootIndex() {
  const router = useRouter();
  const { user, isLoading } = useAuthStore();

  useEffect(() => {
    if (isLoading) return;
    if (!user) { router.replace('/(auth)'); return; }
    switch (user.role) {
      case 'SPONSOR':     router.replace('/(sponsor)');     break;
      case 'BENEFICIARY': router.replace('/(beneficiary)'); break;
      case 'MERCHANT':    router.replace('/(merchant)');    break;
      default:            router.replace('/(auth)');
    }
  }, [user, isLoading]);

  return null;
}
