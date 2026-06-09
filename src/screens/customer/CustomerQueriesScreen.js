import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Modal, TextInput,
  ScrollView, ActivityIndicator, Alert, StyleSheet,
  KeyboardAvoidingView, Platform, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { createQuery, getQueriesByCustomer } from '../../services/firebase/queries';
import { FIELDS, QUERY_STATUS } from '../../constants/firebase';
import { COLORS } from '../../constants';

const ISSUE_TYPES = ['Wrong quantity', 'Marked absent wrongly', 'Holiday not recorded', 'Other'];

function statusStyle(s) {
  if (s === QUERY_STATUS.RESOLVED) return { bg: '#E8F8EE', color: '#27AE60', label: 'Resolved' };
  return { bg: '#FDEDEC', color: COLORS.error, label: 'Open' };
}

function timeAgo(ts) {
  if (!ts?.seconds) return '';
  const diff = Date.now() / 1000 - ts.seconds;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function CustomerQueriesScreen() {
  const { user, customerData } = useAuth();
  const customerId   = customerData?.id ?? customerData?.uid ?? '';
  const customerName = customerData?.[FIELDS.NAME] ?? '';
  const providerId   = customerData?.[FIELDS.PROVIDER_ID] ?? '';

  const [queries, setQueries]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal]         = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({ date: '', issueType: ISSUE_TYPES[0], message: '' });

  const load = useCallback(async () => {
    if (!customerId) return;
    try {
      const list = await getQueriesByCustomer(customerId);
      setQueries(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [customerId]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async () => {
    if (!form.message.trim()) { Alert.alert('Required', 'Please describe the issue.'); return; }
    setSubmitting(true);
    try {
      await createQuery({
        customerId,
        providerId,
        customerName,
        date:      form.date.trim(),
        issueType: form.issueType,
        message:   form.message.trim(),
      });
      setModal(false);
      setForm({ date: '', issueType: ISSUE_TYPES[0], message: '' });
      await load();
      Alert.alert('Submitted', 'Your query has been sent to the provider.');
    } catch (err) {
      Alert.alert('Error', err.message ?? 'Failed to submit query.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <View style={s.centered}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

  return (
    <View style={s.container}>
      <FlatList
        data={queries}
        keyExtractor={(q) => q.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[COLORS.primary]} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        renderItem={({ item }) => {
          const ss = statusStyle(item.queryStatus);
          return (
            <View style={s.card}>
              <View style={s.cardHeader}>
                <View style={s.chips}>
                  <View style={s.chip}><Text style={s.chipText}>{item.issueType}</Text></View>
                  {item.date ? <View style={s.chip}><Text style={s.chipText}>{item.date}</Text></View> : null}
                </View>
                <View>
                  <View style={[s.badge, { backgroundColor: ss.bg }]}>
                    <Text style={[s.badgeText, { color: ss.color }]}>{ss.label}</Text>
                  </View>
                  <Text style={s.time}>{timeAgo(item.createdAt)}</Text>
                </View>
              </View>
              <Text style={s.message}>{item.message}</Text>
              {item.reply ? (
                <View style={s.replyBox}>
                  <Text style={s.replyLabel}>Provider replied:</Text>
                  <Text style={s.replyText}>{item.reply}</Text>
                </View>
              ) : null}
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={s.emptyBox}>
            <Ionicons name="chatbubble-ellipses-outline" size={48} color="#CCC" />
            <Text style={s.emptyTitle}>No queries raised</Text>
            <Text style={s.emptySubtitle}>Tap + to report a wrong entry</Text>
          </View>
        }
      />

      {/* FAB */}
      <TouchableOpacity style={s.fab} onPress={() => setModal(true)}>
        <Ionicons name="add" size={28} color={COLORS.white} />
      </TouchableOpacity>

      {/* Raise Query Modal */}
      <Modal visible={modal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Raise a Query</Text>
            <TouchableOpacity onPress={() => setModal(false)}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={s.modalBody} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={s.label}>Date (YYYY-MM-DD)</Text>
            <TextInput
              style={s.input}
              placeholder="e.g. 2025-06-05"
              placeholderTextColor="#AAA"
              value={form.date}
              onChangeText={(v) => setForm((p) => ({ ...p, date: v }))}
            />

            <Text style={s.label}>Issue Type</Text>
            <View style={s.issueGrid}>
              {ISSUE_TYPES.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[s.issueBtn, form.issueType === t && s.issueBtnActive]}
                  onPress={() => setForm((p) => ({ ...p, issueType: t }))}
                >
                  <Text style={[s.issueBtnText, form.issueType === t && s.issueBtnTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.label}>Describe the Issue *</Text>
            <TextInput
              style={[s.input, { minHeight: 100, textAlignVertical: 'top' }]}
              placeholder="Explain what happened..."
              placeholderTextColor="#AAA"
              value={form.message}
              onChangeText={(v) => setForm((p) => ({ ...p, message: v }))}
              multiline
            />

            <TouchableOpacity
              style={[s.submitBtn, submitting && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting
                ? <ActivityIndicator color={COLORS.white} />
                : <Text style={s.submitBtnText}>Submit Query</Text>
              }
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: {
    backgroundColor: COLORS.white, borderRadius: 14, padding: 16, marginBottom: 10,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1, marginRight: 10 },
  chip: { backgroundColor: COLORS.background, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  chipText: { fontSize: 11, color: COLORS.textLight, fontWeight: '600' },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, alignSelf: 'flex-end' },
  badgeText: { fontSize: 11, fontWeight: '700' },
  time: { fontSize: 10, color: COLORS.textLight, marginTop: 4, textAlign: 'right' },
  message: { fontSize: 14, color: COLORS.text, lineHeight: 20 },
  replyBox: { marginTop: 10, backgroundColor: '#F0F7FF', borderRadius: 10, padding: 12 },
  replyLabel: { fontSize: 11, color: COLORS.primary, fontWeight: '700', marginBottom: 4 },
  replyText: { fontSize: 13, color: COLORS.text },
  emptyBox: { alignItems: 'center', paddingTop: 80 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: COLORS.text, marginTop: 16 },
  emptySubtitle: { fontSize: 13, color: COLORS.textLight, marginTop: 6 },
  fab: {
    position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28,
    backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
    elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: '#F0F0F0', backgroundColor: COLORS.white },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  modalBody: { padding: 20, paddingBottom: 40, backgroundColor: COLORS.white },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 8 },
  input: { backgroundColor: COLORS.background, borderWidth: 1, borderColor: '#DDD', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: COLORS.text, marginBottom: 16 },
  issueGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  issueBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#DDD', backgroundColor: COLORS.white },
  issueBtnActive: { borderColor: COLORS.primary, backgroundColor: '#E8F2FC' },
  issueBtnText: { fontSize: 13, color: COLORS.textLight, fontWeight: '600' },
  issueBtnTextActive: { color: COLORS.primary },
  submitBtn: { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  submitBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 15 },
});
