import { router } from 'expo-router';

import { goBackOr, returnToInventory } from '@/utils/navigation';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), canGoBack: jest.fn(), replace: jest.fn() },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('goBackOr', () => {
  it('pops the screen when there is one underneath', () => {
    jest.mocked(router.canGoBack).mockReturnValue(true);

    goBackOr('/recipes');

    expect(router.back).toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('opens the fallback when the screen was opened with nothing underneath', () => {
    jest.mocked(router.canGoBack).mockReturnValue(false);

    goBackOr('/recipes');

    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith('/recipes');
  });
});

describe('returnToInventory', () => {
  it('falls back to the inventory', () => {
    jest.mocked(router.canGoBack).mockReturnValue(false);

    returnToInventory();

    expect(router.replace).toHaveBeenCalledWith('/');
  });
});
