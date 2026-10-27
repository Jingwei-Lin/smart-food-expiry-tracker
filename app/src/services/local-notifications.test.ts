/*
 * The package's main entry loads push modules that Android Expo Go lacks, so
 * loading it there stops the app from starting. Here it throws if anything loads it.
 */
jest.mock('expo-notifications', () => {
  throw new Error('expo-notifications main entry loaded');
});

describe('local-notifications', () => {
  it('loads without the package main entry', () => {
    expect(() => jest.requireActual('@/services/local-notifications')).not.toThrow();
  });

  it('has every function the reminders use', () => {
    const notifications = jest.requireActual<typeof import('@/services/local-notifications')>(
      '@/services/local-notifications',
    );

    expect(typeof notifications.scheduleNotificationAsync).toBe('function');
    expect(typeof notifications.cancelScheduledNotificationAsync).toBe('function');
    expect(typeof notifications.getLastNotificationResponseAsync).toBe('function');
    expect(notifications.SchedulableTriggerInputTypes.DATE).toBe('date');
  });
});
