/*
 * AsyncStorage has no native module under Jest, so every test runs against the
 * package's own in-memory mock. Each test file starts from an empty store.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

/*
 * SecureStore has no native module under Jest either, and ships no mock, so
 * this in-memory stand-in keeps the same async API. It is emptied before every
 * test, so no test can see a key another one saved.
 */
const mockSecureStoreItems = new Map<string, string>();

/*
 * Mock Expo icons so Jest doesn't try to load native font assets.
 */
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');

  const MockIcon = (props: { name?: string }) =>
    React.createElement(Text, null, props.name ?? 'icon');

  return {
    Ionicons: MockIcon,
    MaterialIcons: MockIcon,
    MaterialCommunityIcons: MockIcon,
    FontAwesome: MockIcon,
    Feather: MockIcon,
  };
});

/*
 * Mock lucide icons so Jest doesn't try to load ESM/native SVG modules.
 */
jest.mock('lucide-react-native', () => {
  const React = require('react');
  const { View } = require('react-native');

  const MockIcon = () => React.createElement(View, null);

  return new Proxy(
    {},
    {
      get: (_target, name) =>
        name === '__esModule'
          ? false
          : MockIcon,
    },
  );
});

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockSecureStoreItems.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockSecureStoreItems.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockSecureStoreItems.delete(key);
  }),
}));

beforeEach(() => {
  mockSecureStoreItems.clear();
});
