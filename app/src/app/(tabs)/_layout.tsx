import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

/**
 * Bottom tab bar.
 *
 * Defines the app's top-level destinations and their labels and icons.
 * Add a screen here to give it a tab; screens reached from within a tab,
 * such as item detail, belong in the parent stack instead.
 */
export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#2f7d32' }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inventory',
          tabBarIcon: ({ color, size }) => <Ionicons name="list" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: 'Add / Scan',
          tabBarIcon: ({ color, size }) => <Ionicons name="add-circle" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
