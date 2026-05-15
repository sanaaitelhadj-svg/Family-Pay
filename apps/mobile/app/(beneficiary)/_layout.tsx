import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function BeneficiaryLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#4f46e5', headerShown: false }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Allocations', tabBarIcon: ({ color, size }) => <Ionicons name="card-outline" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="scan"
        options={{ title: 'Scanner', tabBarIcon: ({ color, size }) => <Ionicons name="qr-code-outline" size={size} color={color} /> }}
      />
    </Tabs>
  );
}
