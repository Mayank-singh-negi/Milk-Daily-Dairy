import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAnalytics, isSupported as isAnalyticsSupported } from 'firebase/analytics';
import { getAuth } from 'firebase/auth';
import { getFirestore, enableNetwork } from 'firebase/firestore';
import { getMessaging, isSupported as isMessagingSupported } from 'firebase/messaging';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';

/**
 * Firebase project configuration for milk-daily-dairy.
 * @type {import('firebase/app').FirebaseOptions}
 */
export const firebaseConfig = {
  apiKey: 'AIzaSyCim73vLxdEF2p3vngwxRgUj-koObGZXGk',
  authDomain: 'milk-daily-dairy.firebaseapp.com',
  projectId: 'milk-daily-dairy',
  storageBucket: 'milk-daily-dairy.firebasestorage.app',
  messagingSenderId: '733311371841',
  appId: '1:733311371841:web:4849749573f1ba054f54c0',
  measurementId: 'G-4YD1W32EY7',
};

/**
 * Initializes the Firebase app singleton, reusing an existing instance when present.
 * @returns {import('firebase/app').FirebaseApp}
 */
function initializeFirebaseApp() {
  if (getApps().length > 0) {
    return getApp();
  }

  return initializeApp(firebaseConfig);
}

const app = initializeFirebaseApp();

/**
 * Initialize compat SDK required by expo-firebase-recaptcha on web.
 * Modular and compat apps share the same firebaseConfig but use separate entry points.
 */
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

/** @type {import('firebase/auth').Auth} */
export const auth = getAuth(app);

/**
 * Skip real SMS in development when using Firebase test phone numbers.
 * Must be set on modular auth (used by signInWithPhone) — not only compat auth.
 */
if (typeof __DEV__ !== 'undefined' && __DEV__) {
  auth.settings.appVerificationDisabledForTesting = true;
  firebase.auth().settings.appVerificationDisabledForTesting = true;
}

/** @type {import('firebase/firestore').Firestore} */
export const firestore = getFirestore(app);

enableNetwork(firestore).catch((error) => {
  console.warn('Could not enable Firestore network:', error.message);
});

/**
 * Firebase Analytics instance (web only).
 * Call `initAnalytics()` before use.
 * @type {import('firebase/analytics').Analytics | null}
 */
export let analytics = null;

/**
 * Firebase Cloud Messaging instance (web only).
 * Call `initMessaging()` before use.
 * @type {import('firebase/messaging').Messaging | null}
 */
export let messaging = null;

/**
 * Initializes Firebase Analytics when the current platform supports it.
 * @returns {Promise<import('firebase/analytics').Analytics | null>}
 */
export async function initAnalytics() {
  if (analytics) {
    return analytics;
  }

  try {
    const supported = await isAnalyticsSupported();

    if (!supported) {
      console.warn('Firebase Analytics is not supported on this platform.');
      return null;
    }

    analytics = getAnalytics(app);
    return analytics;
  } catch (error) {
    console.warn('Failed to initialize Firebase Analytics:', error.message);
    return null;
  }
}

/**
 * Initializes Firebase Cloud Messaging when the current platform supports it.
 * @returns {Promise<import('firebase/messaging').Messaging | null>}
 */
export async function initMessaging() {
  if (messaging) {
    return messaging;
  }

  try {
    const supported = await isMessagingSupported();

    if (!supported) {
      console.warn('Firebase Messaging is not supported on this platform.');
      return null;
    }

    messaging = getMessaging(app);
    return messaging;
  } catch (error) {
    console.warn('Failed to initialize Firebase Messaging:', error.message);
    return null;
  }
}

export { app };
