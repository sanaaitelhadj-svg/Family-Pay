import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function SponsorLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#4f46e5', headerShown: false }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Allocations', tabBarIcon: ({ color, size }) => <Ionicons name="wallet-outline" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="create-allocation"
        options={{ title: 'Créer', tabBarIcon: ({ color, size }) => <Ionicons name="add-circle-outline" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="invite"
        options={{ title: 'Inviter', tabBarIcon: ({ color, size }) => <Ionicons name="person-add-outline" size={size} color={color} /> }}
      />
    </Tabs>
  );
}
