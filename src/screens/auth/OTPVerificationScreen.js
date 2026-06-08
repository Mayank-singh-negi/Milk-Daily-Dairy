import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import OTPInputView from '@twotalltotems/react-native-otp-input';
import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';
import {
  signInWithPhone,
  verifyOTP,
  FirebaseAuthError,
} from '../../services/firebase/auth';
import { getUserProfile } from '../../services/firebase/users';
import { firebaseConfig } from '../../services/firebase/config';
import { COLORS } from '../../constants';
import { authStyles } from './authStyles';

const RESEND_COOLDOWN_SECONDS = 30;

/**
 * Masks a phone number for display (e.g. +91 98765*****).
 * @param {string} phoneNumber
 * @returns {string}
 */
function maskPhoneNumber(phoneNumber) {
  if (!phoneNumber || phoneNumber.length < 8) {
    return phoneNumber;
  }

  return `${phoneNumber.slice(0, 8)}*****`;
}

/**
 * OTP verification screen — validates code and routes by user role/profile.
 * @param {{ navigation: import('@react-navigation/native').NavigationProp<Record<string, object>>, route: import('@react-navigation/native').RouteProp<Record<string, object>, string> }} props
 */
export default function OTPVerificationScreen({ navigation, route }) {
  const {
    phoneNumber,
    verificationId: initialVerificationId,
    userRole,
  } = route.params ?? {};

  const recaptchaVerifier = useRef(null);

  const [otp, setOtp] = useState('');
  const [verificationId, setVerificationId] = useState(initialVerificationId);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(RESEND_COOLDOWN_SECONDS);

  useEffect(() => {
    if (resendTimer <= 0) {
      return undefined;
    }

    const interval = setInterval(() => {
      setResendTimer((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [resendTimer]);

  /**
   * Routes the user after successful authentication based on role and profile.
   * @param {string} uid
   */
  const navigateToRegistration = (uid) => {
    if (userRole === 'provider') {
      navigation.reset({
        index: 0,
        routes: [{ name: 'ProviderRegistration', params: { phoneNumber, uid } }],
      });
      return;
    }

    navigation.reset({
      index: 0,
      routes: [{ name: 'JoinCode', params: { phoneNumber, uid } }],
    });
  };

  const navigateAfterAuth = async (uid) => {
    const profile = await getUserProfile(uid, phoneNumber, userRole);

    if (profile.offline) {
      navigateToRegistration(uid);
      return;
    }

    if (userRole === 'provider') {
      if (profile.exists) {
        navigation.reset({
          index: 0,
          routes: [{ name: 'AdminDashboard', params: { uid } }],
        });
      } else {
        navigation.reset({
          index: 0,
          routes: [{ name: 'ProviderRegistration', params: { phoneNumber, uid } }],
        });
      }
      return;
    }

    if (profile.exists) {
      navigation.reset({ index: 0, routes: [{ name: 'CustomerDashboard' }] });
    } else {
      navigation.reset({
        index: 0,
        routes: [{ name: 'JoinCode', params: { phoneNumber, uid } }],
      });
    }
  };

  const handleVerify = async () => {
    if (!/^\d{6}$/.test(otp)) {
      setError('Please enter the complete 6-digit OTP.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const user = await verifyOTP(verificationId, otp);
      await navigateAfterAuth(user.uid);
    } catch (err) {
      const message =
        err instanceof FirebaseAuthError
          ? err.message
          : 'Verification failed. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (resendTimer > 0 || resendLoading) {
      return;
    }

    setResendLoading(true);
    setError('');
    setOtp('');

    try {
      const { verificationId: newVerificationId } = await signInWithPhone(
        phoneNumber,
        recaptchaVerifier.current
      );

      setVerificationId(newVerificationId);
      setResendTimer(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      const message =
        err instanceof FirebaseAuthError
          ? err.message
          : 'Failed to resend OTP. Please try again.';
      setError(message);
    } finally {
      setResendLoading(false);
    }
  };

  const canResend = resendTimer <= 0 && !resendLoading;

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

        <Text style={authStyles.title}>Verify OTP</Text>
        <Text style={authStyles.subtitle}>
          Enter the 6-digit code sent to{'\n'}
          {maskPhoneNumber(phoneNumber)}
        </Text>

        <OTPInputView
          style={{ width: '100%', height: 80 }}
          pinCount={6}
          code={otp}
          onCodeChanged={(code) => {
            setOtp(code ?? '');
            if (error) {
              setError('');
            }
          }}
          onCodeFilled={(code) => setOtp(code ?? '')}
          autoFocusOnLoad
          codeInputFieldStyle={{
            width: 45,
            height: 52,
            borderWidth: 1,
            borderRadius: 10,
            borderColor: error ? COLORS.error : '#DDD',
            color: COLORS.text,
            fontSize: 20,
            fontWeight: '600',
            backgroundColor: COLORS.white,
          }}
          codeInputHighlightStyle={{
            borderColor: COLORS.primary,
          }}
          editable={!loading}
        />

        {error ? (
          <Text style={[authStyles.errorText, { marginTop: 12 }]}>{error}</Text>
        ) : null}

        <TouchableOpacity
          style={[
            authStyles.primaryButton,
            loading && authStyles.primaryButtonDisabled,
          ]}
          onPress={handleVerify}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={authStyles.primaryButtonText}>Verify</Text>
          )}
        </TouchableOpacity>

        <View style={authStyles.resendRow}>
          <Text style={authStyles.resendText}>Didn't receive the code? </Text>
          <TouchableOpacity
            onPress={handleResendOTP}
            disabled={!canResend}
            activeOpacity={0.7}
          >
            {resendLoading ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <Text
                style={[
                  authStyles.resendLink,
                  !canResend && authStyles.resendDisabled,
                ]}
              >
                {canResend ? 'Resend OTP' : `Resend in ${resendTimer}s`}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
