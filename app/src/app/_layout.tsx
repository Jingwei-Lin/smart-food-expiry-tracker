import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { InventoryProvider } from '@/context/inventory-context';
import { configureExpiryNotificationHandler } from '@/services/expiry-notifications';
import * as Notifications from '@/services/local-notifications';

configureExpiryNotificationHandler();

function openItemFromNotification(notification: Notifications.Notification): boolean {
  const itemId = notification.request.content.data?.itemId;

  if (typeof itemId !== 'string' || !itemId) {
    return false;
  }

  router.push({ pathname: '/item/[id]', params: { id: itemId } });
  return true;
}

/** Opens the relevant item whether the notification launched or resumed the app. */
function useNotificationNavigation(): void {
  useEffect(() => {
    let isMounted = true;

    void Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (isMounted && response && openItemFromNotification(response.notification)) {
          return Notifications.clearLastNotificationResponseAsync();
        }

        return undefined;
      })
      .catch(() => undefined);

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      if (openItemFromNotification(response.notification)) {
        void Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
      }
    });

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, []);
}

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
  useNotificationNavigation();

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

            <Stack.Screen
              name="recipe-settings"
              options={{ title: 'Recipe settings' }}
            />

            <Stack.Screen
              name="saved-recipes"
              options={{ title: 'Saved recipes' }}
            />
          </Stack>

          <StatusBar style="auto" />
        </InventoryProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
