import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../services/firebase/config';
import { getProviderById } from '../services/firebase/provider';
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '../services/firebase/config';
import { COLLECTIONS } from '../constants/firebase';

/**
 * @typedef {'provider' | 'customer' | null} UserRole
 *
 * @typedef {Object} AuthContextValue
 * @property {import('firebase/auth').User | null} user       - Firebase Auth user (null if logged out)
 * @property {UserRole} userRole                              - 'provider', 'customer', or null
 * @property {Record<string, unknown> | null} providerData   - Firestore provider doc data
 * @property {Record<string, unknown> | null} customerData   - Firestore customer doc data
 * @property {boolean} loading                               - True while resolving auth state
 * @property {(role: UserRole) => void} setUserRole          - Manually set role (used post-login)
 * @property {(data: Record<string, unknown>) => void} setProviderData - Update cached provider data
 * @property {(data: Record<string, unknown>) => void} setCustomerData - Update cached customer data
 * @property {() => Promise<void>} refreshProfile            - Re-fetch profile from Firestore
 */

/** @type {React.Context<AuthContextValue>} */
const AuthContext = createContext(/** @type {AuthContextValue} */ ({
  user: null,
  userRole: null,
  providerData: null,
  customerData: null,
  loading: true,
  setUserRole: () => {},
  setProviderData: () => {},
  setCustomerData: () => {},
  refreshProfile: async () => {},
}));

/**
 * Tries to fetch a provider profile for the given UID.
 * Returns null silently if not found or Firestore is offline.
 * @param {string} uid
 * @returns {Promise<Record<string, unknown> | null>}
 */
async function fetchProviderProfile(uid) {
  try {
    const result = await getProviderById(uid);
    return result ? { id: result.id, ...result.data } : null;
  } catch {
    return null;
  }
}

/**
 * Tries to fetch a customer profile for the given UID.
 * Returns null silently if not found or Firestore is offline.
 * @param {string} uid
 * @returns {Promise<Record<string, unknown> | null>}
 */
async function fetchCustomerProfile(uid) {
  try {
    const snap = await getDoc(doc(firestore, COLLECTIONS.CUSTOMERS, uid));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch {
    return null;
  }
}

/**
 * Resolves role + profile data for an authenticated user.
 * Checks provider collection first, then customer collection.
 * @param {import('firebase/auth').User} user
 * @returns {Promise<{ role: UserRole, providerData: Record<string, unknown> | null, customerData: Record<string, unknown> | null }>}
 */
async function resolveUserProfile(user) {
  const providerData = await fetchProviderProfile(user.uid);

  if (providerData) {
    return { role: 'provider', providerData, customerData: null };
  }

  const customerData = await fetchCustomerProfile(user.uid);

  if (customerData) {
    return { role: 'customer', providerData: null, customerData };
  }

  // Authenticated but no Firestore profile yet — new user, needs registration
  return { role: null, providerData: null, customerData: null };
}

/**
 * AuthProvider — wraps the app and exposes auth state via context.
 * @param {{ children: React.ReactNode }} props
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(/** @type {import('firebase/auth').User | null} */ (null));
  const [userRole, setUserRole] = useState(/** @type {UserRole} */ (null));
  const [providerData, setProviderData] = useState(/** @type {Record<string, unknown> | null} */ (null));
  const [customerData, setCustomerData] = useState(/** @type {Record<string, unknown> | null} */ (null));
  const [loading, setLoading] = useState(true);

  /**
   * Re-fetches profile from Firestore and updates context.
   * Call this after registration or profile updates.
   */
  const refreshProfile = async () => {
    if (!user) return;

    const { role, providerData: pd, customerData: cd } = await resolveUserProfile(user);
    setUserRole(role);
    setProviderData(pd);
    setCustomerData(cd);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        // Logged out — clear everything
        setUser(null);
        setUserRole(null);
        setProviderData(null);
        setCustomerData(null);
        setLoading(false);
        return;
      }

      // Logged in — resolve profile
      setUser(firebaseUser);

      try {
        const { role, providerData: pd, customerData: cd } =
          await resolveUserProfile(firebaseUser);
        setUserRole(role);
        setProviderData(pd);
        setCustomerData(cd);
      } catch (error) {
        console.warn('AuthContext: failed to resolve user profile:', error);
        setUserRole(null);
        setProviderData(null);
        setCustomerData(null);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const value = {
    user,
    userRole,
    providerData,
    customerData,
    loading,
    setUserRole,
    setProviderData,
    setCustomerData,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to access auth context.
 * Must be used inside an <AuthProvider>.
 * @returns {AuthContextValue}
 */
export function useAuth() {
  return useContext(AuthContext);
}

export default AuthContext;
