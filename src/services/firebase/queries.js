import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { firestore } from './config';
import { COLLECTIONS, FIELDS, QUERY_STATUS } from '../../constants/firebase';

export class QueryServiceError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'QueryServiceError';
    this.code = code ?? 'query/unknown';
  }
}

/**
 * Customer raises a dispute/query.
 *
 * @param {{ customerId: string, providerId: string, customerName: string, date: string, issueType: string, message: string }} data
 * @returns {Promise<{ id: string }>}
 */
export async function createQuery(data) {
  if (!data.customerId) throw new QueryServiceError('Customer ID required.', 'query/missing-customer');
  if (!data.message?.trim()) throw new QueryServiceError('Message is required.', 'query/missing-message');

  try {
    const ref = await addDoc(collection(firestore, COLLECTIONS.QUERIES), {
      [FIELDS.CUSTOMER_ID]: data.customerId,
      [FIELDS.PROVIDER_ID]: data.providerId,
      customerName:         data.customerName ?? '',
      date:                 data.date ?? '',
      issueType:            data.issueType ?? 'Other',
      [FIELDS.MESSAGE]:     data.message.trim(),
      queryStatus:          QUERY_STATUS.OPEN,
      reply:                null,
      repliedAt:            null,
      [FIELDS.CREATED_AT]:  serverTimestamp(),
    });
    return { id: ref.id };
  } catch (error) {
    throw new QueryServiceError('Failed to submit query. Please try again.', 'query/create-failed');
  }
}

/**
 * Fetches all queries raised by a customer.
 *
 * @param {string} customerId
 * @returns {Promise<Array<Record<string, unknown> & { id: string }>>}
 */
export async function getQueriesByCustomer(customerId) {
  const q = query(
    collection(firestore, COLLECTIONS.QUERIES),
    where(FIELDS.CUSTOMER_ID, '==', customerId)
  );
  const snapshot = await getDocs(q);
  const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  return list.sort((a, b) => {
    const ta = a.createdAt?.seconds ?? 0;
    const tb = b.createdAt?.seconds ?? 0;
    return tb - ta;
  });
}

/**
 * Fetches all queries for a provider (for admin view).
 *
 * @param {string} providerId
 * @returns {Promise<Array<Record<string, unknown> & { id: string }>>}
 */
export async function getQueriesByProvider(providerId) {
  const q = query(
    collection(firestore, COLLECTIONS.QUERIES),
    where(FIELDS.PROVIDER_ID, '==', providerId)
  );
  const snapshot = await getDocs(q);
  const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  return list.sort((a, b) => {
    const ta = a.createdAt?.seconds ?? 0;
    const tb = b.createdAt?.seconds ?? 0;
    return tb - ta;
  });
}

/**
 * Admin replies to a query and marks it resolved.
 *
 * @param {string} queryId
 * @param {string} reply
 * @returns {Promise<void>}
 */
export async function replyToQuery(queryId, reply) {
  if (!queryId) throw new QueryServiceError('Query ID required.', 'query/missing-id');
  if (!reply?.trim()) throw new QueryServiceError('Reply cannot be empty.', 'query/missing-reply');

  try {
    await updateDoc(doc(firestore, COLLECTIONS.QUERIES, queryId), {
      reply:       reply.trim(),
      queryStatus: QUERY_STATUS.RESOLVED,
      repliedAt:   serverTimestamp(),
    });
  } catch (error) {
    throw new QueryServiceError('Failed to send reply.', 'query/reply-failed');
  }
}
