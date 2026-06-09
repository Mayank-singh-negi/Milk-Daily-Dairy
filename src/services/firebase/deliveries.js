import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { firestore } from './config';
import { COLLECTIONS, FIELDS, DELIVERY_STATUS } from '../../constants/firebase';

/**
 * @typedef {Object} DeliveryEntry
 * @property {string} customerId
 * @property {string} providerId
 * @property {string} date          - "YYYY-MM-DD"
 * @property {number} quantity
 * @property {'delivered'|'absent'|'holiday'} status
 */

/**
 * Custom error for delivery Firestore operations.
 */
export class DeliveryServiceError extends Error {
  /**
   * @param {string} message
   * @param {string} [code]
   */
  constructor(message, code) {
    super(message);
    this.name = 'DeliveryServiceError';
    this.code = code ?? 'delivery/unknown';
  }
}

/**
 * Builds a deterministic document ID for a delivery record.
 * Format: {providerId}_{customerId}_{date}
 * This allows upserts without querying first.
 *
 * @param {string} providerId
 * @param {string} customerId
 * @param {string} date - "YYYY-MM-DD"
 * @returns {string}
 */
export function deliveryDocId(providerId, customerId, date) {
  return `${providerId}_${customerId}_${date}`;
}

/**
 * Fetches all delivery records for a provider on a specific date.
 *
 * @param {string} providerId
 * @param {string} date - "YYYY-MM-DD"
 * @returns {Promise<Record<string, DeliveryEntry & { id: string }>>}
 *   Map of customerId → delivery record (for O(1) lookup in UI)
 */
export async function getDeliveriesForDate(providerId, date) {
  if (!providerId) throw new DeliveryServiceError('Provider ID is required.', 'delivery/missing-provider');
  if (!date)       throw new DeliveryServiceError('Date is required.', 'delivery/missing-date');

  const q = query(
    collection(firestore, COLLECTIONS.DELIVERIES),
    where(FIELDS.PROVIDER_ID, '==', providerId),
    where(FIELDS.DELIVERY_DATE, '==', date)
  );

  const snapshot = await getDocs(q);

  /** @type {Record<string, DeliveryEntry & { id: string }>} */
  const map = {};

  snapshot.docs.forEach((d) => {
    const data = d.data();
    const cid = /** @type {string} */ (data[FIELDS.CUSTOMER_ID]);
    map[cid] = {
      id: d.id,
      customerId: cid,
      providerId: /** @type {string} */ (data[FIELDS.PROVIDER_ID]),
      date:       /** @type {string} */ (data[FIELDS.DELIVERY_DATE]),
      quantity:   /** @type {number} */ (data[FIELDS.QUANTITY]),
      status:     /** @type {any}    */ (data[FIELDS.DELIVERY_STATUS]),
    };
  });

  return map;
}

/**
 * Fetches all delivery records for a specific customer in a given month.
 *
 * @param {string} customerId
 * @param {string} month - "YYYY-MM"
 * @returns {Promise<Array<DeliveryEntry & { id: string }>>}
 */
export async function getCustomerDeliveries(customerId, month) {
  if (!customerId) throw new DeliveryServiceError('Customer ID is required.', 'delivery/missing-customer');
  if (!month)      throw new DeliveryServiceError('Month is required.', 'delivery/missing-month');

  // Query all deliveries for this customer where date starts with "YYYY-MM"
  const startDate = `${month}-01`;
  const endDate   = `${month}-31`;

  const q = query(
    collection(firestore, COLLECTIONS.DELIVERIES),
    where(FIELDS.CUSTOMER_ID, '==', customerId),
    where(FIELDS.DELIVERY_DATE, '>=', startDate),
    where(FIELDS.DELIVERY_DATE, '<=', endDate)
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((d) => {
    const data = d.data();
    return {
      id:         d.id,
      customerId: /** @type {string} */ (data[FIELDS.CUSTOMER_ID]),
      providerId: /** @type {string} */ (data[FIELDS.PROVIDER_ID]),
      date:       /** @type {string} */ (data[FIELDS.DELIVERY_DATE]),
      quantity:   /** @type {number} */ (data[FIELDS.QUANTITY]),
      status:     /** @type {any}    */ (data[FIELDS.DELIVERY_STATUS]),
    };
  });
}

/**
 * Batch-saves (upserts) multiple delivery records.
 * Uses deterministic doc IDs so re-saving the same day is safe.
 *
 * @param {DeliveryEntry[]} entries
 * @returns {Promise<void>}
 */
export async function saveDeliveries(entries) {
  if (!entries?.length) return;

  // Firestore batch limit is 500 writes — chunk if needed
  const BATCH_LIMIT = 499;

  for (let i = 0; i < entries.length; i += BATCH_LIMIT) {
    const chunk = entries.slice(i, i + BATCH_LIMIT);
    const batch = writeBatch(firestore);

    chunk.forEach((entry) => {
      const id  = deliveryDocId(entry.providerId, entry.customerId, entry.date);
      const ref = doc(firestore, COLLECTIONS.DELIVERIES, id);

      batch.set(ref, {
        [FIELDS.CUSTOMER_ID]:     entry.customerId,
        [FIELDS.PROVIDER_ID]:     entry.providerId,
        [FIELDS.DELIVERY_DATE]:   entry.date,
        [FIELDS.QUANTITY]:        entry.quantity,
        [FIELDS.DELIVERY_STATUS]: entry.status,
        [FIELDS.UPDATED_AT]:      serverTimestamp(),
      }, { merge: true });
    });

    try {
      await batch.commit();
    } catch (error) {
      console.error('Failed to save deliveries batch:', error);
      throw new DeliveryServiceError(
        'Failed to save deliveries. Please try again.',
        'delivery/save-failed'
      );
    }
  }
}
