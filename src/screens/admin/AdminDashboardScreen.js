import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { getCurrentUser } from '../../services/firebase/auth';
import { getProviderById } from '../../services/firebase/provider';
import { FIELDS } from '../../constants/firebase';
import { COLORS } from '../../constants';

/**
 * Admin / provider dashboard — loads profile from Firestore on login.
 * @param {{ route: import('@react-navigation/native').RouteProp<Record<string, object>, string> }} props
 */
export default function AdminDashboardScreen({ route }) {
  const routeParams = route.params ?? {};
  const [loading, setLoading] = useState(!routeParams.joinCode);
  const [businessName, setBusinessName] = useState(routeParams.businessName ?? '');
  const [joinCode, setJoinCode] = useState(routeParams.joinCode ?? '');
  const [ownerName, setOwnerName] = useState('');
  const [pricePerLiter, setPricePerLiter] = useState(null);

  useEffect(() => {
    if (routeParams.joinCode && routeParams.businessName) {
      return;
    }

    const loadProvider = async () => {
      const uid = getCurrentUser()?.uid;

      if (!uid) {
        setLoading(false);
        return;
      }

      try {
        const provider = await getProviderById(uid);

        if (provider) {
          setBusinessName(/** @type {string} */ (provider.data[FIELDS.BUSINESS_NAME] ?? ''));
          setOwnerName(/** @type {string} */ (provider.data[FIELDS.OWNER_NAME] ?? ''));
          setJoinCode(/** @type {string} */ (provider.data[FIELDS.JOIN_CODE] ?? ''));
          setPricePerLiter(/** @type {number} */ (provider.data[FIELDS.PRICE_PER_LITER] ?? null));
        }
      } catch (error) {
        console.error('Failed to load provider profile:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProvider();
  }, [routeParams.joinCode, routeParams.businessName]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Admin Dashboard</Text>

      {businessName ? (
        <Text style={styles.welcome}>Welcome, {businessName}</Text>
      ) : null}

      {ownerName ? (
        <Text style={styles.owner}>Owner: {ownerName}</Text>
      ) : null}

      {pricePerLiter != null ? (
        <Text style={styles.rate}>Rate: ₹{pricePerLiter}/litre</Text>
      ) : null}

      {joinCode ? (
        <View style={styles.codeBox}>
          <Text style={styles.codeLabel}>Your Join Code</Text>
          <Text style={styles.codeValue}>{joinCode}</Text>
          <Text style={styles.codeHint}>Share this code with customers</Text>
        </View>
      ) : (
        <Text style={styles.subtitle}>Provider profile not found.</Text>
      )}

      <Text style={styles.subtitle}>Provider home — coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  welcome: {
    fontSize: 18,
    color: COLORS.text,
    marginTop: 8,
    fontWeight: '600',
  },
  owner: {
    fontSize: 15,
    color: COLORS.textLight,
    marginTop: 4,
  },
  rate: {
    fontSize: 15,
    color: COLORS.primary,
    marginTop: 4,
    fontWeight: '600',
  },
  codeBox: {
    marginTop: 24,
    marginBottom: 16,
    padding: 20,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    width: '100%',
  },
  codeLabel: {
    fontSize: 13,
    color: COLORS.textLight,
    marginBottom: 6,
  },
  codeValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.primary,
    letterSpacing: 2,
  },
  codeHint: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textLight,
    marginTop: 8,
    textAlign: 'center',
  },
});
