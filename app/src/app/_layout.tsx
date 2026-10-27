import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';

import {
  Fredoka_400Regular,
  Fredoka_500Medium,
  Fredoka_600SemiBold,
  Fredoka_700Bold,
} from '@expo-google-fonts/fredoka';

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

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Fredoka_400Regular,
    Fredoka_500Medium,
    Fredoka_600SemiBold,
    Fredoka_700Bold,
  });

  useNotificationNavigation();

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <InventoryProvider>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

            <Stack.Screen name="scan" options={{ headerShown: false }} />

            <Stack.Screen name="add" options={{ headerShown: false }} />

            <Stack.Screen name="item/[id]" options={{ title: 'Item' }} />

            <Stack.Screen name="item/edit/[id]" options={{ headerShown: false }} />

            <Stack.Screen name="donation-point/[id]" options={{ headerShown: false }} />

            <Stack.Screen name="recipe/[id]" options={{ headerShown: false }} />

            <Stack.Screen name="recipe-settings" options={{ headerShown: false }} />

            <Stack.Screen name="saved-recipes" options={{ headerShown: false }} />
          </Stack>

          <StatusBar style="auto" />
        </InventoryProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
