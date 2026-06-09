import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import AuthNavigator from './AuthNavigator';
import { COLORS } from '../constants';

export const navigationRef = createNavigationContainerRef();

function LoadingScreen() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={COLORS.primary} />
    </View>
  );
}

function RootNavigator() {
  const { loading } = useAuth();
  if (loading) return <LoadingScreen />;
  return <AuthNavigator />;
}

export default function AppNavigator() {
  return (
    <AuthProvider>
      <NavigationContainer ref={navigationRef}>
        <RootNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
});
