import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { getCurrentUser } from '../../services/firebase/auth';
import {
  searchProviderByCode,
  sendJoinRequest,
  CustomerServiceError,
} from '../../services/firebase/customer';
import { COLORS } from '../../constants';
import { authStyles } from './authStyles';

/**
 * Customer join-code screen — find provider and send join request.
 * @param {{ navigation: import('@react-navigation/native').NavigationProp<Record<string, object>>, route: import('@react-navigation/native').RouteProp<Record<string, object>, string> }} props
 */
export default function JoinCodeScreen({ navigation, route }) {
  const { phoneNumber, uid: routeUid } = route.params ?? {};

  const [joinCode, setJoinCode] = useState('');
  const [provider, setProvider] = useState(null);
  const [error, setError] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [requestLoading, setRequestLoading] = useState(false);

  const handleCodeChange = (text) => {
    const formatted = text.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    setJoinCode(formatted);
    if (error) {
      setError('');
    }
    if (provider) {
      setProvider(null);
    }
  };

  const handleFindProvider = async () => {
    if (!joinCode.trim()) {
      setError('Please enter a join code.');
      return;
    }

    setSearchLoading(true);
    setError('');
    setProvider(null);

    try {
      const result = await searchProviderByCode(joinCode);

      if (!result) {
        setError('No provider found with this join code. Please check and try again.');
        return;
      }

      setProvider(result);
    } catch (err) {
      const message =
        err instanceof CustomerServiceError
          ? err.message
          : 'Failed to search provider. Please try again.';
      setError(message);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSendRequest = async () => {
    if (!provider) {
      return;
    }

    const uid = routeUid || getCurrentUser()?.uid;
    const userPhone = phoneNumber || getCurrentUser()?.phoneNumber || '';

    if (!uid) {
      setError('Session expired. Please sign in again.');
      return;
    }

    setRequestLoading(true);
    setError('');

    try {
      const { requestId } = await sendJoinRequest(provider.id, {
        uid,
        phoneNumber: userPhone,
      });

      navigation.replace('WaitingApproval', {
        requestId,
        provider,
        phoneNumber: userPhone,
        uid,
      });
    } catch (err) {
      const message =
        err instanceof CustomerServiceError
          ? err.message
          : 'Failed to send request. Please try again.';
      setError(message);
    } finally {
      setRequestLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[authStyles.container, { flexGrow: 1 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={[authStyles.title, { textAlign: 'left' }]}>Join Your Provider</Text>
        <Text style={[authStyles.subtitle, { textAlign: 'left', marginBottom: 24 }]}>
          Enter the join code shared by your milk provider.
        </Text>

        <Text style={authStyles.label}>Provider Join Code</Text>
        <TextInput
          style={[authStyles.input, error && !provider && authStyles.inputError]}
          placeholder="e.g. SHAR-4821"
          placeholderTextColor="#AAA"
          value={joinCode}
          onChangeText={handleCodeChange}
          autoCapitalize="characters"
          editable={!searchLoading && !requestLoading}
        />

        <TouchableOpacity
          style={[
            authStyles.primaryButton,
            searchLoading && authStyles.primaryButtonDisabled,
          ]}
          onPress={handleFindProvider}
          disabled={searchLoading || requestLoading}
          activeOpacity={0.8}
        >
          {searchLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={authStyles.primaryButtonText}>Find Provider</Text>
          )}
        </TouchableOpacity>

        {error && !provider ? (
          <Text style={[authStyles.errorText, { marginTop: 12 }]}>{error}</Text>
        ) : null}

        {provider ? (
          <View style={styles.providerCard}>
            <Text style={styles.cardTitle}>Provider Found</Text>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Business</Text>
              <Text style={styles.detailValue}>{provider.businessName}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Owner</Text>
              <Text style={styles.detailValue}>{provider.ownerName}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Rate</Text>
              <Text style={styles.detailValue}>₹{provider.pricePerLiter}/litre</Text>
            </View>

            {provider.address ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Address</Text>
                <Text style={styles.detailValue}>{provider.address}</Text>
              </View>
            ) : null}

            {provider.phoneNumber ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Contact</Text>
                <Text style={styles.detailValue}>{provider.phoneNumber}</Text>
              </View>
            ) : null}

            {error ? (
              <Text style={[authStyles.errorText, { marginTop: 8 }]}>{error}</Text>
            ) : null}

            <TouchableOpacity
              style={[
                authStyles.primaryButton,
                { marginTop: 16 },
                requestLoading && authStyles.primaryButtonDisabled,
              ]}
              onPress={handleSendRequest}
              disabled={requestLoading}
              activeOpacity={0.8}
            >
              {requestLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={authStyles.primaryButtonText}>Send Join Request</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  providerCard: {
    marginTop: 24,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 16,
  },
  detailRow: {
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 12,
    color: COLORS.textLight,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '500',
  },
});
