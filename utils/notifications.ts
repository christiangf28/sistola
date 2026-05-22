import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const STORAGE_KEY = 'notif_time';

if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('default', {
    name: 'Recordatorios',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
  });
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export type NotifTime = { hour: number; minute: number };

export async function requestPermissions(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function getSavedTime(): Promise<NotifTime | null> {
  let val = await AsyncStorage.getItem(STORAGE_KEY);
  if (!val) {
    const old = await AsyncStorage.getItem('notif_hour');
    if (old) {
      val = `${old}:0`;
      await AsyncStorage.setItem(STORAGE_KEY, val);
      await AsyncStorage.removeItem('notif_hour');
    }
  }
  if (!val) return null;
  const [h, m] = val.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return { hour: h, minute: m };
}

export async function scheduleDaily(hour: number, minute: number): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  await AsyncStorage.setItem(STORAGE_KEY, `${hour}:${minute}`);
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Sistola 💜',
      body: '¿Ya registraste tu presión hoy? Tu constancia genera aura.',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}

export async function cancelNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  await AsyncStorage.removeItem(STORAGE_KEY);
}
