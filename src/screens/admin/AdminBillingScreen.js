import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, ActivityIndicator,
  Alert, StyleSheet, Linking, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { getCustomersByProvider } from '../../services/firebase/customer';
import { generateMonthlyBills, getBillsByProvider, markBillPaid } from '../../services/firebase/bills';
import { FIELDS, PAID_STATUS } from '../../constants/firebase';
import { COLORS } from '../../constants';

// ─── helpers ─────────────────────────────────────────────────────────────────

function monthLabel(m) {
  const [y, mo] = m.split('-');
  return new Date(Number(y), Number(mo) - 1, 1)
    .toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function shiftMonth(m, delta) {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function paidStyle(status) {
  switch (status) {
    case PAID_STATUS.PAID:    return { bg: '#E8F8EE', color: '#27AE60', label: 'Paid' };
    case PAID_STATUS.PARTIAL: return { bg: '#FFF3E0', color: '#F39C12', label: 'Partial' };
    default:                  return { bg: '#FDEDEC', color: '#E74C3C', label: 'Unpaid' };
  }
}

function buildWhatsAppMessage(bill, providerData) {
  const business = providerData?.[FIELDS.BUSINESS_NAME] ?? 'Your Dairy';
  const phone    = providerData?.[FIELDS.PHONE_NUMBER]  ?? '';
  return encodeURIComponent(
    `🥛 *Milk Bill - ${monthLabel(bill.month)}*\n` +
    `Customer: ${bill.customerName ?? '—'}\n` +
    `Days Delivered: ${bill.totalDays ?? 0}\n` +
    `Total Quantity: ${bill.totalQuantity ?? 0} litres\n` +
    `Rate: ₹${bill.ratePerLitre ?? 0}/litre\n` +
    `*Total Amount: ₹${bill.amount ?? 0}*\n` +
    `Status: ${paidStyle(bill.paidStatus).label}\n\n` +
    `— ${business}${phone ? `\nContact: ${phone}` : ''}`
  );
}

// ─── Bill Card ────────────────────────────────────────────────────────────────

function BillCard({ bill, customerPhone, onMarkPaid, onWhatsApp }) {
  const ps = paidStyle(bill[FIELDS.PAID_STATUS] ?? bill.paidStatus);

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.billName}>{bill.customerName ?? '—'}</Text>
          <Text style={styles.billMeta}>
            {bill.totalDays ?? 0} days · {bill.totalQuantity ?? 0} L · ₹{bill.ratePerLitre ?? 0}/L
          </Text>
        </View>
        <View>
          <Text style={styles.billAmount}>₹{bill.amount ?? 0}</Text>
          <View style={[styles.paidBadge, { backgroundColor: ps.bg }]}>
            <Text style={[styles.paidBadgeText, { color: ps.color }]}>{ps.label}</Text>
          </View>
        </View>
      </View>

      <View style={styles.cardActions}>
        {bill.paidStatus !== PAID_STATUS.PAID && (
          <TouchableOpacity style={styles.paidBtn} onPress={() => onMarkPaid(bill.id)}>
            <Ionicons name="checkmark-circle-outline" size={16} color="#27AE60" />
            <Text style={[styles.actionBtnText, { color: '#27AE60' }]}>Mark Paid</Text>
          </TouchableOpacity>
        )}
        {customerPhone ? (
          <TouchableOpacity style={styles.waBtn} onPress={() => onWhatsApp(bill, customerPhone)}>
            <Ionicons name="logo-whatsapp" size={16} color="#25D366" />
            <Text style={[styles.actionBtnText, { color: '#25D366' }]}>WhatsApp</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AdminBillingScreen() {
  const { user, providerData } = useAuth();
  const providerId = user?.uid ?? '';

  const [month, setMonth]         = useState(currentMonth());
  const [bills, setBills]         = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [generating, setGenerating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // phone lookup map
  const phoneMap = Object.fromEntries(
    customers.map((c) => [c.id, c.data[FIELDS.PHONE_NUMBER] ?? ''])
  );

  const loadData = useCallback(async () => {
    if (!providerId) return;
    try {
      const [billList, custList] = await Promise.all([
        getBillsByProvider(providerId, month),
        getCustomersByProvider(providerId),
      ]);
      setBills(billList);
      setCustomers(custList);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [providerId, month]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleGenerate = async () => {
    Alert.alert(
      'Generate Bills',
      `Generate bills for ${monthLabel(month)} for all customers?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Generate', onPress: async () => {
            setGenerating(true);
            try {
              await generateMonthlyBills(providerId, month, customers);
              await loadData();
              Alert.alert('Done', `Bills generated for ${monthLabel(month)}.`);
            } catch (err) {
              Alert.alert('Error', err.message ?? 'Failed to generate bills.');
            } finally {
              setGenerating(false);
            }
          },
        },
      ]
    );
  };

  const handleMarkPaid = async (billId) => {
    try {
      await markBillPaid(billId, PAID_STATUS.PAID);
      setBills((prev) => prev.map((b) => b.id === billId ? { ...b, paidStatus: PAID_STATUS.PAID } : b));
    } catch (err) {
      Alert.alert('Error', err.message ?? 'Failed to update.');
    }
  };

  const handleWhatsApp = async (bill, phone) => {
    const msg  = buildWhatsAppMessage(bill, providerData);
    const waUrl = `whatsapp://send?phone=91${phone}&text=${msg}`;
    const webUrl = `https://wa.me/91${phone}?text=${msg}`;
    const canOpen = await Linking.canOpenURL(waUrl);
    Linking.openURL(canOpen ? waUrl : webUrl).catch(() =>
      Alert.alert('Error', 'Could not open WhatsApp.')
    );
  };

  // Summary totals
  const totalRevenue = bills.filter((b) => b.paidStatus === PAID_STATUS.PAID)
    .reduce((s, b) => s + (b.amount ?? 0), 0);
  const totalPending = bills.filter((b) => b.paidStatus !== PAID_STATUS.PAID)
    .reduce((s, b) => s + (b.amount ?? 0), 0);

  if (loading) return (
    <View style={styles.centered}><ActivityIndicator size="large" color={COLORS.primary} /></View>
  );

  return (
    <View style={styles.container}>
      {/* Month selector */}
      <View style={styles.monthBar}>
        <TouchableOpacity onPress={() => setMonth((m) => shiftMonth(m, -1))}>
          <Ionicons name="chevron-back" size={22} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{monthLabel(month)}</Text>
        <TouchableOpacity
          onPress={() => { if (month < currentMonth()) setMonth((m) => shiftMonth(m, 1)); }}
          style={month >= currentMonth() ? { opacity: 0.3 } : {}}
          disabled={month >= currentMonth()}
        >
          <Ionicons name="chevron-forward" size={22} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Summary row */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryBox}>
          <Text style={[styles.summaryAmt, { color: '#27AE60' }]}>₹{totalRevenue}</Text>
          <Text style={styles.summaryLbl}>Collected</Text>
        </View>
        <View style={styles.summaryBox}>
          <Text style={[styles.summaryAmt, { color: COLORS.error }]}>₹{totalPending}</Text>
          <Text style={styles.summaryLbl}>Pending</Text>
        </View>
        <TouchableOpacity
          style={[styles.generateBtn, generating && { opacity: 0.6 }]}
          onPress={handleGenerate}
          disabled={generating}
        >
          {generating
            ? <ActivityIndicator size="small" color={COLORS.white} />
            : <>
                <Ionicons name="refresh" size={16} color={COLORS.white} />
                <Text style={styles.generateBtnText}>Generate</Text>
              </>
          }
        </TouchableOpacity>
      </View>

      {/* Bill list */}
      <FlatList
        data={bills}
        keyExtractor={(b) => b.id}
        renderItem={({ item }) => (
          <BillCard
            bill={item}
            customerPhone={phoneMap[item.customerId] ?? ''}
            onMarkPaid={handleMarkPaid}
            onWhatsApp={handleWhatsApp}
          />
        )}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} colors={[COLORS.primary]} />}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons name="receipt-outline" size={48} color="#CCC" />
            <Text style={styles.emptyTitle}>No bills for {monthLabel(month)}</Text>
            <Text style={styles.emptySubtitle}>Tap "Generate" to create bills from delivery data</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  monthBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.white, paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  monthLabel: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  summaryRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0', gap: 12,
  },
  summaryBox: { flex: 1, alignItems: 'center' },
  summaryAmt: { fontSize: 20, fontWeight: '800' },
  summaryLbl: { fontSize: 11, color: COLORS.textLight, marginTop: 2 },
  generateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.primary, paddingHorizontal: 14,
    paddingVertical: 10, borderRadius: 10,
  },
  generateBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 13 },
  card: {
    backgroundColor: COLORS.white, borderRadius: 12, padding: 16,
    marginBottom: 10, elevation: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  billName: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  billMeta: { fontSize: 13, color: COLORS.textLight, marginTop: 4 },
  billAmount: { fontSize: 20, fontWeight: '800', color: COLORS.text, textAlign: 'right' },
  paidBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, marginTop: 4, alignSelf: 'flex-end' },
  paidBadgeText: { fontSize: 11, fontWeight: '700' },
  cardActions: { flexDirection: 'row', gap: 10, marginTop: 12, borderTopWidth: 1, borderTopColor: '#F5F5F5', paddingTop: 12 },
  paidBtn:  { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#E8F8EE', borderRadius: 20 },
  waBtn:    { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#E8FBF0', borderRadius: 20 },
  actionBtnText: { fontSize: 13, fontWeight: '600' },
  emptyBox: { alignItems: 'center', paddingTop: 80 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: COLORS.text, marginTop: 16 },
  emptySubtitle: { fontSize: 13, color: COLORS.textLight, marginTop: 6, textAlign: 'center', paddingHorizontal: 32 },
});
