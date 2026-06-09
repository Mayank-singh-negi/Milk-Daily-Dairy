import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuth } from '../contexts/AuthContext';

import WelcomeScreen from '../screens/auth/WelcomeScreen';
import RoleSelectionScreen from '../screens/auth/RoleSelectionScreen';
import PhoneInputScreen from '../screens/auth/PhoneInputScreen';
import OTPVerificationScreen from '../screens/auth/OTPVerificationScreen';
import ProviderRegistrationScreen from '../screens/auth/ProviderRegistrationScreen';
import JoinCodeScreen from '../screens/auth/JoinCodeScreen';
import WaitingApprovalScreen from '../screens/auth/WaitingApprovalScreen';
import AdminTabNavigator    from './AdminTabNavigator';
import CustomerTabNavigator from './CustomerTabNavigator';

import { COLORS } from '../constants';

const Stack = createStackNavigator();

const screenOptions = {
  headerStyle: { backgroundColor: COLORS.primary },
  headerTintColor: COLORS.white,
  headerTitleStyle: { fontWeight: 'bold' },
};

/**
 * Determines the initial route based on the current auth + profile state.
 * Called once when the navigator mounts. Navigation.reset() handles
 * subsequent transitions (e.g. after OTP verify, after registration).
 *
 * @param {{ user: import('firebase/auth').User | null, userRole: string | null, providerData: object | null, customerData: object | null }} auth
 * @returns {string}
 */
function resolveInitialRoute({ user, userRole, providerData, customerData }) {
  if (!user) {
    return 'Welcome';
  }

  if (userRole === 'provider' && providerData) {
    return 'AdminDashboard';
  }

  if (userRole === 'customer' && customerData) {
    return 'CustomerDashboard';
  }

  // Authenticated but profile not created yet.
  // We can't know the intended role here so fall back to Welcome
  // — the user will tap "I'm a Provider / Customer" again and proceed.
  return 'Welcome';
}

export default function AuthNavigator() {
  const { user, userRole, providerData, customerData } = useAuth();

  const initialRouteName = resolveInitialRoute({
    user,
    userRole,
    providerData,
    customerData,
  });

  return (
    <Stack.Navigator
      initialRouteName={initialRouteName}
      screenOptions={screenOptions}
    >
      {/* ── Unauthenticated flow ── */}
      <Stack.Screen
        name="Welcome"
        component={WelcomeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="RoleSelection"
        component={RoleSelectionScreen}
        options={{ title: 'Select Role' }}
      />
      <Stack.Screen
        name="PhoneInput"
        component={PhoneInputScreen}
        options={{ title: 'Phone Login' }}
      />
      <Stack.Screen
        name="OTPVerification"
        component={OTPVerificationScreen}
        options={{ title: 'Verify OTP' }}
      />

      {/* ── Post-auth registration ── */}
      <Stack.Screen
        name="ProviderRegistration"
        component={ProviderRegistrationScreen}
        options={{ title: 'Register', headerLeft: null, gestureEnabled: false }}
      />
      <Stack.Screen
        name="JoinCode"
        component={JoinCodeScreen}
        options={{ title: 'Join Provider', headerLeft: null, gestureEnabled: false }}
      />
      <Stack.Screen
        name="WaitingApproval"
        component={WaitingApprovalScreen}
        options={{ title: 'Pending Approval', headerLeft: null, gestureEnabled: false }}
      />

      {/* ── Authenticated destinations ── */}
      <Stack.Screen
        name="AdminDashboard"
        component={AdminTabNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CustomerDashboard"
        component={CustomerTabNavigator}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
