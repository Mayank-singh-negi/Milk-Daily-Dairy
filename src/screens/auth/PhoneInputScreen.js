import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';
import { signInWithPhone, FirebaseAuthError } from '../../services/firebase/auth';
import { firebaseConfig } from '../../services/firebase/config';
import { authStyles } from './authStyles';

const COUNTRY_CODE = '+91';

/**
 * Validates a 10-digit Indian mobile number.
 * @param {string} digits
 * @returns {string | null} Error message or null if valid.
 */
function validatePhoneDigits(digits) {
  if (!digits) {
    return 'Phone number is required.';
  }

  if (!/^\d{10}$/.test(digits)) {
    return 'Enter a valid 10-digit phone number.';
  }

  if (!/^[6-9]/.test(digits)) {
    return 'Phone number must start with 6, 7, 8, or 9.';
  }

  return null;
}

/**
 * Phone number input screen — sends OTP via Firebase.
 * @param {{ navigation: import('@react-navigation/native').NavigationProp<Record<string, object>>, route: import('@react-navigation/native').RouteProp<Record<string, object>, string> }} props
 */
export default function PhoneInputScreen({ navigation, route }) {
  const { userRole } = route.params ?? {};
  const recaptchaVerifier = useRef(null);

  const [phoneDigits, setPhoneDigits] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePhoneChange = (text) => {
    const digitsOnly = text.replace(/\D/g, '').slice(0, 10);
    setPhoneDigits(digitsOnly);
    if (error) {
      setError('');
    }
  };

  const handleSendOTP = async () => {
    const validationError = validatePhoneDigits(phoneDigits);

    if (validationError) {
      setError(validationError);
      return;
    }

    const phoneNumber = `${COUNTRY_CODE}${phoneDigits}`;

    setLoading(true);
    setError('');

    try {
      const { verificationId } = await signInWithPhone(
        phoneNumber,
        recaptchaVerifier.current
      );

      navigation.navigate('OTPVerification', {
        phoneNumber,
        verificationId,
        userRole,
      });
    } catch (err) {
      const message =
        err instanceof FirebaseAuthError
          ? err.message
          : 'Failed to send OTP. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={authStyles.container}>
        <FirebaseRecaptchaVerifierModal
          ref={recaptchaVerifier}
          firebaseConfig={firebaseConfig}
          attemptInvisibleVerification
          appVerificationDisabledForTesting={__DEV__}
        />

        <View style={authStyles.roleBadge}>
          <Text style={authStyles.roleBadgeText}>{userRole}</Text>
        </View>

        <Text style={authStyles.title}>Enter Phone Number</Text>
        <Text style={authStyles.subtitle}>
          We'll send a 6-digit verification code to your mobile number.
        </Text>

        <Text style={authStyles.label}>Mobile Number</Text>
        <View style={authStyles.phoneRow}>
          <Text style={authStyles.countryCode}>{COUNTRY_CODE}</Text>
          <TextInput
            style={[
              authStyles.input,
              authStyles.phoneInput,
              error ? authStyles.inputError : null,
            ]}
            placeholder="9876543210"
            placeholderTextColor="#AAA"
            keyboardType="phone-pad"
            maxLength={10}
            value={phoneDigits}
            onChangeText={handlePhoneChange}
            editable={!loading}
          />
        </View>

        {error ? <Text style={authStyles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[
            authStyles.primaryButton,
            loading && authStyles.primaryButtonDisabled,
          ]}
          onPress={handleSendOTP}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={authStyles.primaryButtonText}>Send OTP</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
