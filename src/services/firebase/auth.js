import {
  signInWithPhoneNumber,
  PhoneAuthProvider,
  signInWithCredential,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { auth } from './config';

/**
 * @typedef {Object} PhoneSignInResult
 * @property {string} verificationId - ID used to verify the OTP code.
 */

/**
 * Custom error wrapper for Firebase authentication failures.
 */
export class FirebaseAuthError extends Error {
  /**
   * @param {string} message - Human-readable error message.
   * @param {string} [code] - Firebase error code when available.
   * @param {unknown} [originalError] - Original caught error.
   */
  constructor(message, code, originalError) {
    super(message);
    this.name = 'FirebaseAuthError';
    this.code = code ?? 'auth/unknown';
    this.originalError = originalError;
  }
}

/**
 * Maps Firebase Auth error codes to user-friendly messages.
 * @param {unknown} error
 * @returns {FirebaseAuthError}
 */
function handleAuthError(error) {
  const code = /** @type {{ code?: string }} */ (error)?.code;
  const message = /** @type {{ message?: string }} */ (error)?.message;

  const errorMessages = {
    'auth/invalid-phone-number': 'The phone number format is invalid.',
    'auth/missing-phone-number': 'A phone number is required.',
    'auth/too-many-requests': 'Too many attempts. Please try again later.',
    'auth/invalid-verification-code': 'The OTP code is invalid.',
    'auth/code-expired': 'The OTP code has expired. Please request a new one.',
    'auth/session-expired': 'The verification session has expired.',
    'auth/user-disabled': 'This account has been disabled.',
    'auth/network-request-failed': 'Network error. Check your connection and try again.',
    'auth/operation-not-allowed':
      'SMS is not enabled for your region. Enable India (IN) in Firebase Console → Authentication → Settings → SMS region policy.',
  };

  const friendlyMessage =
    (code && errorMessages[code]) ||
    message ||
    'An unexpected authentication error occurred.';

  return new FirebaseAuthError(friendlyMessage, code, error);
}

/**
 * Validates a phone number string before sending to Firebase.
 * @param {string} phoneNumber
 * @throws {FirebaseAuthError}
 */
function validatePhoneNumber(phoneNumber) {
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    throw new FirebaseAuthError('Phone number is required.', 'auth/missing-phone-number');
  }

  const trimmed = phoneNumber.trim();

  if (!/^\+[1-9]\d{7,14}$/.test(trimmed)) {
    throw new FirebaseAuthError(
      'Phone number must be in E.164 format (e.g. +919876543210).',
      'auth/invalid-phone-number'
    );
  }
}

/**
 * Validates OTP input before verification.
 * @param {string} verificationId
 * @param {string} code
 * @throws {FirebaseAuthError}
 */
function validateOTPInput(verificationId, code) {
  if (!verificationId || typeof verificationId !== 'string') {
    throw new FirebaseAuthError(
      'Verification ID is required.',
      'auth/invalid-verification-id'
    );
  }

  if (!code || typeof code !== 'string' || !/^\d{6}$/.test(code.trim())) {
    throw new FirebaseAuthError(
      'A valid 6-digit OTP code is required.',
      'auth/invalid-verification-code'
    );
  }
}

/**
 * Sends an OTP to the given phone number.
 * On web, an `appVerifier` (RecaptchaVerifier) is required.
 *
 * @param {string} phoneNumber - Phone number in E.164 format (e.g. +919876543210).
 * @param {import('firebase/auth').ApplicationVerifier} [appVerifier] - Required on web platforms.
 * @returns {Promise<PhoneSignInResult>}
 * @throws {FirebaseAuthError}
 */
export async function signInWithPhone(phoneNumber, appVerifier) {
  try {
    validatePhoneNumber(phoneNumber);

    const confirmationResult = await signInWithPhoneNumber(
      auth,
      phoneNumber.trim(),
      appVerifier
    );

    if (!confirmationResult.verificationId) {
      throw new FirebaseAuthError(
        'Failed to obtain verification ID.',
        'auth/invalid-verification-id'
      );
    }

    return {
      verificationId: confirmationResult.verificationId,
    };
  } catch (error) {
    if (error instanceof FirebaseAuthError) {
      throw error;
    }

    throw handleAuthError(error);
  }
}

/**
 * Verifies the OTP code and signs the user in.
 *
 * @param {string} verificationId - Verification ID returned from `signInWithPhone`.
 * @param {string} code - 6-digit OTP code received via SMS.
 * @returns {Promise<import('firebase/auth').User>}
 * @throws {FirebaseAuthError}
 */
export async function verifyOTP(verificationId, code) {
  try {
    validateOTPInput(verificationId, code);

    const credential = PhoneAuthProvider.credential(
      verificationId,
      code.trim()
    );

    const userCredential = await signInWithCredential(auth, credential);

    if (!userCredential.user) {
      throw new FirebaseAuthError(
        'Sign-in succeeded but no user was returned.',
        'auth/user-not-found'
      );
    }

    return userCredential.user;
  } catch (error) {
    if (error instanceof FirebaseAuthError) {
      throw error;
    }

    throw handleAuthError(error);
  }
}

/**
 * Signs out the currently authenticated user.
 * @returns {Promise<void>}
 * @throws {FirebaseAuthError}
 */
export async function signOut() {
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    throw handleAuthError(error);
  }
}

/**
 * Returns the currently signed-in Firebase user, or null if unauthenticated.
 * @returns {import('firebase/auth').User | null}
 */
export function getCurrentUser() {
  return auth.currentUser;
}
