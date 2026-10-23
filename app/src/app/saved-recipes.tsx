
export default function RootLayout() {
  useNotificationNavigation();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <InventoryProvider>
          <Stack
            screenOptions={{
              contentStyle: {
                backgroundColor: '#FFFCF3',
              },
              headerStyle: {
                backgroundColor: '#FFFCF3',
              },
              headerTintColor: '#202D19',
              headerTitleStyle: {
                color: '#202D19',
                fontWeight: '600',
              },
              headerShadowVisible: false,
            }}
          >
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
              options={{ title: 'Item' }}
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

          <StatusBar style="dark" />
        </InventoryProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
