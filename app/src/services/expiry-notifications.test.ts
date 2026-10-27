import { isRunningInExpoGo, PermissionStatus } from 'expo';
import { Platform } from 'react-native';

import {
  cancelExpiryReminders,
  getExpiryReminderPlan,
  scheduleExpiryReminders,
} from '@/services/expiry-notifications';
import * as Notifications from '@/services/local-notifications';
import { FoodItem } from '@/types/food-item';

jest.mock('@/services/local-notifications', () => ({
  AndroidImportance: { HIGH: 4 },
  IosAuthorizationStatus: {
    AUTHORIZED: 2,
    PROVISIONAL: 3,
    EPHEMERAL: 4,
  },
  SchedulableTriggerInputTypes: { DATE: 'date' },
  cancelScheduledNotificationAsync: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  setNotificationHandler: jest.fn(),
}));

jest.mock('expo', () => ({
  ...jest.requireActual('expo'),
  isRunningInExpoGo: jest.fn(() => false),
}));

const item: FoodItem = {
  id: 'item-1',
  name: 'Milk',
  quantity: '2 L',
  expiryDate: '2026-09-20',
  storageLocation: 'fridge',
  reminderDaysBefore: 1,
  reminderRuleVersion: 2,
  notes: '',
  createdAt: '2026-09-18T00:00:00.000Z',
  status: 'active',
};

const getPermissionsMock = jest.mocked(Notifications.getPermissionsAsync);
const requestPermissionsMock = jest.mocked(Notifications.requestPermissionsAsync);
const scheduleNotificationMock = jest.mocked(Notifications.scheduleNotificationAsync);
const cancelNotificationMock = jest.mocked(Notifications.cancelScheduledNotificationAsync);
const setNotificationChannelMock = jest.mocked(Notifications.setNotificationChannelAsync);
const isRunningInExpoGoMock = jest.mocked(isRunningInExpoGo);

beforeEach(() => {
  jest.clearAllMocks();
  isRunningInExpoGoMock.mockReturnValue(false);
  getPermissionsMock.mockResolvedValue({
    status: PermissionStatus.GRANTED,
    granted: true,
    canAskAgain: true,
    expires: 'never',
  });
  scheduleNotificationMock
    .mockResolvedValueOnce('advance-notification')
    .mockResolvedValueOnce('expiry-notification');
  cancelNotificationMock.mockResolvedValue();
});

describe('getExpiryReminderPlan', () => {
  it('uses the selected advance day and the expiry day at 9 am', () => {
    const reminders = getExpiryReminderPlan('2026-09-20', 1, new Date(2026, 8, 18, 12, 0, 0));

    expect(reminders).toEqual([
      { kind: 'advance', date: new Date(2026, 8, 19, 9, 0, 0) },
      { kind: 'expiry-day', date: new Date(2026, 8, 20, 9, 0, 0) },
    ]);
  });

  it('supports a custom reminder up to seven days before expiry', () => {
    const reminders = getExpiryReminderPlan('2026-09-20', 7, new Date(2026, 8, 10, 12, 0, 0));

    expect(reminders[0]).toEqual({
      kind: 'advance',
      date: new Date(2026, 8, 13, 9, 0, 0),
    });
  });

  it('schedules an urgent advance reminder when its normal time has passed', () => {
    const now = new Date(2026, 8, 19, 12, 0, 0);

    expect(getExpiryReminderPlan('2026-09-20', 1, now)).toEqual([
      { kind: 'advance', date: new Date(now.getTime() + 60 * 1000) },
      { kind: 'expiry-day', date: new Date(2026, 8, 20, 9, 0, 0) },
    ]);
  });

  it('schedules only the mandatory notification for an item expiring today', () => {
    const now = new Date(2026, 8, 20, 12, 0, 0);

    expect(getExpiryReminderPlan('2026-09-20', 3, now)).toEqual([
      { kind: 'expiry-day', date: new Date(now.getTime() + 60 * 1000) },
    ]);
  });

  it.each([
    ['2026-09-17', 1],
    ['not-a-date', 1],
    ['2026-09-20', 0],
    ['2026-09-20', 8],
  ] as const)('does not remind for %s with %s days notice', (expiryDate, days) => {
    expect(getExpiryReminderPlan(expiryDate, days, new Date(2026, 8, 18, 12, 0, 0))).toEqual([]);
  });
});

describe('scheduleExpiryReminders', () => {
  it('schedules advance and expiry-day notifications that deep-link to the item', async () => {
    const result = await scheduleExpiryReminders(item, new Date(2026, 8, 18, 12, 0, 0));

    expect(result).toEqual({
      status: 'scheduled',
      notificationIds: ['advance-notification', 'expiry-notification'],
    });
    expect(scheduleNotificationMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        content: expect.objectContaining({
          data: { itemId: 'item-1', reminderKind: 'advance' },
        }),
        trigger: expect.objectContaining({
          date: new Date(2026, 8, 19, 9, 0, 0),
          type: 'date',
        }),
      }),
    );
    expect(scheduleNotificationMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        content: expect.objectContaining({
          title: 'Milk expires today',
          data: { itemId: 'item-1', reminderKind: 'expiry-day' },
        }),
        trigger: expect.objectContaining({
          date: new Date(2026, 8, 20, 9, 0, 0),
          type: 'date',
        }),
      }),
    );
  });

  it('requests permission and reports when the user declines', async () => {
    getPermissionsMock.mockResolvedValue({
      status: PermissionStatus.UNDETERMINED,
      granted: false,
      canAskAgain: true,
      expires: 'never',
    });
    requestPermissionsMock.mockResolvedValue({
      status: PermissionStatus.DENIED,
      granted: false,
      canAskAgain: false,
      expires: 'never',
    });

    await expect(scheduleExpiryReminders(item, new Date(2026, 8, 18, 12, 0, 0))).resolves.toEqual({
      status: 'permission-denied',
    });
    expect(scheduleNotificationMock).not.toHaveBeenCalled();
  });

  it('cancels the first reminder if scheduling the second reminder fails', async () => {
    const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();
    scheduleNotificationMock.mockReset();
    scheduleNotificationMock
      .mockResolvedValueOnce('advance-notification')
      .mockRejectedValueOnce(new Error('native failure'));

    await expect(scheduleExpiryReminders(item, new Date(2026, 8, 18, 12, 0, 0))).resolves.toEqual({
      status: 'error',
      reason: 'native failure',
    });
    expect(cancelNotificationMock).toHaveBeenCalledWith('advance-notification');
    consoleWarn.mockRestore();
  });

  it('uses Expo Go default Android notification settings when running in Expo Go', async () => {
    const platformReplacement = jest.replaceProperty(Platform, 'OS', 'android');
    isRunningInExpoGoMock.mockReturnValue(true);

    try {
      await scheduleExpiryReminders(item, new Date(2026, 8, 18, 12, 0, 0));

      expect(setNotificationChannelMock).not.toHaveBeenCalled();
      expect(scheduleNotificationMock).toHaveBeenCalledWith(
        expect.objectContaining({
          trigger: expect.objectContaining({ channelId: undefined }),
        }),
      );
    } finally {
      platformReplacement.restore();
    }
  });
});

describe('cancelExpiryReminders', () => {
  it('cancels all stored notification identifiers', async () => {
    await expect(
      cancelExpiryReminders(['advance-notification', 'expiry-notification']),
    ).resolves.toBe(true);
    expect(cancelNotificationMock).toHaveBeenNthCalledWith(1, 'advance-notification');
    expect(cancelNotificationMock).toHaveBeenNthCalledWith(2, 'expiry-notification');
  });

  it('reports cancellation failure without throwing', async () => {
    cancelNotificationMock.mockRejectedValue(new Error('native failure'));

    await expect(cancelExpiryReminders(['notification-1'])).resolves.toBe(false);
  });
});
