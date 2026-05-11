import {
  readNotificationSoundEnabled,
  storeNotificationSoundEnabled,
} from './lineupNotifications';

const NOTIFICATION_SOUND_SRC = '/sounds/notification.wav';
const NOTIFICATION_SOUND_VOLUME = 0.7;
const NOTIFICATION_SOUND_THROTTLE_MS = 1500;

let notificationAudio = null;
let audioUnlocked = false;
let lastNotificationSoundAt = 0;

function getNotificationAudio() {
  if (typeof window === 'undefined') return null;

  if (!notificationAudio) {
    notificationAudio = new Audio(NOTIFICATION_SOUND_SRC);
    notificationAudio.preload = 'auto';
    notificationAudio.volume = NOTIFICATION_SOUND_VOLUME;
  }

  return notificationAudio;
}

export function unlockNotificationAudio() {
  const audio = getNotificationAudio();
  if (!audio || audioUnlocked) return;

  audio.muted = true;
  audio.play()
    .then(() => {
      audio.pause();
      audio.currentTime = 0;
      audio.muted = false;
      audioUnlocked = true;
      console.log('[LineupNotifications] audio unlocked');
    })
    .catch((error) => {
      audio.muted = false;
      console.warn('[LineupNotifications] audio unlock blocked:', error);
    });
}

export async function playNotificationSound() {
  if (!readNotificationSoundEnabled()) return;

  const audio = getNotificationAudio();
  if (!audio) return;

  const now = Date.now();
  if (now - lastNotificationSoundAt < NOTIFICATION_SOUND_THROTTLE_MS) return;
  lastNotificationSoundAt = now;

  try {
    audio.currentTime = 0;
    await audio.play();
    console.log('[LineupNotifications] notification sound played');
  } catch (error) {
    console.warn('[LineupNotifications] notification sound blocked:', error);
  }
}

export function getNotificationSoundEnabled() {
  return readNotificationSoundEnabled();
}

export function setNotificationSoundEnabled(enabled) {
  storeNotificationSoundEnabled(Boolean(enabled));
}
