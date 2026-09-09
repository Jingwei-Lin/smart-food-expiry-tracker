import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { InventoryProvider } from '@/context/inventory-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <InventoryProvider>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

          <Stack.Screen
            name="item/[id]"
            options={{
              title: 'Item',
            }}
          />
        </Stack>

        <StatusBar style="auto" />
      </InventoryProvider>
    </SafeAreaProvider>
  );
}