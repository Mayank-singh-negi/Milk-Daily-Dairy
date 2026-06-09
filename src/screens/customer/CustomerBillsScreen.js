import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Modal, ScrollView,
  ActivityIndicator, StyleSheet, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { getBillsByCustomer } from '../../services/firebase/bills';
import { getCustomerDeliveries } from '../../services/firebase/deliveries';
import { FIELDS, PAID_STATUS, DELIVERY_STATUS } from '../../constants/firebase';
import { COLORS } from '../../constants';

function monthLabel(m) {
  const [y, mo] = m.split('-');
  return new Date(Number(y), Number(mo) - 1, 1)
    .toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function paidStyle(status) {
  if (status === PAID_STATUS.PAID)    return { bg: '#E8F8EE', color: '#27AE60', label: 'Paid' };
  if (status === PAID_STATUS.PARTIAL) return { bg: '#FFF3E0', color: '#F39C12', label: 'Partial' };
  return { bg: '#FDEDEC', color: '#E74C3C', label: 'Unpaid' };
}

function BillDetailModal({ bill, visible, onClose }) {
  const { customerData } = useAuth();
  const customerId = customerData?.id ?? customerData?.uid ?? '';
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading]       = useState(false);

  useEffect(() => {
    if (!visible || !bill) return;
    setLoading(true);
    getCustomerDeliveries(customerId, bill.month)
      .then(setDeliveries)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [visible, bill, customerId]);

  if (!bill) return null;
  const ps = paidStyle(bill.paidStatus);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={d.header}>
        <Text style={d.title}>{monthLabel(bill.month)}</Text>
        <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={COLORS.text} /></TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={d.body} showsVerticalScrollIndicator={false}>
        {/* Summary */}
        <View style={d.summaryCard}>
          <View style={d.summaryRow}>
            <Text style={d.summaryLabel}>Total Amount</Text>
            <Text style={d.summaryAmount}>₹{bill.amount}</Text>
          </View>
          <View style={d.summaryRow}>
            <Text style={d.summaryLabel}>Days Delivered</Text>
            <Text style={d.summaryVal}>{bill.totalDays}</Text>
          </View>
          <View style={d.summaryRow}>
            <Text style={d.summaryLabel}>Total Quantity</Text>
            <Text style={d.summaryVal}>{bill.totalQuantity} L</Text>
          </View>
          <View style={d.summaryRow}>
            <Text style={d.summaryLabel}>Rate</Text>
            <Text style={d.summaryVal}>₹{bill.ratePerLitre}/L</Text>
          </View>
          <View style={[d.paidBadge, { backgroundColor: ps.bg, alignSelf: 'flex-start', marginTop: 8 }]}>
            <Text style={[d.paidBadgeText, { color: ps.color }]}>{ps.label}</Text>
          </View>
        </View>

        {/* Day-by-day */}
        <Text style={d.sectionTitle}>Day-by-Day Breakdown</Text>
        {loading
          ? <ActivityIndicator color={COLORS.primary} style={{ marginTop: 20 }} />
          : deliveries.length === 0
          ? <Text style={d.noData}>No delivery data recorded for this month.</Text>
          : deliveries.map((entry) => {
              const isDelivered = entry.status === DELIVERY_STATUS.DELIVERED;
              return (
                <View key={entry.id} style={d.dayRow}>
                  <Text style={d.dayDate}>{entry.date}</Text>
                  <View style={[d.dayBadge, { backgroundColor: isDelivered ? '#E8F8EE' : entry.status === DELIVERY_STATUS.MISSED ? '#FDEDEC' : '#FFF3E0' }]}>
                    <Text style={[d.dayStatus, { color: isDelivered ? '#27AE60' : entry.status === DELIVERY_STATUS.MISSED ? COLORS.error : '#F39C12' }]}>
                      {isDelivered ? 'Delivered' : entry.status === DELIVERY_STATUS.MISSED ? 'Absent' : 'Holiday'}
                    </Text>
                  </View>
                  {isDelivered && <Text style={d.dayQty}>{entry.quantity} L</Text>}
                </View>
              );
            })
        }
      </ScrollView>
    </Modal>
  );
}

export default function CustomerBillsScreen() {
  const { customerData } = useAuth();
  const customerId = customerData?.id ?? customerData?.uid ?? '';

  const [bills, setBills]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    if (!customerId) return;
    try {
      const list = await getBillsByCustomer(customerId);
      setBills(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [customerId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <View style={s.centered}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

  return (
    <View style={s.container}>
      <FlatList
        data={bills}
        keyExtractor={(b) => b.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[COLORS.primary]} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        renderItem={({ item }) => {
          const ps = paidStyle(item.paidStatus);
          return (
            <TouchableOpacity style={s.card} onPress={() => setSelected(item)} activeOpacity={0.8}>
              <View style={s.cardLeft}>
                <Text style={s.billMonth}>{monthLabel(item.month)}</Text>
                <Text style={s.billMeta}>{item.totalDays} days · {item.totalQuantity}L · ₹{item.ratePerLitre}/L</Text>
              </View>
              <View style={s.cardRight}>
                <Text style={s.billAmount}>₹{item.amount}</Text>
                <View style={[s.badge, { backgroundColor: ps.bg }]}>
                  <Text style={[s.badgeText, { color: ps.color }]}>{ps.label}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#CCC" style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={s.emptyBox}>
            <Ionicons name="receipt-outline" size={48} color="#CCC" />
            <Text style={s.emptyTitle}>No bills yet</Text>
            <Text style={s.emptySubtitle}>Your monthly bills will appear here</Text>
          </View>
        }
      />
      <BillDetailModal bill={selected} visible={!!selected} onClose={() => setSelected(null)} />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: {
    backgroundColor: COLORS.white, borderRadius: 14, padding: 16, marginBottom: 10,
    flexDirection: 'row', alignItems: 'center', elevation: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4,
  },
  cardLeft:   { flex: 1 },
  cardRight:  { alignItems: 'flex-end', marginRight: 8 },
  billMonth:  { fontSize: 16, fontWeight: '700', color: COLORS.text },
  billMeta:   { fontSize: 13, color: COLORS.textLight, marginTop: 4 },
  billAmount: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, marginTop: 6 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  emptyBox: { alignItems: 'center', paddingTop: 80 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: COLORS.text, marginTop: 16 },
  emptySubtitle: { fontSize: 13, color: COLORS.textLight, marginTop: 6 },
});

const d = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: '#F0F0F0', backgroundColor: COLORS.white },
  title:  { fontSize: 20, fontWeight: '700', color: COLORS.text },
  body:   { padding: 20, paddingBottom: 40, backgroundColor: COLORS.white },
  summaryCard: { backgroundColor: COLORS.background, borderRadius: 14, padding: 16, marginBottom: 20 },
  summaryRow:  { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  summaryLabel: { fontSize: 14, color: COLORS.textLight },
  summaryAmount: { fontSize: 22, fontWeight: '800', color: COLORS.primary },
  summaryVal:    { fontSize: 15, fontWeight: '700', color: COLORS.text },
  paidBadge:     { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  paidBadgeText: { fontSize: 13, fontWeight: '700' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  noData: { fontSize: 14, color: COLORS.textLight, textAlign: 'center', marginTop: 20 },
  dayRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F5F5F5', gap: 10 },
  dayDate: { flex: 1, fontSize: 14, color: COLORS.text, fontWeight: '500' },
  dayBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  dayStatus: { fontSize: 12, fontWeight: '700' },
  dayQty: { fontSize: 13, color: COLORS.primary, fontWeight: '700' },
});
