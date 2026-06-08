import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../constants';

/**
 * Customer dashboard placeholder.
 * @param {{ route: import('@react-navigation/native').RouteProp<Record<string, object>, string> }} props
 */
export default function CustomerDashboardScreen({ route }) {
  const { providerName } = route.params ?? {};

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Customer Dashboard</Text>
      {providerName ? (
        <Text style={styles.welcome}>Connected to {providerName}</Text>
      ) : null}
      <Text style={styles.subtitle}>Your milk delivery — coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  welcome: {
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: '600',
    marginTop: 8,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textLight,
    marginTop: 8,
  },
});
