import { Tabs } from 'expo-router';
import { Colors } from '../../src/constants/theme';

export default function MerchantLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          height: 60,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="index"        options={{ title: 'Accueil',      tabBarIcon: ({ color }) => <TabIcon emoji="🏪" /> }} />
      <Tabs.Screen name="transactions" options={{ title: 'Transactions', tabBarIcon: ({ color }) => <TabIcon emoji="📋" /> }} />
      <Tabs.Screen name="profile"      options={{ title: 'Profil',       tabBarIcon: ({ color }) => <TabIcon emoji="👤" /> }} />
    </Tabs>
  );
}

function TabIcon({ emoji }: { emoji: string }) {
  const { Text } = require('react-native');
  return <Text style={{ fontSize: 20 }}>{emoji}</Text>;
}
