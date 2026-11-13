/**
 * The parts of expo-notifications that MediKeeper uses: local reminders only.
 *
 * Importing the package's main entry also loads its push-token code, which needs the
 * ExpoApplication native module. Some Expo Go builds don't include it, and the whole
 * notifications package then fails to load. MediKeeper never uses push, so it imports
 * only the local-notification pieces directly.
 */
export { getPresentedNotificationsAsync } from 'expo-notifications/build/getPresentedNotificationsAsync';
export { dismissNotificationAsync } from 'expo-notifications/build/dismissNotificationAsync';
export { setNotificationChannelAsync } from 'expo-notifications/build/setNotificationChannelAsync';
export { getAllScheduledNotificationsAsync } from 'expo-notifications/build/getAllScheduledNotificationsAsync';
export { scheduleNotificationAsync } from 'expo-notifications/build/scheduleNotificationAsync';
export { cancelScheduledNotificationAsync } from 'expo-notifications/build/cancelScheduledNotificationAsync';
export { setNotificationCategoryAsync } from 'expo-notifications/build/setNotificationCategoryAsync';
export {
  addNotificationResponseReceivedListener,
  clearLastNotificationResponseAsync,
  getLastNotificationResponseAsync,
} from 'expo-notifications/build/NotificationsEmitter';
export { setNotificationHandler } from 'expo-notifications/build/NotificationsHandler';
export { getPermissionsAsync, requestPermissionsAsync } from 'expo-notifications/build/NotificationPermissions';
export { AndroidImportance } from 'expo-notifications/build/NotificationChannelManager.types';
export { SchedulableTriggerInputTypes } from 'expo-notifications/build/Notifications.types';
export type { NotificationResponse } from 'expo-notifications/build/Notifications.types';
