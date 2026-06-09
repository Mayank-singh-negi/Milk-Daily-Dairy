import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';

import AdminHomeScreen      from '../screens/admin/AdminHomeScreen';
import AdminCustomersScreen from '../screens/admin/AdminCustomersScreen';
import AdminDeliveryScreen  from '../screens/admin/AdminDeliveryScreen';
import AdminMoreScreen      from '../screens/admin/AdminMoreScreen';
import AdminBillingScreen   from '../screens/admin/AdminBillingScreen';
import AdminQueriesScreen   from '../screens/admin/AdminQueriesScreen';

import { COLORS } from '../constants';

const Tab   = createBottomTabNavigator();
const Stack = createStackNavigator();

const headerOpts = {
  headerStyle: { backgroundColor: COLORS.primary },
  headerTintColor: COLORS.white,
  headerTitleStyle: { fontWeight: 'bold' },
};

/** More tab has its own stack so Billing & Queries screen can be pushed */
function MoreStack() {
  return (
    <Stack.Navigator screenOptions={headerOpts}>
      <Stack.Screen name="MoreHome" component={AdminMoreScreen} options={{ title: 'More' }} />
      <Stack.Screen name="Billing"  component={AdminBillingScreen} options={{ title: 'Billing' }} />
      <Stack.Screen name="Queries"  component={AdminQueriesScreen} options={{ title: 'Queries & Disputes' }} />
    </Stack.Navigator>
  );
}

function getTabIcon(routeName, focused) {
  const icons = {
    Home:      focused ? 'home'             : 'home-outline',
    Customers: focused ? 'people'           : 'people-outline',
    Delivery:  focused ? 'checkmark-circle' : 'checkmark-circle-outline',
    More:      focused ? 'menu'             : 'menu-outline',
  };
  return icons[routeName] ?? 'ellipse-outline';
}

export default function AdminTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: COLORS.primary },
        headerTintColor: COLORS.white,
        headerTitleStyle: { fontWeight: 'bold' },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textLight,
        tabBarStyle: {
          backgroundColor: COLORS.white,
          borderTopWidth: 1,
          borderTopColor: '#E8E8E8',
          paddingBottom: 4,
          paddingTop: 4,
          height: 60,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarIcon: ({ focused, color, size }) => (
          <Ionicons name={getTabIcon(route.name, focused)} size={size} color={color} />
        ),
      })}
    >
      <Tab.Screen name="Home"      component={AdminHomeScreen}      options={{ title: 'Home' }} />
      <Tab.Screen name="Customers" component={AdminCustomersScreen} options={{ title: 'Customers' }} />
      <Tab.Screen name="Delivery"  component={AdminDeliveryScreen}  options={{ title: 'Delivery' }} />
      <Tab.Screen name="More"      component={MoreStack}            options={{ title: 'More', headerShown: false }} />
    </Tab.Navigator>
  );
}
