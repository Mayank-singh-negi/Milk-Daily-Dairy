import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { subscribeToJoinRequest } from '../../services/firebase/customer';
import { JOIN_REQUEST_STATUS } from '../../constants/firebase';
import { COLORS } from '../../constants';
import { authStyles } from './authStyles';

/**
 * Waiting screen — listens for join request approval in real time.
 * @param {{ navigation: import('@react-navigation/native').NavigationProp<Record<string, object>>, route: import('@react-navigation/native').RouteProp<Record<string, object>, string> }} props
 */
export default function WaitingApprovalScreen({ navigation, route }) {
  const { requestId, provider } = route.params ?? {};

  const [status, setStatus] = useState('pending');
  const [listenerError, setListenerError] = useState(false);

  useEffect(() => {
    if (!requestId) {
      setListenerError(true);
      return undefined;
    }

    const unsubscribe = subscribeToJoinRequest(requestId, (request) => {
      if (!request) {
        setListenerError(true);
        return;
      }

      setStatus(request.status);
      setListenerError(false);

      if (request.status === JOIN_REQUEST_STATUS.APPROVED) {
        navigation.reset({
          index: 0,
          routes: [
            {
              name: 'CustomerDashboard',
              params: {
                providerName: provider?.businessName,
              },
            },
          ],
        });
      }
    });

    return unsubscribe;
  }, [requestId, navigation, provider?.businessName]);

  const handleTryAgain = () => {
    navigation.replace('JoinCode', route.params);
  };

  if (status === JOIN_REQUEST_STATUS.REJECTED) {
    return (
      <View style={[authStyles.container, authStyles.centered]}>
        <Text style={styles.icon}>❌</Text>
        <Text style={authStyles.title}>Request Declined</Text>
        <Text style={authStyles.subtitle}>
          {provider?.businessName
            ? `${provider.businessName} declined your join request.`
            : 'Your join request was declined.'}
        </Text>
        <Text style={authStyles.subtitle}>
          Contact the provider or try a different join code.
        </Text>

        <TouchableOpacity
          style={[authStyles.primaryButton, { width: '100%', marginTop: 24 }]}
          onPress={handleTryAgain}
          activeOpacity={0.8}
        >
          <Text style={authStyles.primaryButtonText}>Try Another Code</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[authStyles.container, authStyles.centered]}>
      <ActivityIndicator size="large" color={COLORS.primary} style={{ marginBottom: 24 }} />

      <Text style={authStyles.title}>Waiting for Approval</Text>
      <Text style={authStyles.subtitle}>
        Your request has been sent. The provider will review and approve it shortly.
      </Text>

      {provider ? (
        <View style={styles.providerInfo}>
          <Text style={styles.providerName}>{provider.businessName}</Text>
          <Text style={styles.providerDetail}>Owner: {provider.ownerName}</Text>
          {provider.phoneNumber ? (
            <Text style={styles.providerDetail}>Contact: {provider.phoneNumber}</Text>
          ) : null}
          <Text style={styles.providerDetail}>Rate: ₹{provider.pricePerLiter}/litre</Text>
        </View>
      ) : null}

      {listenerError ? (
        <Text style={[authStyles.errorText, { textAlign: 'center', marginTop: 16 }]}>
          Unable to track request status. Check your connection.
        </Text>
      ) : (
        <Text style={styles.hint}>This screen will update automatically when approved.</Text>
      )}
    </View>
  );
}

const styles = {
  icon: {
    fontSize: 48,
    marginBottom: 16,
  },
  providerInfo: {
    marginTop: 32,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 20,
    width: '100%',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  providerName: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  providerDetail: {
    fontSize: 15,
    color: COLORS.textLight,
    marginBottom: 4,
  },
  hint: {
    marginTop: 24,
    fontSize: 13,
    color: COLORS.textLight,
    textAlign: 'center',
    fontStyle: 'italic',
  },
};
