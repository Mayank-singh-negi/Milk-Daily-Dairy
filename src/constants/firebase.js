/**
 * Firestore collection names used across the milk delivery app.
 * @readonly
 */
export const COLLECTIONS = {
  PROVIDERS: 'providers',
  CUSTOMERS: 'customers',
  DELIVERIES: 'deliveries',
  BILLS: 'bills',
  QUERIES: 'queries',
  JOIN_REQUESTS: 'joinRequests',
};

/**
 * Common Firestore field names shared across multiple collections.
 * @readonly
 */
export const FIELDS = {
  // Identifiers
  ID: 'id',
  UID: 'uid',
  PROVIDER_ID: 'providerId',
  CUSTOMER_ID: 'customerId',

  // User profile
  NAME: 'name',
  PHONE_NUMBER: 'phoneNumber',
  EMAIL: 'email',
  ROLE: 'role',
  ADDRESS: 'address',
  PROFILE_IMAGE: 'profileImage',

  // Provider-specific
  BUSINESS_NAME: 'businessName',
  OWNER_NAME: 'ownerName',
  JOIN_CODE: 'joinCode',
  DELIVERY_AREAS: 'deliveryAreas',
  PRICE_PER_LITER: 'pricePerLiter',
  IS_ACTIVE: 'isActive',

  // Customer-specific
  SUBSCRIPTION_STATUS: 'subscriptionStatus',
  DAILY_QUANTITY: 'dailyQuantity',
  RATE_PER_LITRE: 'ratePerLitre',
  START_DATE: 'startDate',

  // Join request-specific
  PROCESSED_AT: 'processedAt',

  // Delivery-specific
  DELIVERY_DATE: 'deliveryDate',
  QUANTITY: 'quantity',
  DELIVERED_AT: 'deliveredAt',
  DELIVERY_STATUS: 'deliveryStatus',
  NOTES: 'notes',

  // Bill-specific
  MONTH: 'month',
  YEAR: 'year',
  AMOUNT: 'amount',
  PAID_STATUS: 'paidStatus',
  DUE_DATE: 'dueDate',
  TOTAL_LITERS: 'totalLiters',

  // Query-specific
  SUBJECT: 'subject',
  MESSAGE: 'message',
  RESPONSE: 'response',
  QUERY_STATUS: 'queryStatus',

  // Metadata
  STATUS: 'status',
  CREATED_AT: 'createdAt',
  UPDATED_AT: 'updatedAt',
};

/**
 * Join request status values.
 * @readonly
 */
export const JOIN_REQUEST_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

/**
 * Subscription status values for customers.
 * @readonly
 */
export const SUBSCRIPTION_STATUS = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  CANCELLED: 'cancelled',
};

/**
 * Delivery status values.
 * @readonly
 */
export const DELIVERY_STATUS = {
  PENDING: 'pending',
  DELIVERED: 'delivered',
  SKIPPED: 'skipped',
  MISSED: 'missed',
};

/**
 * Bill payment status values.
 * @readonly
 */
export const PAID_STATUS = {
  PAID: 'paid',
  UNPAID: 'unpaid',
  PARTIAL: 'partial',
  OVERDUE: 'overdue',
};

/**
 * Query/support ticket status values.
 * @readonly
 */
export const QUERY_STATUS = {
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
};

/**
 * User role values.
 * @readonly
 */
export const USER_ROLES = {
  ADMIN: 'admin',
  PROVIDER: 'provider',
  CUSTOMER: 'customer',
};
