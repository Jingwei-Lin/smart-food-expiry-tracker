import { isRunningInExpoGo } from 'expo';
import * as Notifications from 'expo-notifications';
// Named, because the import lint rule cannot see enums the package re-exports with export *.
import { AndroidImportance, IosAuthorizationStatus } from 'expo-notifications';
import { Platform } from 'react-native';

import { FoodItem } from '@/types/food-item';
import { formatExpiryDate, parseExpiryDate } from '@/utils/expiry-date';

const EXPIRY_CHANNEL_ID = 'expiry-reminders';
const REMINDER_HOUR = 9;
const URGENT_REMINDER_DELAY_MS = 60 * 1000;

export type ReminderScheduleResult =
  | { status: 'scheduled'; notificationIds: string[] }
  | { status: 'permission-denied' }
  | { status: 'not-needed' }
  | { status: 'unsupported' }
  | { status: 'error'; reason: string };

export type ExpiryReminderKind = 'advance' | 'expiry-day';

export type ExpiryReminderPlan = {
  kind: ExpiryReminderKind;
  date: Date;
};

/**
 * Makes reminders visible while the app is open as well as when it is in the
 * background. This is configured once by the root layout.
 */
export function configureExpiryNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/**
 * Calculates the advance and expiry-day reminder times from a date-only value.
 *
 * Reminders normally arrive at 9 am. If the chosen advance time has passed but
 * the item has not expired, it becomes an urgent reminder one minute from now.
 * An item saved on its expiry day receives only the expiry-day reminder, either
 * at 9 am or one minute from now when 9 am has passed.
 */
export function getExpiryReminderPlan(
  expiryDate: string,
  reminderDaysBefore: number,
  now = new Date(),
): ExpiryReminderPlan[] {
  const expiry = parseExpiryDate(expiryDate);

  if (
    !expiry ||
    !Number.isInteger(reminderDaysBefore) ||
    reminderDaysBefore < 1 ||
    reminderDaysBefore > 7
  ) {
    return [];
  }

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (expiry.getTime() < today.getTime()) {
    return [];
  }

  const expiryDayReminder = new Date(expiry);
  expiryDayReminder.setHours(REMINDER_HOUR, 0, 0, 0);

  if (expiry.getTime() === today.getTime()) {
    return [
      {
        kind: 'expiry-day',
        date:
          expiryDayReminder.getTime() > now.getTime()
            ? expiryDayReminder
            : new Date(now.getTime() + URGENT_REMINDER_DELAY_MS),
      },
    ];
  }

  const advanceReminder = new Date(expiry);
  advanceReminder.setDate(advanceReminder.getDate() - reminderDaysBefore);
  advanceReminder.setHours(REMINDER_HOUR, 0, 0, 0);

  if (advanceReminder.getTime() <= now.getTime()) {
    advanceReminder.setTime(now.getTime() + URGENT_REMINDER_DELAY_MS);
  }

  return [
    { kind: 'advance', date: advanceReminder },
    { kind: 'expiry-day', date: expiryDayReminder },
  ];
}

function notificationsAreAllowed(settings: Notifications.NotificationPermissionsStatus): boolean {
  if (settings.granted) {
    return true;
  }

  const iosStatus = settings.ios?.status;

  return (
    iosStatus === IosAuthorizationStatus.AUTHORIZED ||
    iosStatus === IosAuthorizationStatus.PROVISIONAL ||
    iosStatus === IosAuthorizationStatus.EPHEMERAL
  );
}

async function prepareAndroidChannel(): Promise<void> {
  /* Expo Go owns its Android channels; a standalone/dev build owns this one. */
  if (Platform.OS !== 'android' || isRunningInExpoGo()) {
    return;
  }

  await Notifications.setNotificationChannelAsync(EXPIRY_CHANNEL_ID, {
    name: 'Expiry reminders',
    description: 'Reminders for groceries that are close to their expiry date.',
    importance: AndroidImportance.HIGH,
    sound: 'default',
  });
}

async function requestNotificationPermission(): Promise<boolean> {
  await prepareAndroidChannel();

  const currentSettings = await Notifications.getPermissionsAsync();

  if (notificationsAreAllowed(currentSettings)) {
    return true;
  }

  if (!currentSettings.canAskAgain) {
    return false;
  }

  const requestedSettings = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: false,
      allowSound: true,
    },
  });

  return notificationsAreAllowed(requestedSettings);
}

/**
 * Schedules the applicable local reminders and returns enough information for
 * the caller to persist or explain the result. Notification failures never
 * prevent an inventory item from being saved.
 */
export async function scheduleExpiryReminders(
  item: FoodItem,
  now = new Date(),
): Promise<ReminderScheduleResult> {
  if (Platform.OS === 'web') {
    return { status: 'unsupported' };
  }

  const reminderPlan = getExpiryReminderPlan(item.expiryDate, item.reminderDaysBefore, now);

  if (reminderPlan.length === 0) {
    return { status: 'not-needed' };
  }

  const notificationIds: string[] = [];

  try {
    const hasPermission = await requestNotificationPermission();

    if (!hasPermission) {
      return { status: 'permission-denied' };
    }

    for (const reminder of reminderPlan) {
      const isExpiryDay = reminder.kind === 'expiry-day';
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: isExpiryDay ? `${item.name} expires today` : `Use ${item.name} soon`,
          body: isExpiryDay
            ? `Use or review ${item.name} today to avoid wasting it.`
            : `${item.name} expires on ${formatExpiryDate(item.expiryDate)}. Open the app to review it.`,
          data: { itemId: item.id, reminderKind: reminder.kind },
          sound: 'default',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: reminder.date,
          channelId:
            Platform.OS === 'android' && !isRunningInExpoGo() ? EXPIRY_CHANNEL_ID : undefined,
        },
      });

      notificationIds.push(notificationId);
    }

    return { status: 'scheduled', notificationIds };
  } catch (error) {
    await Promise.allSettled(
      notificationIds.map((notificationId) =>
        Notifications.cancelScheduledNotificationAsync(notificationId),
      ),
    );

    const reason = error instanceof Error ? error.message : String(error);

    console.warn('Could not schedule the expiry reminder:', error);
    return { status: 'error', reason };
  }
}

/** Cancels every reminder without turning a successful inventory change into an error. */
export async function cancelExpiryReminders(notificationIds: readonly string[]): Promise<boolean> {
  const results = await Promise.allSettled(
    notificationIds.map((notificationId) =>
      Notifications.cancelScheduledNotificationAsync(notificationId),
    ),
  );

  return results.every((result) => result.status === 'fulfilled');
}
