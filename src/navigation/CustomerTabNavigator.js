import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';

import CustomerHomeScreen     from '../screens/customer/CustomerHomeScreen';
import CustomerCalendarScreen from '../screens/customer/CustomerCalendarScreen';
import CustomerBillsScreen    from '../screens/customer/CustomerBillsScreen';
import CustomerQueriesScreen  from '../screens/customer/CustomerQueriesScreen';

import { COLORS } from '../constants';

const Tab   = createBottomTabNavigator();
const Stack = createStackNavigator();

const headerOpts = {
  headerStyle: { backgroundColor: COLORS.primary },
  headerTintColor: COLORS.white,
  headerTitleStyle: { fontWeight: 'bold' },
};

/** Bills tab has a stack so BillDetail can push */
function BillsStack() {
  return (
    <Stack.Navigator screenOptions={headerOpts}>
      <Stack.Screen name="BillsList" component={CustomerBillsScreen} options={{ title: 'My Bills' }} />
    </Stack.Navigator>
  );
}

function getTabIcon(routeName, focused) {
  const icons = {
    Home:     focused ? 'home'           : 'home-outline',
    Calendar: focused ? 'calendar'       : 'calendar-outline',
    Bills:    focused ? 'receipt'        : 'receipt-outline',
    Queries:  focused ? 'chatbubbles'    : 'chatbubbles-outline',
  };
  return icons[routeName] ?? 'ellipse-outline';
}

export default function CustomerTabNavigator() {
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
      <Tab.Screen name="Home"     component={CustomerHomeScreen}     options={{ title: 'My Milk' }} />
      <Tab.Screen name="Calendar" component={CustomerCalendarScreen} options={{ title: 'Calendar' }} />
      <Tab.Screen name="Bills"    component={BillsStack}             options={{ title: 'Bills', headerShown: false }} />
      <Tab.Screen name="Queries"  component={CustomerQueriesScreen}  options={{ title: 'Queries' }} />
    </Tab.Navigator>
  );
}
