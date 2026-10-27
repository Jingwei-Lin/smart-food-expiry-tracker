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
 * The icon font cannot load under Jest. The stand-in is an empty View rather
 * than text, so an icon's name can never be matched by a getByText query.
 */
jest.mock('@expo/vector-icons', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');

  return { Ionicons: () => createElement(View) };
});

/*
 * lucide-react-native ships only as an ES module, which Jest on older Node
 * versions cannot load. Any icon imported from it becomes an empty View.
 */
jest.mock('lucide-react-native', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');

  const MockIcon = () => createElement(View, null);

  return new Proxy(
    {},
    {
      get: (_target, name) => (name === '__esModule' ? false : MockIcon),
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
