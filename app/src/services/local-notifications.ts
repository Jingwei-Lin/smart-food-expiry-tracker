/*
 * The local-notification parts of expo-notifications, imported one file at a
 * time. The package's main entry also loads its push modules, and on Android
 * Expo Go one of them, ExpoTopicSubscriptionModule, doesn't exist: the import
 * throws and the whole app fails to start. SDK 58 only stopped the push-token
 * listener from crashing, not this. Nothing here loads a push module, so every
 * import of expo-notifications in the app goes through this file.
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
