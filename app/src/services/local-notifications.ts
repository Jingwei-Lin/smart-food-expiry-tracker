/*
 * Expo Notifications 57's public entry point starts push-token registration
 * while it is imported. That crashes Android Expo Go even when an app only
 * uses local notifications (Expo issue #49062, fixed in SDK 58). Importing the
 * local-only entry points avoids that push side effect until this app upgrades.
 */
export { cancelScheduledNotificationAsync } from 'expo-notifications/build/cancelScheduledNotificationAsync';
export {
  addNotificationResponseReceivedListener,
  clearLastNotificationResponseAsync,
  getLastNotificationResponseAsync,
} from 'expo-notifications/build/NotificationsEmitter';
export { setNotificationHandler } from 'expo-notifications/build/NotificationsHandler';
export {
  getPermissionsAsync,
  requestPermissionsAsync,
} from 'expo-notifications/build/NotificationPermissions';
export { setNotificationChannelAsync } from 'expo-notifications/build/setNotificationChannelAsync';
export { scheduleNotificationAsync } from 'expo-notifications/build/scheduleNotificationAsync';

export { AndroidImportance } from 'expo-notifications/build/NotificationChannelManager.types';
export {
  IosAuthorizationStatus,
  type NotificationPermissionsStatus,
} from 'expo-notifications/build/NotificationPermissions.types';
export {
  type Notification,
  SchedulableTriggerInputTypes,
} from 'expo-notifications/build/Notifications.types';
