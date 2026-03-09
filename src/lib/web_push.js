import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';

import { getFirebaseApp } from './firebase';
import { backendApi } from '@/services/api';

export async function ensureServiceWorker() {
  // Only run in browser environment
  if (typeof window === 'undefined') return null;
  if (!('serviceWorker' in navigator)) return null;

  try {
    const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;
    return reg;
  } catch (e) {
    console.error('❌ Service Worker register failed:', e);
    return null;
  }
}

export async function registerWebFcmToken({ employeeId }) {
  console.log('🚀 FCM: Starting registration for employee:', employeeId);
  
  if (typeof window === 'undefined') {
    console.log('❌ FCM: Not in browser environment');
    return null;
  }

  // Check if we already have a valid token for this employee
  const storedToken = sessionStorage.getItem('fcm_token');
  const storedEmployeeId = sessionStorage.getItem('fcm_employee_id');
  
  if (storedToken && storedEmployeeId === employeeId.toString()) {
    console.log(`🔑 FCM Token (${employeeId}) [cached]:`, storedToken);
    // Still send to backend to ensure it's registered
    try {
      await backendApi.post('/notifications/token', {
        employeeId,
        platform: 'WEB',
        token: storedToken,
      });
      console.log('✅ FCM: Cached token re-registered successfully');
    } catch (e) {
      console.error('❌ FCM: Failed to re-register cached token:', e);
    }
    return storedToken;
  }

  const supported = await isSupported().catch(() => false);
  if (!supported) {
    console.warn('❌ FCM: Not supported in this browser');
    return null;
  }

  if (!('Notification' in window)) {
    console.warn('❌ FCM: Notifications not supported');
    return null;
  }

  console.log('🔔 FCM: Current notification permission:', Notification.permission);

  if (Notification.permission === 'denied') {
    console.warn('❌ FCM: Notifications blocked (Notification.permission=denied)');
    return null;
  }

  const permission =
    Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;

  console.log('🔔 FCM: Notification permission after request:', permission);

  if (permission !== 'granted') {
    console.warn('❌ FCM: Notification permission not granted:', permission);
    return null;
  }

  console.log('🔧 FCM: Registering service worker...');
  const registration = await ensureServiceWorker();
  if (!registration) {
    console.error('❌ FCM: Service worker registration failed');
    return null;
  }

  console.log('🔧 FCM: Getting Firebase app...');
  const app = getFirebaseApp();
  const messaging = getMessaging(app);

  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!vapidKey) {
    console.error('❌ FCM: Missing NEXT_PUBLIC_FIREBASE_VAPID_KEY');
    return null;
  }

  console.log('🔑 FCM: Getting FCM token...');
  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: registration,
  }).catch((e) => {
    console.error('❌ FCM: getToken failed:', e);
    return null;
  });

  if (!token) {
    console.error('❌ FCM: Failed to get token');
    return null;
  }

  console.log(`🔑 FCM Token (${employeeId}):`, token);

  // Store token in sessionStorage to persist across refreshes
  if (typeof window !== 'undefined' && token) {
    sessionStorage.setItem('fcm_token', token);
    sessionStorage.setItem('fcm_employee_id', employeeId.toString());
  }

  console.log('📤 FCM: Sending token to backend...');
  await backendApi.post('/notifications/token', {
    employeeId,
    platform: 'WEB',
    token,
  });

  console.log('✅ FCM: Registration completed successfully');
  return token;
}

export async function listenForegroundMessages(onMsg) {
  // Only run in browser environment
  if (typeof window === 'undefined') return () => {};
  
  const supported = await isSupported().catch(() => false);
  if (!supported) return () => {};

  const app = getFirebaseApp();
  const messaging = getMessaging(app);

  return onMessage(messaging, (payload) => {
    console.log('✅ Foreground message:', payload);
    onMsg(payload);
  });
}
