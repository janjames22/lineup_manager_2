import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';

export async function registerNativePush(userId) {
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

  await PushNotifications.register();

  PushNotifications.addListener('registration', async (token) => {
    console.log('[nativePush] FCM token:', token.value);
    await fetch('https://lineup-manager-2.vercel.app/api/push/subscribe-native', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, token: token.value, platform: 'android' }),
    });
  });

  PushNotifications.addListener('registrationError', (err) => {
    console.error('[nativePush] Registration error:', err);
  });

  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    console.log('[nativePush] Foreground notification received:', notification);
  });

  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    console.log('[nativePush] Notification tapped:', action);
  });
}
