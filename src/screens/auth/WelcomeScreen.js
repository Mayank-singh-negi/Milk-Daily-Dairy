import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { APP_NAME } from '../../constants';
import { authStyles } from './authStyles';

/**
 * Welcome screen with app branding and role selection entry points.
 * @param {{ navigation: import('@react-navigation/native').NavigationProp<Record<string, object>> }} props
 */
export default function WelcomeScreen({ navigation }) {
  const handleRoleSelect = (userRole) => {
    navigation.navigate('RoleSelection', { userRole });
  };

  return (
    <View style={[authStyles.container, authStyles.centered]}>
      <View style={authStyles.logoContainer}>
        <Image
          source={require('../../../assets/icon.png')}
          style={{ width: 64, height: 64, borderRadius: 32 }}
          resizeMode="cover"
        />
      </View>

      <Text style={authStyles.title}>{APP_NAME}</Text>
      <Text style={authStyles.subtitle}>
        Fresh milk delivery, managed simply.{'\n'}
        Sign in to get started.
      </Text>

      <TouchableOpacity
        style={[authStyles.primaryButton, { width: '100%' }]}
        onPress={() => handleRoleSelect('provider')}
        activeOpacity={0.8}
      >
        <Text style={authStyles.primaryButtonText}>I'm a Provider</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[authStyles.secondaryButton, { width: '100%' }]}
        onPress={() => handleRoleSelect('customer')}
        activeOpacity={0.8}
      >
        <Text style={authStyles.secondaryButtonText}>I'm a Customer</Text>
      </TouchableOpacity>

    </View>
  );
}
