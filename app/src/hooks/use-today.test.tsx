import { act, render } from '@testing-library/react-native';
import { AppState, AppStateStatus, Text } from 'react-native';

import { useToday } from '@/hooks/use-today';

const mockFocus: { effect: (() => void) | null } = { effect: null };

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');

  return {
    useFocusEffect: (effect: () => void) =>
      useEffect(() => {
        mockFocus.effect = effect;
        effect();
      }, [effect]),
  };
});

let appStateListener: ((state: AppStateStatus) => void) | null = null;
const seenDates: Date[] = [];

function ShowToday() {
  const today = useToday();
  seenDates.push(today);

  return <Text>{today.toDateString()}</Text>;
}

beforeEach(() => {
  seenDates.length = 0;
  jest.useFakeTimers({ now: new Date(2026, 9, 18, 23, 0), advanceTimers: true });
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    appStateListener = listener;
    return { remove: jest.fn() } as unknown as ReturnType<typeof AppState.addEventListener>;
  });
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('useToday', () => {
  it('starts on the current day', async () => {
    const view = await render(<ShowToday />);

    expect(view.getByText('Sun Oct 18 2026')).toBeTruthy();
  });

  it('moves to the new day when the screen comes back into view', async () => {
    const view = await render(<ShowToday />);

    jest.setSystemTime(new Date(2026, 9, 19, 0, 30));
    await act(async () => {
      mockFocus.effect?.();
    });

    expect(view.getByText('Mon Oct 19 2026')).toBeTruthy();
  });

  it('moves to the new day when the app returns to the foreground', async () => {
    const view = await render(<ShowToday />);

    jest.setSystemTime(new Date(2026, 9, 19, 8, 0));
    await act(async () => {
      appStateListener?.('active');
    });

    expect(view.getByText('Mon Oct 19 2026')).toBeTruthy();
  });

  it('keeps the same date within a day, so screens do not re-render for nothing', async () => {
    await render(<ShowToday />);
    const first = seenDates[seenDates.length - 1];

    jest.setSystemTime(new Date(2026, 9, 18, 23, 59));
    await act(async () => {
      mockFocus.effect?.();
      appStateListener?.('active');
    });

    expect(seenDates[seenDates.length - 1]).toBe(first);
  });
});
