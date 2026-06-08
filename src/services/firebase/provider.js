import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import { firestore } from './config';
import { COLLECTIONS, FIELDS, USER_ROLES } from '../../constants/firebase';

const DEFAULT_MILK_RATE = 60;
const MAX_JOIN_CODE_ATTEMPTS = 10;

/**
 * @typedef {Object} ProviderData
 * @property {string} uid
 * @property {string} phoneNumber
 * @property {string} businessName
 * @property {string} ownerName
 * @property {string} [address]
 * @property {number} [pricePerLiter]
 */

/**
 * Custom error for provider Firestore operations.
 */
export class ProviderServiceError extends Error {
  /**
   * @param {string} message
   * @param {string} [code]
   */
  constructor(message, code) {
    super(message);
    this.name = 'ProviderServiceError';
    this.code = code ?? 'provider/unknown';
  }
}

/**
 * Generates a join code from business name: 4 letters + hyphen + 4 digits.
 * Example: "Sharma Dairy" → "SHAR-4821"
 *
 * @param {string} businessName
 * @returns {string}
 */
export function generateJoinCode(businessName) {
  const letters = businessName
    .replace(/[^a-zA-Z]/g, '')
    .toUpperCase()
    .padEnd(4, 'X')
    .slice(0, 4);

  const numbers = Math.floor(1000 + Math.random() * 9000).toString();

  return `${letters}-${numbers}`;
}

/**
 * Fetches a provider document by Firebase Auth UID.
 *
 * @param {string} uid - Provider document ID / Firebase Auth UID.
 * @returns {Promise<{ id: string, data: Record<string, unknown> } | null>}
 */
export async function getProviderById(uid) {
  if (!uid) {
    throw new ProviderServiceError('Provider ID is required.', 'provider/missing-id');
  }

  const docSnap = await getDoc(doc(firestore, COLLECTIONS.PROVIDERS, uid));

  if (!docSnap.exists()) {
    return null;
  }

  return {
    id: docSnap.id,
    data: docSnap.data(),
  };
}

/**
 * Fetches a provider document by join code.
 *
 * @param {string} code - Join code (e.g. SHAR-4821).
 * @returns {Promise<{ id: string, data: Record<string, unknown> } | null>}
 */
export async function getProviderByCode(code) {
  if (!code || typeof code !== 'string') {
    throw new ProviderServiceError('Join code is required.', 'provider/invalid-code');
  }

  const normalizedCode = code.trim().toUpperCase();

  const codeQuery = query(
    collection(firestore, COLLECTIONS.PROVIDERS),
    where(FIELDS.JOIN_CODE, '==', normalizedCode),
    limit(1)
  );

  const snapshot = await getDocs(codeQuery);

  if (snapshot.empty) {
    return null;
  }

  const matchedDoc = snapshot.docs[0];
  return {
    id: matchedDoc.id,
    data: matchedDoc.data(),
  };
}

/**
 * Generates a unique join code by checking Firestore for collisions.
 * @param {string} businessName
 * @returns {Promise<string>}
 */
async function generateUniqueJoinCode(businessName) {
  for (let attempt = 0; attempt < MAX_JOIN_CODE_ATTEMPTS; attempt += 1) {
    const code = generateJoinCode(businessName);
    const existing = await getProviderByCode(code);

    if (!existing) {
      return code;
    }
  }

  throw new ProviderServiceError(
    'Could not generate a unique join code. Please try again.',
    'provider/code-generation-failed'
  );
}

/**
 * Creates a new provider profile in Firestore.
 *
 * @param {ProviderData} data
 * @returns {Promise<{ id: string, joinCode: string }>}
 */
export async function createProvider(data) {
  const { uid, phoneNumber, businessName, ownerName, address, pricePerLiter } = data;

  if (!uid) {
    throw new ProviderServiceError('User ID is required.', 'provider/missing-uid');
  }

  if (!businessName?.trim()) {
    throw new ProviderServiceError('Business name is required.', 'provider/invalid-business-name');
  }

  if (!ownerName?.trim()) {
    throw new ProviderServiceError('Owner name is required.', 'provider/invalid-owner-name');
  }

  const providerRef = doc(firestore, COLLECTIONS.PROVIDERS, uid);
  const existingDoc = await getDoc(providerRef);

  if (existingDoc.exists()) {
    throw new ProviderServiceError(
      'A provider profile already exists for this account.',
      'provider/already-exists'
    );
  }

  const joinCode = await generateUniqueJoinCode(businessName.trim());
  const rate = pricePerLiter ?? DEFAULT_MILK_RATE;

  const providerDoc = {
    [FIELDS.UID]: uid,
    [FIELDS.PHONE_NUMBER]: phoneNumber,
    [FIELDS.BUSINESS_NAME]: businessName.trim(),
    [FIELDS.OWNER_NAME]: ownerName.trim(),
    [FIELDS.ADDRESS]: address?.trim() || '',
    [FIELDS.PRICE_PER_LITER]: rate,
    [FIELDS.JOIN_CODE]: joinCode,
    [FIELDS.ROLE]: USER_ROLES.PROVIDER,
    [FIELDS.IS_ACTIVE]: true,
    [FIELDS.DELIVERY_AREAS]: [],
    [FIELDS.CREATED_AT]: serverTimestamp(),
    [FIELDS.UPDATED_AT]: serverTimestamp(),
  };

  try {
    await setDoc(providerRef, providerDoc);

    return { id: uid, joinCode };
  } catch (error) {
    console.error('Failed to create provider:', error);
    throw new ProviderServiceError(
      'Failed to save provider profile. Please try again.',
      'provider/create-failed'
    );
  }
}

/**
 * Updates an existing provider document.
 *
 * @param {string} id - Provider document ID (Firebase Auth UID).
 * @param {Partial<Record<string, unknown>>} data - Fields to update.
 * @returns {Promise<void>}
 */
export async function updateProvider(id, data) {
  if (!id) {
    throw new ProviderServiceError('Provider ID is required.', 'provider/missing-id');
  }

  if (!data || Object.keys(data).length === 0) {
    throw new ProviderServiceError('No data provided to update.', 'provider/empty-update');
  }

  const providerRef = doc(firestore, COLLECTIONS.PROVIDERS, id);
  const existingDoc = await getDoc(providerRef);

  if (!existingDoc.exists()) {
    throw new ProviderServiceError('Provider not found.', 'provider/not-found');
  }

  try {
    await updateDoc(providerRef, {
      ...data,
      [FIELDS.UPDATED_AT]: serverTimestamp(),
    });
  } catch (error) {
    console.error('Failed to update provider:', error);
    throw new ProviderServiceError(
      'Failed to update provider profile. Please try again.',
      'provider/update-failed'
    );
  }
}
