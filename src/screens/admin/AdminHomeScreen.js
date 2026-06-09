import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  StyleSheet, RefreshControl, Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { getCustomersByProvider } from '../../services/firebase/customer';
import { getDeliveriesForDate } from '../../services/firebase/deliveries';
import { getBillsByProvider } from '../../services/firebase/bills';
import { FIELDS, PAID_STATUS, DELIVERY_STATUS, SUBSCRIPTION_STATUS } from '../../constants/firebase';
import { COLORS } from '../../constants';

function today() {
  return new Date().toISOString().split('T')[0];
}
function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function StatCard({ icon, label, value, color, onPress }) {
  return (
    <TouchableOpacity style={[styles.statCard, onPress ? {} : { opacity: 1 }]} onPress={onPress} activeOpacity={onPress ? 0.7 : 1}>
      <View style={[styles.statIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function AdminHomeScreen() {
  const { providerData } = useAuth();
  const navigation = useNavigation();

  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats]           = useState({
    totalCustomers: 0,
    deliveredToday: 0,
    totalToday: 0,
    monthRevenue: 0,
    pendingDues: 0,
  });

  const businessName = providerData?.[FIELDS.BUSINESS_NAME] ?? '';
  const ownerName    = providerData?.[FIELDS.OWNER_NAME]    ?? '';
  const joinCode     = providerData?.[FIELDS.JOIN_CODE]     ?? '';
  const providerId   = providerData?.id                     ?? '';

  const loadStats = useCallback(async () => {
    if (!providerId) return;
    try {
      const [customers, deliveries, bills] = await Promise.all([
        getCustomersByProvider(providerId),
        getDeliveriesForDate(providerId, today()),
        getBillsByProvider(providerId, currentMonth()),
      ]);

      const active    = customers.filter((c) => c.data[FIELDS.SUBSCRIPTION_STATUS] !== SUBSCRIPTION_STATUS.CANCELLED);
      const delivered = Object.values(deliveries).filter((d) => d.status === DELIVERY_STATUS.DELIVERED).length;
      const revenue   = bills.filter((b) => b[FIELDS.PAID_STATUS] === PAID_STATUS.PAID).reduce((s, b) => s + (b.amount ?? 0), 0);
      const pending   = bills.filter((b) => b[FIELDS.PAID_STATUS] !== PAID_STATUS.PAID).reduce((s, b) => s + (b.amount ?? 0), 0);

      setStats({
        totalCustomers: active.length,
        deliveredToday: delivered,
        totalToday:     active.length,
        monthRevenue:   revenue,
        pendingDues:    pending,
      });
    } catch (err) {
      console.error('Failed to load home stats:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [providerId]);

  useEffect(() => { loadStats(); }, [loadStats]);

  const copyJoinCode = async () => {
    await Clipboard.setStringAsync(joinCode);
    Alert.alert('Copied', `Join code ${joinCode} copied to clipboard.`);
  };

  if (loading) return (
    <View style={styles.centered}><ActivityIndicator size="large" color={COLORS.primary} /></View>
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadStats(); }} colors={[COLORS.primary]} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Greeting */}
      <View style={styles.greetingCard}>
        <Text style={styles.greetingText}>{greeting()},</Text>
        <Text style={styles.businessName}>{businessName || ownerName}</Text>
        <Text style={styles.greetingDate}>
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
        </Text>
      </View>

      {/* Stats grid */}
      <Text style={styles.sectionTitle}>Overview</Text>
      <View style={styles.statsGrid}>
        <StatCard icon="people" label="Active Customers" value={stats.totalCustomers} color={COLORS.primary} />
        <StatCard
          icon="checkmark-circle"
          label="Delivered Today"
          value={`${stats.deliveredToday}/${stats.totalToday}`}
          color="#27AE60"
          onPress={() => navigation.navigate('Delivery')}
        />
        <StatCard icon="cash" label="Month Revenue" value={`₹${stats.monthRevenue}`} color="#8E44AD" />
        <StatCard icon="alert-circle" label="Pending Dues" value={`₹${stats.pendingDues}`} color={COLORS.error} />
      </View>

      {/* Join Code card */}
      <Text style={styles.sectionTitle}>Your Join Code</Text>
      <View style={styles.codeCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.codeValue}>{joinCode}</Text>
          <Text style={styles.codeHint}>Share this with customers to connect</Text>
        </View>
        <TouchableOpacity style={styles.copyBtn} onPress={copyJoinCode}>
          <Ionicons name="copy-outline" size={20} color={COLORS.primary} />
          <Text style={styles.copyBtnText}>Copy</Text>
        </TouchableOpacity>
      </View>

      {/* Quick actions */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('Delivery')}>
          <Ionicons name="checkmark-circle" size={28} color="#27AE60" />
          <Text style={styles.actionLabel}>Today's Delivery</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('Customers')}>
          <Ionicons name="person-add" size={28} color={COLORS.primary} />
          <Text style={styles.actionLabel}>Add Customer</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('More', { screen: 'Billing' })}>
          <Ionicons name="receipt" size={28} color="#8E44AD" />
          <Text style={styles.actionLabel}>Billing</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  greetingCard: {
    margin: 16, backgroundColor: COLORS.primary, borderRadius: 16,
    padding: 20,
  },
  greetingText:  { fontSize: 14, color: 'rgba(255,255,255,0.8)' },
  businessName:  { fontSize: 22, fontWeight: '800', color: COLORS.white, marginTop: 2 },
  greetingDate:  { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginLeft: 16, marginBottom: 10, marginTop: 8 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 10 },
  statCard: {
    width: '47%', backgroundColor: COLORS.white, borderRadius: 14, padding: 16,
    alignItems: 'flex-start', elevation: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4,
  },
  statIcon:  { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  statValue: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  statLabel: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  codeCard: {
    marginHorizontal: 16, backgroundColor: COLORS.white, borderRadius: 14, padding: 20,
    flexDirection: 'row', alignItems: 'center', gap: 12, elevation: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4,
  },
  codeValue:   { fontSize: 26, fontWeight: '800', color: COLORS.primary, letterSpacing: 2 },
  codeHint:    { fontSize: 12, color: COLORS.textLight, marginTop: 4 },
  copyBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#E8F2FC', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20 },
  copyBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  actionsRow:  { flexDirection: 'row', paddingHorizontal: 12, gap: 10, marginBottom: 20 },
  actionCard:  {
    flex: 1, backgroundColor: COLORS.white, borderRadius: 14, padding: 16,
    alignItems: 'center', gap: 8, elevation: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4,
  },
  actionLabel: { fontSize: 12, fontWeight: '600', color: COLORS.text, textAlign: 'center' },
});
