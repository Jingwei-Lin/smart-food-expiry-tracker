import { render, waitFor } from '@testing-library/react-native';
import { useFonts } from 'expo-font';
import { router } from 'expo-router';

import RootLayout from '@/app/_layout';
import * as Notifications from '@/services/local-notifications';

jest.mock('expo-router', () => {
  function Stack() {
    return null;
  }
  Stack.Screen = function Screen() {
    return null;
  };

  return {
    router: { push: jest.fn() },
    SplashScreen: { preventAutoHideAsync: jest.fn(), hideAsync: jest.fn() },
    Stack,
  };
});

jest.mock('expo-font', () => ({ useFonts: jest.fn() }));

jest.mock('@/context/inventory-context', () => ({
  InventoryProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@/services/expiry-notifications', () => ({
  configureExpiryNotificationHandler: jest.fn(),
}));

jest.mock('@/services/local-notifications', () => ({
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
  getLastNotificationResponseAsync: jest.fn(),
}));

/* The reminder tap that launched the app. */
const launchResponse = {
  notification: { request: { content: { data: { itemId: 'milk' } } } },
};

beforeEach(() => {
  jest.clearAllMocks();
  jest
    .mocked(Notifications.getLastNotificationResponseAsync)
    .mockResolvedValue(launchResponse as never);
});

describe('RootLayout opening a reminder that launched the app', () => {
  it('waits for the layout to render its navigator before opening the item', async () => {
    jest.mocked(useFonts).mockReturnValue([false, null]);
    const view = await render(<RootLayout />);

    expect(Notifications.getLastNotificationResponseAsync).not.toHaveBeenCalled();

    jest.mocked(useFonts).mockReturnValue([true, null]);
    await view.rerender(<RootLayout />);

    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith({ pathname: '/item/[id]', params: { id: 'milk' } }),
    );
    expect(Notifications.clearLastNotificationResponseAsync).toHaveBeenCalled();
  });

  it('still opens the item when the fonts fail and the system font is used', async () => {
    jest.mocked(useFonts).mockReturnValue([false, new Error('font failed')]);
    await render(<RootLayout />);

    await waitFor(() => expect(router.push).toHaveBeenCalled());
  });
});
