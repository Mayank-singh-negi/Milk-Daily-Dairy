import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, ActivityIndicator,
  StyleSheet, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { getCustomerDeliveries } from '../../services/firebase/deliveries';
import { getBillsByCustomer } from '../../services/firebase/bills';
import { FIELDS, DELIVERY_STATUS } from '../../constants/firebase';
import { COLORS } from '../../constants';

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function today() { return new Date().toISOString().split('T')[0]; }
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function CustomerHomeScreen() {
  const { customerData } = useAuth();
  const customerId   = customerData?.id ?? customerData?.uid ?? '';
  const name         = customerData?.[FIELDS.NAME]          ?? 'there';
  const providerName = '—'; // loaded from provider later if needed

  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [todayStatus, setTodayStatus] = useState(null);
  const [monthStats, setMonthStats]   = useState({ days: 0, litres: 0, amount: 0 });
  const [latestBill, setLatestBill]   = useState(null);

  const load = useCallback(async () => {
    if (!customerId) return;
    try {
      const month = currentMonth();
      const [deliveries, bills] = await Promise.all([
        getCustomerDeliveries(customerId, month),
        getBillsByCustomer(customerId),
      ]);

      // Today's status
      const todayEntry = deliveries.find((d) => d.date === today());
      setTodayStatus(todayEntry?.status ?? null);

      // Month stats — delivered only
      const delivered = deliveries.filter((d) => d.status === DELIVERY_STATUS.DELIVERED);
      const litres    = delivered.reduce((s, d) => s + (d.quantity ?? 0), 0);
      const bill      = bills.find((b) => b.month === month);
      setMonthStats({ days: delivered.length, litres, amount: bill?.amount ?? 0 });
      setLatestBill(bills[0] ?? null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [customerId]);

  useEffect(() => { load(); }, [load]);

  const todayIcon  = todayStatus === DELIVERY_STATUS.DELIVERED ? 'checkmark-circle' : todayStatus === DELIVERY_STATUS.MISSED ? 'close-circle' : 'time';
  const todayColor = todayStatus === DELIVERY_STATUS.DELIVERED ? '#27AE60' : todayStatus === DELIVERY_STATUS.MISSED ? COLORS.error : '#F39C12';
  const todayLabel = todayStatus === DELIVERY_STATUS.DELIVERED ? 'Delivered ✅' : todayStatus === DELIVERY_STATUS.MISSED ? 'Absent ❌' : 'Pending ⏳';

  if (loading) return <View style={s.centered}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[COLORS.primary]} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Greeting */}
      <View style={s.greetingCard}>
        <Text style={s.greetingText}>{greeting()},</Text>
        <Text style={s.nameText}>{name} 🥛</Text>
        <Text style={s.dateText}>
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
        </Text>
      </View>

      {/* Today delivery status */}
      <Text style={s.sectionTitle}>Today's Delivery</Text>
      <View style={[s.statusCard, { borderLeftColor: todayColor }]}>
        <Ionicons name={todayIcon} size={36} color={todayColor} />
        <View style={{ flex: 1, marginLeft: 16 }}>
          <Text style={[s.statusLabel, { color: todayColor }]}>{todayLabel}</Text>
          <Text style={s.statusSub}>
            {todayStatus === DELIVERY_STATUS.DELIVERED
              ? 'Your milk was delivered today'
              : todayStatus === DELIVERY_STATUS.MISSED
              ? 'No milk today (marked absent)'
              : 'Entry not yet recorded'}
          </Text>
        </View>
      </View>

      {/* Month stats */}
      <Text style={s.sectionTitle}>This Month</Text>
      <View style={s.statsRow}>
        <View style={s.statBox}>
          <Text style={s.statVal}>{monthStats.days}</Text>
          <Text style={s.statLbl}>Days</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statBox}>
          <Text style={s.statVal}>{monthStats.litres % 1 === 0 ? monthStats.litres : monthStats.litres.toFixed(1)}L</Text>
          <Text style={s.statLbl}>Litres</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statBox}>
          <Text style={[s.statVal, { color: COLORS.primary }]}>₹{monthStats.amount}</Text>
          <Text style={s.statLbl}>Billed</Text>
        </View>
      </View>

      {/* Latest bill */}
      {latestBill ? (
        <>
          <Text style={s.sectionTitle}>Latest Bill</Text>
          <View style={s.billCard}>
            <View style={{ flex: 1 }}>
              <Text style={s.billMonth}>{latestBill.month}</Text>
              <Text style={s.billDetail}>{latestBill.totalDays} days · {latestBill.totalQuantity}L · ₹{latestBill.ratePerLitre}/L</Text>
            </View>
            <View>
              <Text style={s.billAmount}>₹{latestBill.amount}</Text>
              <View style={[s.billBadge, { backgroundColor: latestBill.paidStatus === 'paid' ? '#E8F8EE' : '#FDEDEC' }]}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: latestBill.paidStatus === 'paid' ? '#27AE60' : COLORS.error }}>
                  {latestBill.paidStatus === 'paid' ? 'Paid' : 'Unpaid'}
                </Text>
              </View>
            </View>
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  greetingCard: { margin: 16, backgroundColor: COLORS.primary, borderRadius: 16, padding: 20 },
  greetingText: { fontSize: 14, color: 'rgba(255,255,255,0.8)' },
  nameText:     { fontSize: 22, fontWeight: '800', color: COLORS.white, marginTop: 2 },
  dateText:     { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginLeft: 16, marginTop: 10, marginBottom: 8 },
  statusCard: {
    marginHorizontal: 16, backgroundColor: COLORS.white, borderRadius: 14, padding: 20,
    flexDirection: 'row', alignItems: 'center', borderLeftWidth: 4,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4,
  },
  statusLabel: { fontSize: 17, fontWeight: '700' },
  statusSub:   { fontSize: 13, color: COLORS.textLight, marginTop: 4 },
  statsRow: {
    marginHorizontal: 16, backgroundColor: COLORS.white, borderRadius: 14, flexDirection: 'row',
    paddingVertical: 20, elevation: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4,
  },
  statBox: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: 24, fontWeight: '800', color: COLORS.text },
  statLbl: { fontSize: 12, color: COLORS.textLight, marginTop: 4 },
  statDivider: { width: 1, backgroundColor: '#EEE' },
  billCard: {
    marginHorizontal: 16, backgroundColor: COLORS.white, borderRadius: 14, padding: 18,
    flexDirection: 'row', alignItems: 'center', elevation: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4,
  },
  billMonth:  { fontSize: 16, fontWeight: '700', color: COLORS.text },
  billDetail: { fontSize: 13, color: COLORS.textLight, marginTop: 4 },
  billAmount: { fontSize: 20, fontWeight: '800', color: COLORS.text, textAlign: 'right' },
  billBadge:  { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, marginTop: 6, alignSelf: 'flex-end' },
});
