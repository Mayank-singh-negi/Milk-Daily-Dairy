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
  Alert,
} from 'react-native';
import { getCurrentUser } from '../../services/firebase/auth';
import { createProvider, ProviderServiceError } from '../../services/firebase/provider';
import { authStyles } from './authStyles';

const DEFAULT_MILK_RATE = '60';

/**
 * Validates provider registration form fields.
 * @param {{ businessName: string, ownerName: string, pricePerLiter: string }} fields
 * @returns {Record<string, string>}
 */
function validateForm(fields) {
  /** @type {Record<string, string>} */
  const errors = {};

  if (!fields.businessName.trim()) {
    errors.businessName = 'Business name is required.';
  } else if (fields.businessName.trim().length < 2) {
    errors.businessName = 'Business name must be at least 2 characters.';
  }

  if (!fields.ownerName.trim()) {
    errors.ownerName = 'Owner name is required.';
  } else if (fields.ownerName.trim().length < 2) {
    errors.ownerName = 'Owner name must be at least 2 characters.';
  }

  const rate = parseFloat(fields.pricePerLiter);

  if (!fields.pricePerLiter.trim()) {
    errors.pricePerLiter = 'Milk rate is required.';
  } else if (Number.isNaN(rate) || rate <= 0) {
    errors.pricePerLiter = 'Enter a valid rate greater than 0.';
  } else if (rate > 500) {
    errors.pricePerLiter = 'Rate seems too high. Please check the value.';
  }

  return errors;
}

/**
 * Provider onboarding form — saves profile to Firestore and navigates to dashboard.
 * @param {{ navigation: import('@react-navigation/native').NavigationProp<Record<string, object>>, route: import('@react-navigation/native').RouteProp<Record<string, object>, string> }} props
 */
export default function ProviderRegistrationScreen({ navigation, route }) {
  const { phoneNumber, uid: routeUid } = route.params ?? {};

  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [address, setAddress] = useState('');
  const [pricePerLiter, setPricePerLiter] = useState(DEFAULT_MILK_RATE);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [loading, setLoading] = useState(false);

  const clearFieldError = (field) => {
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSubmit = async () => {
    const errors = validateForm({ businessName, ownerName, pricePerLiter });

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    const uid = routeUid || getCurrentUser()?.uid;

    if (!uid) {
      setSubmitError('Session expired. Please sign in again.');
      return;
    }

    const userPhone = phoneNumber || getCurrentUser()?.phoneNumber || '';

    setLoading(true);
    setSubmitError('');
    setFieldErrors({});

    try {
      const { joinCode } = await createProvider({
        uid,
        phoneNumber: userPhone,
        businessName,
        ownerName,
        address,
        pricePerLiter: parseFloat(pricePerLiter),
      });

      Alert.alert(
        'Registration Successful',
        `Your provider profile is ready.\n\nShare this join code with customers:\n\n${joinCode}`,
        [
          {
            text: 'Go to Dashboard',
            onPress: () => {
              navigation.reset({
                index: 0,
                routes: [{ name: 'AdminDashboard', params: { joinCode, businessName } }],
              });
            },
          },
        ],
        { cancelable: false }
      );
    } catch (err) {
      const message =
        err instanceof ProviderServiceError
          ? err.message
          : 'Registration failed. Please try again.';
      setSubmitError(message);
    } finally {
      setLoading(false);
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
        <Text style={[authStyles.title, { textAlign: 'left' }]}>Provider Registration</Text>
        <Text style={[authStyles.subtitle, { textAlign: 'left', marginBottom: 24 }]}>
          Complete your profile to start delivering milk.
        </Text>

        {phoneNumber ? (
          <Text style={{ color: '#4A90D9', fontWeight: '600', marginBottom: 20 }}>
            {phoneNumber}
          </Text>
        ) : null}

        <Text style={authStyles.label}>Business Name *</Text>
        <TextInput
          style={[authStyles.input, fieldErrors.businessName && authStyles.inputError]}
          placeholder="e.g. Sharma Dairy"
          placeholderTextColor="#AAA"
          value={businessName}
          onChangeText={(text) => {
            setBusinessName(text);
            clearFieldError('businessName');
          }}
          editable={!loading}
        />
        {fieldErrors.businessName ? (
          <Text style={authStyles.errorText}>{fieldErrors.businessName}</Text>
        ) : null}

        <Text style={authStyles.label}>Owner Name *</Text>
        <TextInput
          style={[authStyles.input, fieldErrors.ownerName && authStyles.inputError]}
          placeholder="e.g. Rajesh Sharma"
          placeholderTextColor="#AAA"
          value={ownerName}
          onChangeText={(text) => {
            setOwnerName(text);
            clearFieldError('ownerName');
          }}
          editable={!loading}
        />
        {fieldErrors.ownerName ? (
          <Text style={authStyles.errorText}>{fieldErrors.ownerName}</Text>
        ) : null}

        <Text style={authStyles.label}>Address (optional)</Text>
        <TextInput
          style={[authStyles.input, { minHeight: 80, textAlignVertical: 'top' }]}
          placeholder="Shop / delivery area address"
          placeholderTextColor="#AAA"
          value={address}
          onChangeText={setAddress}
          multiline
          numberOfLines={3}
          editable={!loading}
        />

        <Text style={authStyles.label}>Default Milk Rate (₹/litre) *</Text>
        <TextInput
          style={[authStyles.input, fieldErrors.pricePerLiter && authStyles.inputError]}
          placeholder="60"
          placeholderTextColor="#AAA"
          value={pricePerLiter}
          onChangeText={(text) => {
            setPricePerLiter(text.replace(/[^0-9.]/g, ''));
            clearFieldError('pricePerLiter');
          }}
          keyboardType="decimal-pad"
          editable={!loading}
        />
        {fieldErrors.pricePerLiter ? (
          <Text style={authStyles.errorText}>{fieldErrors.pricePerLiter}</Text>
        ) : null}

        {submitError ? (
          <Text style={[authStyles.errorText, { marginTop: 8 }]}>{submitError}</Text>
        ) : null}

        <TouchableOpacity
          style={[
            authStyles.primaryButton,
            loading && authStyles.primaryButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={authStyles.primaryButtonText}>Complete Registration</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
