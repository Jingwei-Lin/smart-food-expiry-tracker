/*
 * AsyncStorage has no native module under Jest, so every test runs against the
 * package's own in-memory mock. Each test file starts from an empty store.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
