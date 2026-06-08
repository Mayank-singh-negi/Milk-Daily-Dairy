import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  limit,
} from 'firebase/firestore';
import { firestore } from './config';
import { COLLECTIONS, FIELDS } from '../../constants/firebase';

/**
 * @typedef {'provider' | 'customer'} UserRole
 * @typedef {{ exists: boolean, data: Record<string, unknown> | null, offline?: boolean }} UserProfileResult
 */

/**
 * @param {unknown} error
 * @returns {boolean}
 */
function isFirestoreOfflineError(error) {
  const code = /** @type {{ code?: string, message?: string }} */ (error)?.code;
  const message = /** @type {{ message?: string }} */ (error)?.message ?? '';

  return (
    code === 'unavailable' ||
    code === 'failed-precondition' ||
    message.toLowerCase().includes('offline')
  );
}

/**
 * Returns the Firestore collection name for the given role.
 * @param {UserRole} userRole
 * @returns {string}
 */
function getCollectionForRole(userRole) {
  return userRole === 'provider' ? COLLECTIONS.PROVIDERS : COLLECTIONS.CUSTOMERS;
}

/**
 * Checks whether a user profile exists in Firestore for the given role.
 * Looks up by document ID (Firebase Auth UID) first, then by phone number.
 *
 * @param {string} uid - Firebase Auth user UID.
 * @param {string} phoneNumber - Phone number in E.164 format.
 * @param {UserRole} userRole - Selected app role.
 * @returns {Promise<UserProfileResult>}
 */
export async function getUserProfile(uid, phoneNumber, userRole) {
  const collectionName = getCollectionForRole(userRole);

  try {
    const docRef = doc(firestore, collectionName, uid);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return {
        exists: true,
        data: { id: docSnap.id, ...docSnap.data() },
      };
    }

    const phoneQuery = query(
      collection(firestore, collectionName),
      where(FIELDS.PHONE_NUMBER, '==', phoneNumber),
      limit(1)
    );
    const querySnap = await getDocs(phoneQuery);

    if (!querySnap.empty) {
      const matchedDoc = querySnap.docs[0];
      return {
        exists: true,
        data: { id: matchedDoc.id, ...matchedDoc.data() },
      };
    }

    return { exists: false, data: null };
  } catch (error) {
    if (isFirestoreOfflineError(error)) {
      console.warn(
        'Firestore unavailable — skipping profile lookup. Create Firestore DB in Firebase Console if not done yet.',
        error
      );
      return { exists: false, data: null, offline: true };
    }

    console.error('Failed to fetch user profile:', error);
    throw new Error('Unable to verify your account. Please try again.');
  }
}
