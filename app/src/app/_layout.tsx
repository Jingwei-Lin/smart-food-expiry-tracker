import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { InventoryProvider } from '@/context/inventory-context';

/**
 * Root navigation layout for the whole app.
 *
 * Everything is a stack over the inventory: the inventory is the only
 * destination, so adding an item and looking at one both push over it. The
 * inventory draws its own title block, so it is rendered without a header.
 *
 * The root view is the gesture handler's, so the swipe on an inventory row is
 * recognised on every platform.
 */
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <InventoryProvider>
          <Stack>
            <Stack.Screen
              name="(tabs)"
              options={{ headerShown: false }}
            />

            <Stack.Screen
              name="scan"
              options={{ title: 'Scan barcode' }}
            />

            <Stack.Screen
              name="add"
              options={{ title: 'Add item' }}
            />

            <Stack.Screen
              name="item/[id]"
              options={{
                title: 'Item',
              }}
            />

            <Stack.Screen
              name="item/edit/[id]"
              options={{ title: 'Edit item' }}
            />
          </Stack>

          <StatusBar style="auto" />
        </InventoryProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
