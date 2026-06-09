import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import {
  getCustomersByProvider,
  createCustomerDirectly,
  approveJoinRequest,
  rejectJoinRequest,
  getPendingJoinRequests,
  CustomerServiceError,
} from '../../services/firebase/customer';
import { FIELDS, SUBSCRIPTION_STATUS } from '../../constants/firebase';
import { COLORS } from '../../constants';

// ─── helpers ────────────────────────────────────────────────────────────────

/**
 * Returns badge colour for a subscription status value.
 * @param {string} status
 */
function statusColor(status) {
  switch (status) {
    case SUBSCRIPTION_STATUS.ACTIVE:   return { bg: '#E8F8EE', text: '#27AE60' };
    case SUBSCRIPTION_STATUS.PAUSED:   return { bg: '#FFF3E0', text: '#F39C12' };
    case SUBSCRIPTION_STATUS.CANCELLED:return { bg: '#FDEDEC', text: '#E74C3C' };
    default:                           return { bg: '#F0F0F0', text: '#888888' };
  }
}

function statusLabel(status) {
  if (status === SUBSCRIPTION_STATUS.ACTIVE)    return 'Active';
  if (status === SUBSCRIPTION_STATUS.PAUSED)    return 'Paused';
  if (status === SUBSCRIPTION_STATUS.CANCELLED) return 'Cancelled';
  return status ?? 'Unknown';
}

const EMPTY_FORM = {
  name: '',
  phoneNumber: '',
  address: '',
  dailyQuantity: '1',
  ratePerLitre: '',
  startDate: new Date().toISOString().split('T')[0],
};

// ─── sub-components ─────────────────────────────────────────────────────────

/**
 * Single customer card in the list.
 */
function CustomerCard({ item }) {
  const name         = item.data[FIELDS.NAME]              ?? '—';
  const phone        = item.data[FIELDS.PHONE_NUMBER]      ?? '—';
  const qty          = item.data[FIELDS.DAILY_QUANTITY]    ?? 1;
  const rate         = item.data[FIELDS.RATE_PER_LITRE]
                    ?? item.data[FIELDS.PRICE_PER_LITER]   ?? '—';
  const subStatus    = item.data[FIELDS.SUBSCRIPTION_STATUS] ?? '';
  const address      = item.data[FIELDS.ADDRESS]           ?? '';
  const { bg, text } = statusColor(subStatus);

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{String(name).charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.customerName}>{name}</Text>
          <Text style={styles.customerPhone}>{phone}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: bg }]}>
          <Text style={[styles.statusText, { color: text }]}>{statusLabel(subStatus)}</Text>
        </View>
      </View>

      {address ? <Text style={styles.address}>{address}</Text> : null}

      <View style={styles.cardFooter}>
        <View style={styles.metaChip}>
          <Ionicons name="water-outline" size={13} color={COLORS.primary} />
          <Text style={styles.metaText}>{qty} L/day</Text>
        </View>
        <View style={styles.metaChip}>
          <Ionicons name="pricetag-outline" size={13} color={COLORS.primary} />
          <Text style={styles.metaText}>₹{rate}/L</Text>
        </View>
        <View style={styles.metaChip}>
          <Ionicons name="calculator-outline" size={13} color={COLORS.secondary} />
          <Text style={[styles.metaText, { color: COLORS.secondary }]}>
            ₹{Number(qty) * Number(rate)}/day
          </Text>
        </View>
      </View>
    </View>
  );
}

/**
 * Single pending join request card.
 */
function RequestCard({ item, onApprove, onReject, loading }) {
  const name  = item.data[FIELDS.NAME]         || '(no name)';
  const phone = item.data[FIELDS.PHONE_NUMBER] ?? '—';

  return (
    <View style={styles.requestCard}>
      <View style={{ flex: 1 }}>
        <Text style={styles.customerName}>{name}</Text>
        <Text style={styles.customerPhone}>{phone}</Text>
      </View>
      <TouchableOpacity
        style={[styles.actionBtn, { backgroundColor: '#E8F8EE' }]}
        onPress={() => onApprove(item.id)}
        disabled={loading}
      >
        <Ionicons name="checkmark" size={18} color="#27AE60" />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.actionBtn, { backgroundColor: '#FDEDEC', marginLeft: 8 }]}
        onPress={() => onReject(item.id)}
        disabled={loading}
      >
        <Ionicons name="close" size={18} color="#E74C3C" />
      </TouchableOpacity>
    </View>
  );
}

// ─── Add Customer Modal ──────────────────────────────────────────────────────

function AddCustomerModal({ visible, onClose, onSubmit, defaultRate }) {
  const [form, setForm]     = useState({ ...EMPTY_FORM, ratePerLitre: String(defaultRate ?? 60) });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (visible) {
      setForm({ ...EMPTY_FORM, ratePerLitre: String(defaultRate ?? 60) });
      setErrors({});
    }
  }, [visible, defaultRate]);

  const set = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim())        e.name        = 'Name is required.';
    if (!/^\d{10}$/.test(form.phoneNumber.trim())) e.phoneNumber = 'Enter a valid 10-digit number.';
    if (isNaN(Number(form.dailyQuantity)) || Number(form.dailyQuantity) <= 0)
                                  e.dailyQuantity = 'Enter a valid quantity.';
    if (isNaN(Number(form.ratePerLitre)) || Number(form.ratePerLitre) <= 0)
                                  e.ratePerLitre  = 'Enter a valid rate.';
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }

    setSaving(true);
    try {
      await onSubmit({
        name:          form.name.trim(),
        phoneNumber:   form.phoneNumber.trim(),
        address:       form.address.trim(),
        dailyQuantity: Number(form.dailyQuantity),
        ratePerLitre:  Number(form.ratePerLitre),
        startDate:     form.startDate.trim() || new Date().toISOString().split('T')[0],
      });
      onClose();
    } catch (err) {
      Alert.alert('Error', err.message ?? 'Failed to add customer.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Add Customer</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={24} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.modalBody}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Name */}
          <Text style={styles.label}>Name *</Text>
          <TextInput
            style={[styles.input, errors.name && styles.inputError]}
            placeholder="e.g. Ramesh Kumar"
            placeholderTextColor="#AAA"
            value={form.name}
            onChangeText={(v) => set('name', v)}
          />
          {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}

          {/* Phone */}
          <Text style={styles.label}>Phone Number *</Text>
          <TextInput
            style={[styles.input, errors.phoneNumber && styles.inputError]}
            placeholder="9876543210"
            placeholderTextColor="#AAA"
            keyboardType="phone-pad"
            maxLength={10}
            value={form.phoneNumber}
            onChangeText={(v) => set('phoneNumber', v.replace(/\D/g, '').slice(0, 10))}
          />
          {errors.phoneNumber ? <Text style={styles.errorText}>{errors.phoneNumber}</Text> : null}

          {/* Address */}
          <Text style={styles.label}>Address (optional)</Text>
          <TextInput
            style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]}
            placeholder="House no, street, area"
            placeholderTextColor="#AAA"
            value={form.address}
            onChangeText={(v) => set('address', v)}
            multiline
          />

          {/* Quantity stepper */}
          <Text style={styles.label}>Daily Quantity (litres) *</Text>
          <View style={styles.stepperRow}>
            <TouchableOpacity
              style={styles.stepBtn}
              onPress={() => set('dailyQuantity', String(Math.max(0.5, Number(form.dailyQuantity) - 0.5)))}
            >
              <Ionicons name="remove" size={20} color={COLORS.primary} />
            </TouchableOpacity>
            <TextInput
              style={[styles.stepInput, errors.dailyQuantity && styles.inputError]}
              value={form.dailyQuantity}
              onChangeText={(v) => set('dailyQuantity', v.replace(/[^0-9.]/g, ''))}
              keyboardType="decimal-pad"
            />
            <TouchableOpacity
              style={styles.stepBtn}
              onPress={() => set('dailyQuantity', String(Number(form.dailyQuantity) + 0.5))}
            >
              <Ionicons name="add" size={20} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
          {errors.dailyQuantity ? <Text style={styles.errorText}>{errors.dailyQuantity}</Text> : null}

          {/* Rate */}
          <Text style={styles.label}>Rate per Litre (₹) *</Text>
          <TextInput
            style={[styles.input, errors.ratePerLitre && styles.inputError]}
            placeholder="60"
            placeholderTextColor="#AAA"
            keyboardType="decimal-pad"
            value={form.ratePerLitre}
            onChangeText={(v) => set('ratePerLitre', v.replace(/[^0-9.]/g, ''))}
          />
          {errors.ratePerLitre ? <Text style={styles.errorText}>{errors.ratePerLitre}</Text> : null}

          {/* Start date */}
          <Text style={styles.label}>Start Date (YYYY-MM-DD)</Text>
          <TextInput
            style={styles.input}
            placeholder="2025-06-01"
            placeholderTextColor="#AAA"
            value={form.startDate}
            onChangeText={(v) => set('startDate', v)}
          />

          {/* Preview */}
          {form.dailyQuantity && form.ratePerLitre ? (
            <View style={styles.previewBox}>
              <Text style={styles.previewText}>
                Monthly estimate:{' '}
                <Text style={{ fontWeight: '700', color: COLORS.primary }}>
                  ₹{(Number(form.dailyQuantity) * Number(form.ratePerLitre) * 30).toFixed(0)}
                </Text>
                {' '}(30 days)
              </Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.submitBtn, saving && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.submitBtnText}>Add Customer</Text>
            }
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function AdminCustomersScreen() {
  const { user, providerData } = useAuth();
  const providerId  = user?.uid ?? '';
  const defaultRate = providerData?.[FIELDS.PRICE_PER_LITER] ?? 60;

  const [tab, setTab]             = useState('customers'); // 'customers' | 'requests'
  const [customers, setCustomers] = useState([]);
  const [requests, setRequests]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [modalVisible, setModalVisible]   = useState(false);

  const loadData = useCallback(async () => {
    if (!providerId) return;
    try {
      const [cList, rList] = await Promise.all([
        getCustomersByProvider(providerId),
        getPendingJoinRequests(providerId),
      ]);
      setCustomers(cList);
      setRequests(rList);
    } catch (err) {
      console.error('Failed to load customers:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [providerId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleRefresh = () => { setRefreshing(true); loadData(); };

  const handleAddCustomer = async (formData) => {
    await createCustomerDirectly(providerId, formData);
    await loadData();
  };

  const handleApprove = async (requestId) => {
    setActionLoading(true);
    try {
      await approveJoinRequest(requestId);
      await loadData();
      Alert.alert('Approved', 'Customer has been approved and added.');
    } catch (err) {
      Alert.alert('Error', err instanceof CustomerServiceError ? err.message : 'Failed to approve.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = (requestId) => {
    Alert.alert('Reject Request', 'Are you sure you want to reject this request?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject', style: 'destructive',
        onPress: async () => {
          setActionLoading(true);
          try {
            await rejectJoinRequest(requestId);
            await loadData();
          } catch (err) {
            Alert.alert('Error', err instanceof CustomerServiceError ? err.message : 'Failed to reject.');
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>

      {/* ── Tab bar ── */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'customers' && styles.tabBtnActive]}
          onPress={() => setTab('customers')}
        >
          <Text style={[styles.tabBtnText, tab === 'customers' && styles.tabBtnTextActive]}>
            Customers ({customers.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'requests' && styles.tabBtnActive]}
          onPress={() => setTab('requests')}
        >
          <Text style={[styles.tabBtnText, tab === 'requests' && styles.tabBtnTextActive]}>
            Requests {requests.length > 0 ? `(${requests.length})` : ''}
          </Text>
          {requests.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{requests.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Customers list ── */}
      {tab === 'customers' && (
        <FlatList
          data={customers}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <CustomerCard item={item} />}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[COLORS.primary]} />}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="people-outline" size={48} color="#CCC" />
              <Text style={styles.emptyTitle}>No customers yet</Text>
              <Text style={styles.emptySubtitle}>Tap + to add your first customer</Text>
            </View>
          }
        />
      )}

      {/* ── Requests list ── */}
      {tab === 'requests' && (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <RequestCard
              item={item}
              onApprove={handleApprove}
              onReject={handleReject}
              loading={actionLoading}
            />
          )}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[COLORS.primary]} />}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="checkmark-done-outline" size={48} color="#CCC" />
              <Text style={styles.emptyTitle}>No pending requests</Text>
              <Text style={styles.emptySubtitle}>All join requests are handled</Text>
            </View>
          }
        />
      )}

      {/* ── FAB ── */}
      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Ionicons name="add" size={28} color={COLORS.white} />
      </TouchableOpacity>

      {/* ── Add Customer Modal ── */}
      <AddCustomerModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSubmit={handleAddCustomer}
        defaultRate={defaultRate}
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 6,
  },
  tabBtnActive: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
  },
  tabBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textLight,
  },
  tabBtnTextActive: {
    color: COLORS.primary,
  },
  badge: {
    backgroundColor: COLORS.error,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '700',
  },

  // Customer card
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E8F2FC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  customerPhone: {
    fontSize: 13,
    color: COLORS.textLight,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  address: {
    fontSize: 13,
    color: COLORS.textLight,
    marginTop: 10,
    marginLeft: 56,
  },
  cardFooter: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },

  // Request card
  requestCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Empty state
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textLight,
    marginTop: 6,
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },

  // Modal
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    backgroundColor: COLORS.white,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  modalBody: {
    padding: 20,
    paddingBottom: 40,
    backgroundColor: COLORS.white,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 6,
  },
  input: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.text,
    marginBottom: 16,
  },
  inputError: {
    borderColor: COLORS.error,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 12,
    marginTop: -12,
    marginBottom: 12,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#E8F2FC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepInput: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.text,
    textAlign: 'center',
    fontWeight: '700',
  },
  previewBox: {
    backgroundColor: '#E8F2FC',
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
  },
  previewText: {
    fontSize: 14,
    color: COLORS.text,
    textAlign: 'center',
  },
  submitBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitBtnText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
});
