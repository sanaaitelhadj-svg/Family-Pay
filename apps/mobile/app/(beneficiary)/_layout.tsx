import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/theme';

function TabIcon({ icon, label, focused }: { icon: string; label: string; focused: boolean }) {
  return (
    <View style={styles.tabItem}>
      <Text style={[styles.tabIcon, focused && styles.tabIconActive]}>{icon}</Text>
      <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>{label}</Text>
    </View>
  );
}

export default function BeneficiaryLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarStyle: styles.tabBar,
      tabBarShowLabel: false,
    }}>
      <Tabs.Screen name="index"        options={{ tabBarIcon: ({ focused }) => <TabIcon icon="💳" label="Allocations" focused={focused} /> }} />
      <Tabs.Screen name="scan"         options={{ tabBarIcon: ({ focused }) => <TabIcon icon="📷" label="Scanner"     focused={focused} /> }} />
      <Tabs.Screen name="merchants"    options={{ tabBarIcon: ({ focused }) => <TabIcon icon="🏬" label="Marchands"   focused={focused} /> }} />
      <Tabs.Screen name="transactions" options={{ tabBarIcon: ({ focused }) => <TabIcon icon="📋" label="Transactions" focused={focused} /> }} />
      <Tabs.Screen name="profile"      options={{ tabBarIcon: ({ focused }) => <TabIcon icon="👤" label="Profil"      focused={focused} /> }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar:        { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#ECECF2', height: 72, paddingBottom: 8 },
  tabItem:       { alignItems: 'center', justifyContent: 'center', paddingTop: 4 },
  tabIcon:       { fontSize: 22, opacity: 0.4 },
  tabIconActive: { opacity: 1 },
  tabLabel:      { fontSize: 10, color: '#9CA3AF', marginTop: 2, fontWeight: '500' },
  tabLabelActive:{ color: Colors.primary, fontWeight: '700' },
});
