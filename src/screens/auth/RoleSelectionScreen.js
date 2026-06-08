import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { APP_NAME } from '../../constants';
import { authStyles } from './authStyles';

/**
 * Role selection screen — confirms role before phone login.
 * @param {{ navigation: import('@react-navigation/native').NavigationProp<Record<string, object>>, route: import('@react-navigation/native').RouteProp<Record<string, object>, string> }} props
 */
export default function RoleSelectionScreen({ navigation, route }) {
  const preselectedRole = route.params?.userRole;
  const [selectedRole, setSelectedRole] = React.useState(preselectedRole ?? null);

  const handleContinue = () => {
    if (!selectedRole) {
      return;
    }
    navigation.navigate('PhoneInput', { userRole: selectedRole });
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

      <Text style={authStyles.title}>Choose Your Role</Text>
      <Text style={authStyles.subtitle}>
        Select how you want to use {APP_NAME}
      </Text>

      <TouchableOpacity
        style={[
          authStyles.primaryButton,
          { width: '100%' },
          selectedRole !== 'provider' && { opacity: selectedRole ? 0.5 : 1 },
        ]}
        onPress={() => setSelectedRole('provider')}
        activeOpacity={0.8}
      >
        <Text style={authStyles.primaryButtonText}>I'm a Provider</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          authStyles.secondaryButton,
          { width: '100%' },
          selectedRole !== 'customer' && { opacity: selectedRole ? 0.5 : 1 },
        ]}
        onPress={() => setSelectedRole('customer')}
        activeOpacity={0.8}
      >
        <Text style={authStyles.secondaryButtonText}>I'm a Customer</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          authStyles.primaryButton,
          { width: '100%', marginTop: 24 },
          !selectedRole && authStyles.primaryButtonDisabled,
        ]}
        onPress={handleContinue}
        disabled={!selectedRole}
        activeOpacity={0.8}
      >
        <Text style={authStyles.primaryButtonText}>Continue</Text>
      </TouchableOpacity>
    </View>
  );
}
