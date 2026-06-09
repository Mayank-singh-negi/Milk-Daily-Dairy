import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ActivityIndicator, StyleSheet, Modal, ScrollView,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { useAuth } from '../../contexts/AuthContext';
import { getCustomerDeliveries } from '../../services/firebase/deliveries';
import { FIELDS, DELIVERY_STATUS } from '../../constants/firebase';
import { COLORS } from '../../constants';

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function statusDot(status) {
  switch (status) {
    case DELIVERY_STATUS.DELIVERED: return { color: '#27AE60', label: 'Delivered' };
    case DELIVERY_STATUS.MISSED:    return { color: COLORS.error, label: 'Absent' };
    case DELIVERY_STATUS.SKIPPED:   return { color: '#F39C12', label: 'Holiday' };
    default:                        return { color: '#CCC', label: 'Unknown' };
  }
}

export default function CustomerCalendarScreen() {
  const { customerData } = useAuth();
  const customerId = customerData?.id ?? customerData?.uid ?? '';

  const [month, setMonth]           = useState(currentMonth());
  const [markedDates, setMarkedDates] = useState({});
  const [deliveries, setDeliveries]   = useState([]);
  const [loading, setLoading]         = useState(true);
  const [selected, setSelected]       = useState(null); // date string for detail modal

  const load = useCallback(async (m) => {
    if (!customerId) return;
    setLoading(true);
    try {
      const list = await getCustomerDeliveries(customerId, m);
      setDeliveries(list);

      const marks = {};
      list.forEach((d) => {
        const dot = statusDot(d.status);
        marks[d.date] = {
          marked: true,
          dotColor: dot.color,
          customStyles: {
            container: { backgroundColor: dot.color + '22', borderRadius: 8 },
            text: { color: COLORS.text, fontWeight: '600' },
          },
        };
      });
      setMarkedDates(marks);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => { load(month); }, [load, month]);

  const handleDayPress = (day) => {
    const entry = deliveries.find((d) => d.date === day.dateString);
    if (entry) setSelected(entry);
  };

  const handleMonthChange = (m) => {
    const newMonth = `${m.year}-${String(m.month).padStart(2, '0')}`;
    setMonth(newMonth);
  };

  return (
    <View style={s.container}>
      {loading && (
        <View style={s.loadingOverlay}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      )}

      <Calendar
        current={`${month}-01`}
        onDayPress={handleDayPress}
        onMonthChange={handleMonthChange}
        markedDates={markedDates}
        markingType="custom"
        theme={{
          backgroundColor: COLORS.white,
          calendarBackground: COLORS.white,
          selectedDayBackgroundColor: COLORS.primary,
          todayTextColor: COLORS.primary,
          arrowColor: COLORS.primary,
          monthTextColor: COLORS.text,
          textMonthFontWeight: '700',
          textDayFontSize: 14,
          textMonthFontSize: 16,
        }}
        style={s.calendar}
      />

      {/* Legend */}
      <View style={s.legend}>
        {[
          { color: '#27AE60', label: 'Delivered' },
          { color: COLORS.error, label: 'Absent' },
          { color: '#F39C12', label: 'Holiday' },
        ].map((l) => (
          <View key={l.label} style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: l.color }]} />
            <Text style={s.legendLabel}>{l.label}</Text>
          </View>
        ))}
      </View>

      {/* Month summary */}
      {!loading && (
        <View style={s.summaryRow}>
          {[
            { label: 'Delivered', value: deliveries.filter((d) => d.status === DELIVERY_STATUS.DELIVERED).length, color: '#27AE60' },
            { label: 'Absent',   value: deliveries.filter((d) => d.status === DELIVERY_STATUS.MISSED).length, color: COLORS.error },
            { label: 'Holiday',  value: deliveries.filter((d) => d.status === DELIVERY_STATUS.SKIPPED).length, color: '#F39C12' },
            {
              label: 'Total L',
              value: deliveries
                .filter((d) => d.status === DELIVERY_STATUS.DELIVERED)
                .reduce((s, d) => s + (d.quantity ?? 0), 0)
                .toFixed(1),
              color: COLORS.primary,
            },
          ].map((stat, i) => (
            <View key={i} style={s.statBox}>
              <Text style={[s.statVal, { color: stat.color }]}>{stat.value}</Text>
              <Text style={s.statLbl}>{stat.label}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Day detail modal */}
      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            {selected && (() => {
              const dot = statusDot(selected.status);
              return (
                <>
                  <Text style={s.modalDate}>{selected.date}</Text>
                  <View style={[s.modalStatus, { backgroundColor: dot.color + '22' }]}>
                    <Text style={[s.modalStatusText, { color: dot.color }]}>{dot.label}</Text>
                  </View>
                  {selected.status === DELIVERY_STATUS.DELIVERED && (
                    <Text style={s.modalQty}>Quantity: {selected.quantity} L</Text>
                  )}
                  <Text style={s.modalClose} onPress={() => setSelected(null)}>Close</Text>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', zIndex: 10, backgroundColor: 'rgba(255,255,255,0.7)' },
  calendar: { borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 20, padding: 12, backgroundColor: COLORS.white },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontSize: 12, color: COLORS.textLight, fontWeight: '600' },
  summaryRow: {
    flexDirection: 'row', backgroundColor: COLORS.white, margin: 16, borderRadius: 14, paddingVertical: 16,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4,
  },
  statBox: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: 20, fontWeight: '800' },
  statLbl: { fontSize: 11, color: COLORS.textLight, marginTop: 3 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  modalBox: { backgroundColor: COLORS.white, borderRadius: 16, padding: 28, width: '75%', alignItems: 'center' },
  modalDate: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 16 },
  modalStatus: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, marginBottom: 12 },
  modalStatusText: { fontSize: 16, fontWeight: '700' },
  modalQty: { fontSize: 15, color: COLORS.textLight, marginBottom: 16 },
  modalClose: { fontSize: 15, color: COLORS.primary, fontWeight: '700', marginTop: 8 },
});
