import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  onSnapshot,
  serverTimestamp,
  limit,
} from 'firebase/firestore';
import { firestore } from './config';
import { getProviderByCode } from './provider';
import {
  COLLECTIONS,
  FIELDS,
  JOIN_REQUEST_STATUS,
  SUBSCRIPTION_STATUS,
  USER_ROLES,
} from '../../constants/firebase';

/**
 * @typedef {Object} CustomerData
 * @property {string} uid
 * @property {string} phoneNumber
 * @property {string} [name]
 */

/**
 * @typedef {Object} ProviderSearchResult
 * @property {string} id
 * @property {string} businessName
 * @property {string} ownerName
 * @property {string} phoneNumber
 * @property {number} pricePerLiter
 * @property {string} address
 * @property {string} joinCode
 */

/**
 * Custom error for customer Firestore operations.
 */
export class CustomerServiceError extends Error {
  /**
   * @param {string} message
   * @param {string} [code]
   */
  constructor(message, code) {
    super(message);
    this.name = 'CustomerServiceError';
    this.code = code ?? 'customer/unknown';
  }
}

/**
 * Normalizes a join code to XXXX-#### format.
 * @param {string} code
 * @returns {string}
 */
function normalizeJoinCode(code) {
  const cleaned = code.trim().toUpperCase().replace(/\s/g, '');

  if (/^[A-Z]{4}-?\d{4}$/.test(cleaned)) {
    const letters = cleaned.slice(0, 4);
    const numbers = cleaned.replace(/[^0-9]/g, '').slice(-4);
    return `${letters}-${numbers}`;
  }

  return cleaned;
}

/**
 * Searches for a provider by join code.
 *
 * @param {string} code - Provider join code (e.g. SHAR-4821).
 * @returns {Promise<ProviderSearchResult | null>}
 */
export async function searchProviderByCode(code) {
  if (!code?.trim()) {
    throw new CustomerServiceError('Join code is required.', 'customer/invalid-code');
  }

  const normalizedCode = normalizeJoinCode(code);

  if (!/^[A-Z]{4}-\d{4}$/.test(normalizedCode)) {
    throw new CustomerServiceError(
      'Invalid join code format. Use format like SHAR-4821.',
      'customer/invalid-code-format'
    );
  }

  const result = await getProviderByCode(normalizedCode);

  if (!result) {
    return null;
  }

  const { data } = result;

  return {
    id: result.id,
    businessName: /** @type {string} */ (data[FIELDS.BUSINESS_NAME] ?? ''),
    ownerName: /** @type {string} */ (data[FIELDS.OWNER_NAME] ?? ''),
    phoneNumber: /** @type {string} */ (data[FIELDS.PHONE_NUMBER] ?? ''),
    pricePerLiter: /** @type {number} */ (data[FIELDS.PRICE_PER_LITER] ?? 0),
    address: /** @type {string} */ (data[FIELDS.ADDRESS] ?? ''),
    joinCode: /** @type {string} */ (data[FIELDS.JOIN_CODE] ?? normalizedCode),
  };
}

/**
 * Checks for an existing pending join request from customer to provider.
 * @param {string} customerId
 * @param {string} providerId
 * @returns {Promise<string | null>} Request ID if pending exists.
 */
async function findPendingRequest(customerId, providerId) {
  const pendingQuery = query(
    collection(firestore, COLLECTIONS.JOIN_REQUESTS),
    where(FIELDS.CUSTOMER_ID, '==', customerId),
    limit(20)
  );

  const snapshot = await getDocs(pendingQuery);

  const pendingDoc = snapshot.docs.find((requestDoc) => {
    const data = requestDoc.data();
    return (
      data[FIELDS.PROVIDER_ID] === providerId &&
      data[FIELDS.STATUS] === JOIN_REQUEST_STATUS.PENDING
    );
  });

  return pendingDoc?.id ?? null;
}

/**
 * Sends a join request from a customer to a provider.
 *
 * @param {string} providerId - Provider document ID.
 * @param {CustomerData} customerData - Customer info.
 * @returns {Promise<{ requestId: string }>}
 */
export async function sendJoinRequest(providerId, customerData) {
  const { uid, phoneNumber, name } = customerData;

  if (!uid) {
    throw new CustomerServiceError('Customer ID is required.', 'customer/missing-uid');
  }

  if (!providerId) {
    throw new CustomerServiceError('Provider ID is required.', 'customer/missing-provider');
  }

  const providerRef = doc(firestore, COLLECTIONS.PROVIDERS, providerId);
  const providerSnap = await getDoc(providerRef);

  if (!providerSnap.exists()) {
    throw new CustomerServiceError('Provider not found.', 'customer/provider-not-found');
  }

  const existingCustomer = await getDoc(doc(firestore, COLLECTIONS.CUSTOMERS, uid));

  if (existingCustomer.exists()) {
    throw new CustomerServiceError(
      'You are already connected to a provider.',
      'customer/already-connected'
    );
  }

  const existingPending = await findPendingRequest(uid, providerId);

  if (existingPending) {
    return { requestId: existingPending };
  }

  const requestDoc = {
    [FIELDS.CUSTOMER_ID]: uid,
    [FIELDS.PROVIDER_ID]: providerId,
    [FIELDS.PHONE_NUMBER]: phoneNumber,
    [FIELDS.NAME]: name?.trim() || '',
    [FIELDS.STATUS]: JOIN_REQUEST_STATUS.PENDING,
    [FIELDS.CREATED_AT]: serverTimestamp(),
    [FIELDS.PROCESSED_AT]: null,
  };

  try {
    const requestRef = await addDoc(
      collection(firestore, COLLECTIONS.JOIN_REQUESTS),
      requestDoc
    );

    return { requestId: requestRef.id };
  } catch (error) {
    console.error('Failed to send join request:', error);
    throw new CustomerServiceError(
      'Failed to send join request. Please try again.',
      'customer/request-failed'
    );
  }
}

/**
 * Approves a join request and creates the customer profile.
 *
 * @param {string} requestId - Join request document ID.
 * @returns {Promise<void>}
 */
export async function approveJoinRequest(requestId) {
  const requestRef = doc(firestore, COLLECTIONS.JOIN_REQUESTS, requestId);
  const requestSnap = await getDoc(requestRef);

  if (!requestSnap.exists()) {
    throw new CustomerServiceError('Join request not found.', 'customer/request-not-found');
  }

  const requestData = requestSnap.data();
  const status = requestData[FIELDS.STATUS];

  if (status === JOIN_REQUEST_STATUS.APPROVED) {
    return;
  }

  if (status !== JOIN_REQUEST_STATUS.PENDING) {
    throw new CustomerServiceError(
      'Only pending requests can be approved.',
      'customer/invalid-request-status'
    );
  }

  const customerId = requestData[FIELDS.CUSTOMER_ID];
  const providerId = requestData[FIELDS.PROVIDER_ID];

  const customerDoc = {
    [FIELDS.UID]: customerId,
    [FIELDS.PROVIDER_ID]: providerId,
    [FIELDS.PHONE_NUMBER]: requestData[FIELDS.PHONE_NUMBER] ?? '',
    [FIELDS.NAME]: requestData[FIELDS.NAME] ?? '',
    [FIELDS.ROLE]: USER_ROLES.CUSTOMER,
    [FIELDS.SUBSCRIPTION_STATUS]: SUBSCRIPTION_STATUS.ACTIVE,
    [FIELDS.DAILY_QUANTITY]: 1,
    [FIELDS.CREATED_AT]: serverTimestamp(),
    [FIELDS.UPDATED_AT]: serverTimestamp(),
  };

  try {
    await setDoc(doc(firestore, COLLECTIONS.CUSTOMERS, customerId), customerDoc);

    await updateDoc(requestRef, {
      [FIELDS.STATUS]: JOIN_REQUEST_STATUS.APPROVED,
      [FIELDS.PROCESSED_AT]: serverTimestamp(),
    });
  } catch (error) {
    console.error('Failed to approve join request:', error);
    throw new CustomerServiceError(
      'Failed to approve request. Please try again.',
      'customer/approve-failed'
    );
  }
}

/**
 * Rejects a join request.
 *
 * @param {string} requestId - Join request document ID.
 * @returns {Promise<void>}
 */
export async function rejectJoinRequest(requestId) {
  const requestRef = doc(firestore, COLLECTIONS.JOIN_REQUESTS, requestId);
  const requestSnap = await getDoc(requestRef);

  if (!requestSnap.exists()) {
    throw new CustomerServiceError('Join request not found.', 'customer/request-not-found');
  }

  const status = requestSnap.data()[FIELDS.STATUS];

  if (status === JOIN_REQUEST_STATUS.REJECTED) {
    return;
  }

  if (status !== JOIN_REQUEST_STATUS.PENDING) {
    throw new CustomerServiceError(
      'Only pending requests can be rejected.',
      'customer/invalid-request-status'
    );
  }

  try {
    await updateDoc(requestRef, {
      [FIELDS.STATUS]: JOIN_REQUEST_STATUS.REJECTED,
      [FIELDS.PROCESSED_AT]: serverTimestamp(),
    });
  } catch (error) {
    console.error('Failed to reject join request:', error);
    throw new CustomerServiceError(
      'Failed to reject request. Please try again.',
      'customer/reject-failed'
    );
  }
}

/**
 * Returns all customers linked to a provider.
 *
 * @param {string} providerId - Provider document ID.
 * @returns {Promise<Array<{ id: string, data: Record<string, unknown> }>>}
 */
export async function getCustomersByProvider(providerId) {
  if (!providerId) {
    throw new CustomerServiceError('Provider ID is required.', 'customer/missing-provider');
  }

  const customersQuery = query(
    collection(firestore, COLLECTIONS.CUSTOMERS),
    where(FIELDS.PROVIDER_ID, '==', providerId)
  );

  const snapshot = await getDocs(customersQuery);

  return snapshot.docs.map((customerDoc) => ({
    id: customerDoc.id,
    data: customerDoc.data(),
  }));
}

/**
 * Subscribes to real-time updates on a join request.
 *
 * @param {string} requestId - Join request document ID.
 * @param {(request: { id: string, status: string, data: Record<string, unknown> } | null) => void} callback
 * @returns {() => void} Unsubscribe function.
 */
export function subscribeToJoinRequest(requestId, callback) {
  const requestRef = doc(firestore, COLLECTIONS.JOIN_REQUESTS, requestId);

  return onSnapshot(
    requestRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        callback(null);
        return;
      }

      callback({
        id: snapshot.id,
        status: snapshot.data()[FIELDS.STATUS],
        data: snapshot.data(),
      });
    },
    (error) => {
      console.error('Join request listener error:', error);
      callback(null);
    }
  );
}

/**
 * Creates a customer profile directly (admin adds them manually — no join request).
 *
 * @param {string} providerId
 * @param {{ name: string, phoneNumber: string, address?: string, dailyQuantity?: number, ratePerLitre?: number, startDate?: string }} customerData
 * @returns {Promise<{ id: string }>}
 */
export async function createCustomerDirectly(providerId, customerData) {
  if (!providerId) {
    throw new CustomerServiceError('Provider ID is required.', 'customer/missing-provider');
  }

  if (!customerData.name?.trim()) {
    throw new CustomerServiceError('Customer name is required.', 'customer/missing-name');
  }

  if (!customerData.phoneNumber?.trim()) {
    throw new CustomerServiceError('Phone number is required.', 'customer/missing-phone');
  }

  const newDoc = {
    [FIELDS.PROVIDER_ID]: providerId,
    [FIELDS.NAME]: customerData.name.trim(),
    [FIELDS.PHONE_NUMBER]: customerData.phoneNumber.trim(),
    [FIELDS.ADDRESS]: customerData.address?.trim() || '',
    [FIELDS.DAILY_QUANTITY]: customerData.dailyQuantity ?? 1,
    [FIELDS.RATE_PER_LITRE]: customerData.ratePerLitre ?? 60,
    [FIELDS.START_DATE]: customerData.startDate || new Date().toISOString().split('T')[0],
    [FIELDS.ROLE]: USER_ROLES.CUSTOMER,
    [FIELDS.SUBSCRIPTION_STATUS]: SUBSCRIPTION_STATUS.ACTIVE,
    [FIELDS.CREATED_AT]: serverTimestamp(),
    [FIELDS.UPDATED_AT]: serverTimestamp(),
  };

  try {
    const ref = await addDoc(collection(firestore, COLLECTIONS.CUSTOMERS), newDoc);
    return { id: ref.id };
  } catch (error) {
    console.error('Failed to create customer directly:', error);
    throw new CustomerServiceError(
      'Failed to add customer. Please try again.',
      'customer/create-failed'
    );
  }
}

/**
 * Returns all pending join requests for a provider.
 *
 * @param {string} providerId
 * @returns {Promise<Array<{ id: string, data: Record<string, unknown> }>>}
 */
export async function getPendingJoinRequests(providerId) {
  if (!providerId) {
    throw new CustomerServiceError('Provider ID is required.', 'customer/missing-provider');
  }

  const q = query(
    collection(firestore, COLLECTIONS.JOIN_REQUESTS),
    where(FIELDS.PROVIDER_ID, '==', providerId),
    where(FIELDS.STATUS, '==', JOIN_REQUEST_STATUS.PENDING)
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((d) => ({ id: d.id, data: d.data() }));
}
