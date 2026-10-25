import { fireEvent, render } from '@testing-library/react-native';

import AddItemScreen from '@/app/add';

const mockRouteParams: { current: Record<string, string> } = {
  current: {},
};
const mockAddItem = jest.fn().mockResolvedValue(undefined);

jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
    replace: jest.fn(),
  },
  useLocalSearchParams: () => mockRouteParams.current,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('@/context/inventory-context', () => ({
  useInventory: () => ({
    addItem: mockAddItem,
    isStorageReady: true,
    storageError: null,
  }),
}));

jest.mock('@/utils/navigation', () => ({
  returnToInventory: jest.fn(),
}));

jest.mock('@/components/item-form', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const ReactNative =
    jest.requireActual<typeof import('react-native')>('react-native');

  function MockItemForm({
    initialValues,
    onSubmit,
  }: {
    initialValues: {
      name: string;
      quantity: string;
      expiryDate: string;
      reminderDaysBefore: number;
      notes: string;
      storageLocation?: 'fridge';
      category?: string;
    };
    onSubmit: (values: {
      name: string;
      quantity: string;
      expiryDate: string;
      reminderDaysBefore: number;
      notes: string;
      storageLocation?: 'fridge';
      category?: string;
    }) => Promise<void>;
  }) {
    const [category] = React.useState(initialValues.category);

    return React.createElement(
      ReactNative.View,
      null,
      React.createElement(
        ReactNative.Text,
        { accessibilityLabel: 'Selected food category' },
        category,
      ),
      React.createElement(
        ReactNative.Pressable,
        {
          accessibilityRole: 'button',
          accessibilityLabel: 'Submit item',
          onPress: () => {
            void onSubmit({ ...initialValues, category });
          },
        },
        React.createElement(ReactNative.Text, null, 'Submit'),
      ),
    );
  }

  return { ItemForm: MockItemForm };
});

beforeEach(() => {
  mockRouteParams.current = {
    barcode: 'first-barcode',
    name: 'Fish',
    category: 'Seafood',
  };
  mockAddItem.mockClear();
});

it('uses the latest scanned category when saving an item', async () => {
  const view = await render(<AddItemScreen />);

  expect(view.getByLabelText('Selected food category').props.children).toBe(
    'Seafood',
  );

  mockRouteParams.current = {
    barcode: 'second-barcode',
    name: 'Milk',
    category: 'Dairy',
  };
  await view.rerender(<AddItemScreen />);

  expect(view.getByLabelText('Selected food category').props.children).toBe(
    'Dairy',
  );

  await fireEvent.press(view.getByLabelText('Submit item'));

  expect(mockAddItem).toHaveBeenCalledWith(
    expect.objectContaining({
      name: 'Milk',
      category: 'Dairy',
      barcode: 'second-barcode',
    }),
  );
});
