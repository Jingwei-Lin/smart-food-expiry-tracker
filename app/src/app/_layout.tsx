import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

/**
 * Root navigation layout for the whole app.
 *
 * Wraps everything in a stack navigator so that detail screens push over the
 * tab bar, and supplies safe-area insets and the status bar. The tab group
 * draws its own headers, so it is rendered without one here.
 */
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="item/[id]" options={{ title: 'Item' }} />
      </Stack>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
