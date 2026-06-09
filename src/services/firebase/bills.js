import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { firestore } from './config';
import { COLLECTIONS, FIELDS, PAID_STATUS, DELIVERY_STATUS } from '../../constants/firebase';

/**
 * @typedef {Object} BillRecord
 * @property {string} id
 * @property {string} customerId
 * @property {string} providerId
 * @property {string} month        - "YYYY-MM"
 * @property {number} totalDays
 * @property {number} totalQuantity
 * @property {number} ratePerLitre
 * @property {number} amount
 * @property {string} paidStatus
 */

export class BillServiceError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'BillServiceError';
    this.code = code ?? 'bill/unknown';
  }
}

/** Deterministic bill doc ID */
function billDocId(providerId, customerId, month) {
  return `${providerId}_${customerId}_${month}`;
}

/**
 * Generates/refreshes monthly bills for all customers of a provider.
 * Reads delivered entries for the month and calculates totals.
 *
 * @param {string} providerId
 * @param {string} month - "YYYY-MM"
 * @param {Array<{ id: string, data: Record<string, unknown> }>} customers
 * @returns {Promise<void>}
 */
export async function generateMonthlyBills(providerId, month, customers) {
  if (!providerId) throw new BillServiceError('Provider ID required.', 'bill/missing-provider');
  if (!month)      throw new BillServiceError('Month required.', 'bill/missing-month');
  if (!customers?.length) throw new BillServiceError('No customers provided.', 'bill/no-customers');

  const startDate = `${month}-01`;
  const endDate   = `${month}-31`;

  // Fetch all delivered deliveries for this provider in the month
  const q = query(
    collection(firestore, COLLECTIONS.DELIVERIES),
    where(FIELDS.PROVIDER_ID, '==', providerId),
    where(FIELDS.DELIVERY_DATE, '>=', startDate),
    where(FIELDS.DELIVERY_DATE, '<=', endDate),
    where(FIELDS.DELIVERY_STATUS, '==', DELIVERY_STATUS.DELIVERED)
  );

  const snapshot = await getDocs(q);

  // Group deliveries by customerId
  /** @type {Record<string, { days: number, qty: number }>} */
  const deliveryMap = {};
  snapshot.docs.forEach((d) => {
    const data = d.data();
    const cid  = /** @type {string} */ (data[FIELDS.CUSTOMER_ID]);
    if (!deliveryMap[cid]) deliveryMap[cid] = { days: 0, qty: 0 };
    deliveryMap[cid].days += 1;
    deliveryMap[cid].qty  += /** @type {number} */ (data[FIELDS.QUANTITY] ?? 0);
  });

  // Write a bill doc for each customer
  const writes = customers.map(async (customer) => {
    const stats = deliveryMap[customer.id] ?? { days: 0, qty: 0 };
    const rate  = /** @type {number} */ (
      customer.data[FIELDS.RATE_PER_LITRE] ??
      customer.data[FIELDS.PRICE_PER_LITER] ?? 60
    );
    const amount = stats.qty * rate;

    const id  = billDocId(providerId, customer.id, month);
    const ref = doc(firestore, COLLECTIONS.BILLS, id);

    await setDoc(ref, {
      [FIELDS.CUSTOMER_ID]:   customer.id,
      [FIELDS.PROVIDER_ID]:   providerId,
      [FIELDS.MONTH]:         month,
      totalDays:              stats.days,
      totalQuantity:          stats.qty,
      ratePerLitre:           rate,
      [FIELDS.AMOUNT]:        amount,
      [FIELDS.PAID_STATUS]:   PAID_STATUS.UNPAID,
      generatedAt:            serverTimestamp(),
      paidAt:                 null,
      customerName:           customer.data[FIELDS.NAME] ?? '',
    }, { merge: true });
  });

  try {
    await Promise.all(writes);
  } catch (error) {
    console.error('Failed to generate bills:', error);
    throw new BillServiceError('Failed to generate bills. Please try again.', 'bill/generate-failed');
  }
}

/**
 * Fetches all bills for a provider for a given month.
 *
 * @param {string} providerId
 * @param {string} month - "YYYY-MM"
 * @returns {Promise<BillRecord[]>}
 */
export async function getBillsByProvider(providerId, month) {
  if (!providerId) throw new BillServiceError('Provider ID required.', 'bill/missing-provider');

  const q = query(
    collection(firestore, COLLECTIONS.BILLS),
    where(FIELDS.PROVIDER_ID, '==', providerId),
    where(FIELDS.MONTH, '==', month)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Fetches all bills for a customer (all months).
 *
 * @param {string} customerId
 * @returns {Promise<BillRecord[]>}
 */
export async function getBillsByCustomer(customerId) {
  if (!customerId) throw new BillServiceError('Customer ID required.', 'bill/missing-customer');

  const q = query(
    collection(firestore, COLLECTIONS.BILLS),
    where(FIELDS.CUSTOMER_ID, '==', customerId)
  );

  const snapshot = await getDocs(q);
  const bills = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  // Sort newest month first
  return bills.sort((a, b) => (b.month > a.month ? 1 : -1));
}

/**
 * Updates the payment status of a bill.
 *
 * @param {string} billId
 * @param {'paid'|'unpaid'|'partial'} paidStatus
 * @returns {Promise<void>}
 */
export async function markBillPaid(billId, paidStatus) {
  if (!billId) throw new BillServiceError('Bill ID required.', 'bill/missing-id');

  const ref = doc(firestore, COLLECTIONS.BILLS, billId);
  try {
    await updateDoc(ref, {
      [FIELDS.PAID_STATUS]: paidStatus,
      paidAt: paidStatus === PAID_STATUS.PAID ? serverTimestamp() : null,
      [FIELDS.UPDATED_AT]: serverTimestamp(),
    });
  } catch (error) {
    throw new BillServiceError('Failed to update payment status.', 'bill/update-failed');
  }
}
