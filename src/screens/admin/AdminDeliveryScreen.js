import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { getCustomersByProvider } from '../../services/firebase/customer';
import { getDeliveriesForDate, saveDeliveries } from '../../services/firebase/deliveries';
import { FIELDS, DELIVERY_STATUS, SUBSCRIPTION_STATUS } from '../../constants/firebase';
import { COLORS } from '../../constants';

// ─── Date helpers ─────────────────────────────────────────────────────────────

/** Returns today's date as "YYYY-MM-DD" */
function today() {
  return new Date().toISOString().split('T')[0];
}

/** Adds `delta` days to a "YYYY-MM-DD" string */
function shiftDate(dateStr, delta) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + delta);
  return d.toISOString().split('T')[0];
}

/** Formats "YYYY-MM-DD" → "Mon, 9 Jun 2025" */
function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// ─── Status button config ─────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  {
    value: DELIVERY_STATUS.DELIVERED,
    label: 'Delivered',
    icon: 'checkmark-circle',
    activeColor: '#27AE60',
    activeBg: '#E8F8EE',
    inactiveColor: '#CCC',
  },
  {
    value: DELIVERY_STATUS.MISSED,
    label: 'Absent',
    icon: 'close-circle',
    activeColor: '#E74C3C',
    activeBg: '#FDEDEC',
    inactiveColor: '#CCC',
  },
  {
    value: DELIVERY_STATUS.SKIPPED,
    label: 'Holiday',
    icon: 'sunny',
    activeColor: '#F39C12',
    activeBg: '#FFF8E1',
    inactiveColor: '#CCC',
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

/**
 * Single customer row with status buttons + quantity override.
 */
function DeliveryRow({ customer, entry, onChange }) {
  const name     = customer.data[FIELDS.NAME]          ?? '—';
  const defaultQ = customer.data[FIELDS.DAILY_QUANTITY] ?? 1;

  const currentStatus = entry?.status   ?? DELIVERY_STATUS.DELIVERED;
  const currentQty    = entry?.quantity ?? defaultQ;

  return (
    <View style={styles.row}>
      {/* Avatar + name */}
      <View style={styles.rowLeft}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{String(name).charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.customerName} numberOfLines={1}>{name}</Text>
      </View>

      {/* Status buttons */}
      <View style={styles.statusButtons}>
        {STATUS_OPTIONS.map((opt) => {
          const active = currentStatus === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.statusBtn,
                { backgroundColor: active ? opt.activeBg : '#F5F5F5' },
              ]}
              onPress={() => onChange(customer.id, 'status', opt.value)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={opt.icon}
                size={16}
                color={active ? opt.activeColor : opt.inactiveColor}
              />
              <Text
                style={[
                  styles.statusBtnText,
                  { color: active ? opt.activeColor : '#AAA' },
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Quantity override — only editable when delivered */}
      <View style={styles.qtyContainer}>
        <TouchableOpacity
          style={styles.qtyBtn}
          onPress={() => onChange(customer.id, 'quantity', Math.max(0.5, Number(currentQty) - 0.5))}
          disabled={currentStatus !== DELIVERY_STATUS.DELIVERED}
        >
          <Ionicons name="remove" size={14} color={currentStatus === DELIVERY_STATUS.DELIVERED ? COLORS.primary : '#CCC'} />
        </TouchableOpacity>
        <TextInput
          style={[
            styles.qtyInput,
            currentStatus !== DELIVERY_STATUS.DELIVERED && { color: '#CCC' },
          ]}
          value={String(currentQty)}
          onChangeText={(v) => {
            const n = parseFloat(v);
            if (!isNaN(n) && n > 0) onChange(customer.id, 'quantity', n);
          }}
          keyboardType="decimal-pad"
          editable={currentStatus === DELIVERY_STATUS.DELIVERED}
          selectTextOnFocus
        />
        <TouchableOpacity
          style={styles.qtyBtn}
          onPress={() => onChange(customer.id, 'quantity', Number(currentQty) + 0.5)}
          disabled={currentStatus !== DELIVERY_STATUS.DELIVERED}
        >
          <Ionicons name="add" size={14} color={currentStatus === DELIVERY_STATUS.DELIVERED ? COLORS.primary : '#CCC'} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AdminDeliveryScreen() {
  const { user } = useAuth();
  const providerId = user?.uid ?? '';

  const [selectedDate, setSelectedDate] = useState(today());
  const [customers, setCustomers]       = useState([]);
  const [entries, setEntries]           = useState({}); // customerId → { status, quantity }
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [loadingEntries, setLoadingEntries]     = useState(false);
  const [saving, setSaving]             = useState(false);
  const [savedAt, setSavedAt]           = useState(null); // timestamp of last save

  const todayStr = today();

  // ── Load customers once ──────────────────────────────────────────────────
  useEffect(() => {
    if (!providerId) return;
    getCustomersByProvider(providerId)
      .then((list) => {
        // Only show active customers
        const active = list.filter(
          (c) => c.data[FIELDS.SUBSCRIPTION_STATUS] !== SUBSCRIPTION_STATUS.CANCELLED
        );
        setCustomers(active);
      })
      .catch((err) => console.error('Failed to load customers:', err))
      .finally(() => setLoadingCustomers(false));
  }, [providerId]);

  // ── Load delivery entries whenever date changes ──────────────────────────
  const loadEntries = useCallback(async (date) => {
    if (!providerId || !customers.length) return;

    setLoadingEntries(true);
    setSavedAt(null);

    try {
      const existing = await getDeliveriesForDate(providerId, date);

      // Build entries map — for customers without a record, default to Delivered
      const map = {};
      customers.forEach((c) => {
        if (existing[c.id]) {
          map[c.id] = {
            status:   existing[c.id].status,
            quantity: existing[c.id].quantity,
          };
        } else {
          map[c.id] = {
            status:   DELIVERY_STATUS.DELIVERED,
            quantity: c.data[FIELDS.DAILY_QUANTITY] ?? 1,
          };
        }
      });

      setEntries(map);
    } catch (err) {
      console.error('Failed to load delivery entries:', err);
    } finally {
      setLoadingEntries(false);
    }
  }, [providerId, customers]);

  useEffect(() => {
    if (customers.length) loadEntries(selectedDate);
  }, [selectedDate, customers, loadEntries]);

  // ── Change handler ───────────────────────────────────────────────────────
  const handleChange = useCallback((customerId, field, value) => {
    setEntries((prev) => ({
      ...prev,
      [customerId]: {
        ...prev[customerId],
        [field]: value,
        // Reset quantity to default when marked absent/holiday
        ...(field === 'status' && value !== DELIVERY_STATUS.DELIVERED
          ? { quantity: 0 }
          : {}),
        // Restore default quantity when switching back to delivered
        ...(field === 'status' && value === DELIVERY_STATUS.DELIVERED
          ? {
              quantity: customers.find((c) => c.id === customerId)
                ?.data[FIELDS.DAILY_QUANTITY] ?? 1,
            }
          : {}),
      },
    }));
    setSavedAt(null);
  }, [customers]);

  // ── Mark all as delivered ────────────────────────────────────────────────
  const handleMarkAllDelivered = () => {
    const map = {};
    customers.forEach((c) => {
      map[c.id] = {
        status:   DELIVERY_STATUS.DELIVERED,
        quantity: c.data[FIELDS.DAILY_QUANTITY] ?? 1,
      };
    });
    setEntries(map);
    setSavedAt(null);
  };

  // ── Save all ─────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!customers.length) return;
    setSaving(true);

    try {
      const deliveryArray = customers.map((c) => ({
        customerId: c.id,
        providerId,
        date:     selectedDate,
        quantity: entries[c.id]?.quantity ?? c.data[FIELDS.DAILY_QUANTITY] ?? 1,
        status:   entries[c.id]?.status   ?? DELIVERY_STATUS.DELIVERED,
      }));

      await saveDeliveries(deliveryArray);
      setSavedAt(new Date());
      Alert.alert('Saved', `Delivery entries for ${formatDate(selectedDate)} saved successfully.`);
    } catch (err) {
      Alert.alert('Error', err.message ?? 'Failed to save entries.');
    } finally {
      setSaving(false);
    }
  };

  // ── Summary stats ────────────────────────────────────────────────────────
  const summary = customers.reduce(
    (acc, c) => {
      const e = entries[c.id];
      if (!e) return acc;
      if (e.status === DELIVERY_STATUS.DELIVERED) {
        acc.delivered += 1;
        acc.totalLitres += Number(e.quantity ?? 0);
      } else if (e.status === DELIVERY_STATUS.MISSED) {
        acc.absent += 1;
      } else if (e.status === DELIVERY_STATUS.SKIPPED) {
        acc.holiday += 1;
      }
      return acc;
    },
    { delivered: 0, absent: 0, holiday: 0, totalLitres: 0 }
  );

  // ── Render ───────────────────────────────────────────────────────────────

  if (loadingCustomers) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>

      {/* ── Date selector ── */}
      <View style={styles.dateBar}>
        <TouchableOpacity
          style={styles.dateArrow}
          onPress={() => setSelectedDate((d) => shiftDate(d, -1))}
        >
          <Ionicons name="chevron-back" size={22} color={COLORS.primary} />
        </TouchableOpacity>

        <View style={styles.dateLabelBox}>
          <Text style={styles.dateLabel}>{formatDate(selectedDate)}</Text>
          {selectedDate === todayStr && (
            <View style={styles.todayPill}>
              <Text style={styles.todayPillText}>Today</Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.dateArrow,
            selectedDate >= todayStr && { opacity: 0.3 },
          ]}
          onPress={() => {
            if (selectedDate < todayStr) setSelectedDate((d) => shiftDate(d, 1));
          }}
          disabled={selectedDate >= todayStr}
        >
          <Ionicons name="chevron-forward" size={22} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* ── Mark all + saved indicator ── */}
      <View style={styles.actionsBar}>
        <TouchableOpacity style={styles.markAllBtn} onPress={handleMarkAllDelivered}>
          <Ionicons name="checkmark-done" size={16} color={COLORS.primary} />
          <Text style={styles.markAllText}>Mark All Delivered</Text>
        </TouchableOpacity>
        {savedAt && (
          <Text style={styles.savedText}>
            Saved {savedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        )}
      </View>

      {/* ── Customer list ── */}
      {loadingEntries ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : customers.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="people-outline" size={48} color="#CCC" />
          <Text style={styles.emptyTitle}>No customers yet</Text>
          <Text style={styles.emptySubtitle}>Add customers in the Customers tab first</Text>
        </View>
      ) : (
        <FlatList
          data={customers}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <DeliveryRow
              customer={item}
              entry={entries[item.id]}
              onChange={handleChange}
            />
          )}
          contentContainerStyle={{ padding: 12, paddingBottom: 180 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      )}

      {/* ── Summary bar ── */}
      {customers.length > 0 && (
        <View style={styles.summaryBar}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: '#27AE60' }]}>{summary.delivered}</Text>
            <Text style={styles.summaryLabel}>Delivered</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: COLORS.error }]}>{summary.absent}</Text>
            <Text style={styles.summaryLabel}>Absent</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: '#F39C12' }]}>{summary.holiday}</Text>
            <Text style={styles.summaryLabel}>Holiday</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: COLORS.primary }]}>
              {summary.totalLitres % 1 === 0
                ? summary.totalLitres
                : summary.totalLitres.toFixed(1)}L
            </Text>
            <Text style={styles.summaryLabel}>Total</Text>
          </View>

          {/* Save button inside summary bar */}
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator size="small" color={COLORS.white} />
              : <>
                  <Ionicons name="save-outline" size={18} color={COLORS.white} />
                  <Text style={styles.saveBtnText}>Save</Text>
                </>
            }
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Date bar
  dateBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  dateArrow: {
    padding: 6,
  },
  dateLabelBox: {
    alignItems: 'center',
    gap: 4,
  },
  dateLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  todayPill: {
    backgroundColor: '#E8F2FC',
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 10,
  },
  todayPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },

  // Actions bar
  actionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#E8F2FC',
    borderRadius: 20,
  },
  markAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  savedText: {
    fontSize: 12,
    color: COLORS.secondary,
    fontWeight: '600',
  },

  // Customer row
  row: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E8F2FC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
  },
  customerName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
  },

  // Status buttons
  statusButtons: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  statusBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 7,
    borderRadius: 8,
  },
  statusBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Quantity stepper
  qtyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 6,
  },
  qtyBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyInput: {
    width: 52,
    height: 30,
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    backgroundColor: COLORS.background,
    paddingVertical: 0,
  },

  // Empty state
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
    textAlign: 'center',
    paddingHorizontal: 32,
  },

  // Summary bar
  summaryBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 20 : 14,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  summaryLabel: {
    fontSize: 11,
    color: COLORS.textLight,
    marginTop: 2,
    fontWeight: '500',
  },
  summaryDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#EEE',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginLeft: 8,
  },
  saveBtnText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 14,
  },
});
