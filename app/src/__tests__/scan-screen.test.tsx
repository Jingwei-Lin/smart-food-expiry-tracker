import { act, render } from '@testing-library/react-native';
import { router } from 'expo-router';

import ScanScreen from '@/app/scan';
import { lookupProduct, type ProductLookupResult } from '@/utils/open-food-facts';

/* The camera's props, so a test can hand it a scanned barcode. */
const mockCamera: { onBarcodeScanned?: (scan: { data: string }) => void } = {};

jest.mock('expo-camera', () => ({
  CameraView: (props: typeof mockCamera) => {
    mockCamera.onBarcodeScanned = props.onBarcodeScanned;
    return null;
  },
  useCameraPermissions: () => [{ granted: true, canAskAgain: true }, jest.fn()],
}));

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn() },
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('@/utils/open-food-facts', () => ({ lookupProduct: jest.fn() }));

const notFound: ProductLookupResult = { outcome: 'not-found' };

/* A lookup the test finishes when it chooses, as a slow network would. */
function slowLookup() {
  let finish: (result: ProductLookupResult) => void = () => undefined;
  jest.mocked(lookupProduct).mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  return (result: ProductLookupResult) => act(async () => finish(result));
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ScanScreen', () => {
  it('opens the add form with the barcode once the lookup finishes', async () => {
    const finishLookup = slowLookup();
    await render(<ScanScreen />);

    await act(async () => mockCamera.onBarcodeScanned?.({ data: '9300000000001' }));
    await finishLookup(notFound);

    expect(router.replace).toHaveBeenCalledWith({
      pathname: '/add',
      params: { barcode: '9300000000001', lookupOutcome: 'not-found' },
    });
  });

  it('does not open the add form if the scanner was closed during the lookup', async () => {
    const finishLookup = slowLookup();
    const view = await render(<ScanScreen />);

    await act(async () => mockCamera.onBarcodeScanned?.({ data: '9300000000001' }));
    await view.unmount();
    await finishLookup(notFound);

    expect(router.replace).not.toHaveBeenCalled();
  });
});
