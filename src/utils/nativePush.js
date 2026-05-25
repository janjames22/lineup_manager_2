import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';

export async function registerNativePush(accessToken) {
  if (!Capacitor.isNativePlatform()) {
    console.log('[nativePush] Skipping — not a native platform');
    return;
  }

  let permStatus = await PushNotifications.checkPermissions();
  if (permStatus.receive === 'prompt') {
    permStatus = await PushNotifications.requestPermissions();
  }
  if (permStatus.receive !== 'granted') {
    throw new Error('Push notification permission denied');
  }

  // Create high-importance channel before registering so FCM banners and sound work on Android 8+
  if (Capacitor.getPlatform() === 'android') {
    await PushNotifications.createChannel({
      id: 'lineup_updates_v2',
      name: 'Lineup Updates',
      description: 'Notifications for new lineups and song updates',
      importance: 5,
      visibility: 1,
      sound: 'default',
      vibration: true,
      lights: true,
    });
  }

  await PushNotifications.register();

  PushNotifications.addListener('registration', async (token) => {
    if (import.meta.env.DEV) console.log('[nativePush] FCM token:', token.value.slice(0, 8) + '…');
    await fetch('/api/push/subscribe-native', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
      body: JSON.stringify({ token: token.value, platform: 'android' }),
    });
  });

  PushNotifications.addListener('registrationError', (err) => {
    console.error('[nativePush] Registration error:', err);
  });

  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    console.log('[nativePush] Foreground notification received:', notification);
  });

  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    const url = action.notification.data?.url;
    if (url) {
      window.dispatchEvent(new CustomEvent('nativePushNavigate', { detail: { url } }));
    }
  });
}
