import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import WelcomeScreen from '../screens/auth/WelcomeScreen';
import RoleSelectionScreen from '../screens/auth/RoleSelectionScreen';
import PhoneInputScreen from '../screens/auth/PhoneInputScreen';
import OTPVerificationScreen from '../screens/auth/OTPVerificationScreen';
import ProviderRegistrationScreen from '../screens/auth/ProviderRegistrationScreen';
import JoinCodeScreen from '../screens/auth/JoinCodeScreen';
import WaitingApprovalScreen from '../screens/auth/WaitingApprovalScreen';
import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';
import CustomerDashboardScreen from '../screens/customer/CustomerDashboardScreen';
import { COLORS } from '../constants';

const Stack = createStackNavigator();

const screenOptions = {
  headerStyle: { backgroundColor: COLORS.primary },
  headerTintColor: COLORS.white,
  headerTitleStyle: { fontWeight: 'bold' },
};

export default function AuthNavigator() {
  return (
    <Stack.Navigator initialRouteName="Welcome" screenOptions={screenOptions}>
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
      <Stack.Screen
        name="AdminDashboard"
        component={AdminDashboardScreen}
        options={{ title: 'Dashboard', headerLeft: null, gestureEnabled: false }}
      />
      <Stack.Screen
        name="CustomerDashboard"
        component={CustomerDashboardScreen}
        options={{ title: 'My Milk', headerLeft: null, gestureEnabled: false }}
      />
    </Stack.Navigator>
  );
}
