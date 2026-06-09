import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  Modal, ActivityIndicator, Alert, StyleSheet, KeyboardAvoidingView, Platform, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { getQueriesByProvider, replyToQuery } from '../../services/firebase/queries';
import { QUERY_STATUS } from '../../constants/firebase';
import { COLORS } from '../../constants';

function statusStyle(s) {
  if (s === QUERY_STATUS.RESOLVED) return { bg: '#E8F8EE', color: '#27AE60', label: 'Resolved' };
  if (s === QUERY_STATUS.IN_PROGRESS) return { bg: '#FFF3E0', color: '#F39C12', label: 'In Progress' };
  return { bg: '#FDEDEC', color: '#E74C3C', label: 'Open' };
}

function timeAgo(ts) {
  if (!ts?.seconds) return '';
  const diff = Date.now() / 1000 - ts.seconds;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function AdminQueriesScreen() {
  const { user } = useAuth();
  const [queries, setQueries]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState(null);
  const [reply, setReply]       = useState('');
  const [replying, setReplying] = useState(false);

  const load = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const list = await getQueriesByProvider(user.uid);
      setQueries(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.uid]);

  useEffect(() => { load(); }, [load]);

  const handleReply = async () => {
    if (!reply.trim()) return;
    setReplying(true);
    try {
      await replyToQuery(selected.id, reply);
      setQueries((prev) =>
        prev.map((q) => q.id === selected.id
          ? { ...q, queryStatus: QUERY_STATUS.RESOLVED, reply: reply.trim() }
          : q
        )
      );
      setSelected(null);
      setReply('');
      Alert.alert('Resolved', 'Query has been marked as resolved.');
    } catch (err) {
      Alert.alert('Error', err.message ?? 'Failed to send reply.');
    } finally {
      setReplying(false);
    }
  };

  if (loading) return <View style={s.centered}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

  return (
    <View style={s.container}>
      <FlatList
        data={queries}
        keyExtractor={(q) => q.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[COLORS.primary]} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        renderItem={({ item }) => {
          const ss = statusStyle(item.queryStatus);
          return (
            <TouchableOpacity
              style={s.card}
              onPress={() => { setSelected(item); setReply(''); }}
              activeOpacity={0.8}
            >
              <View style={s.cardHeader}>
                <Text style={s.customerName}>{item.customerName || '—'}</Text>
                <View style={[s.badge, { backgroundColor: ss.bg }]}>
                  <Text style={[s.badgeText, { color: ss.color }]}>{ss.label}</Text>
                </View>
              </View>
              <View style={s.tagRow}>
                <View style={s.chip}><Text style={s.chipText}>{item.issueType}</Text></View>
                {item.date ? <View style={s.chip}><Text style={s.chipText}>{item.date}</Text></View> : null}
                <Text style={s.time}>{timeAgo(item.createdAt)}</Text>
              </View>
              <Text style={s.message} numberOfLines={2}>{item.message}</Text>
              {item.reply ? (
                <View style={s.replyBox}>
                  <Text style={s.replyLabel}>Your reply:</Text>
                  <Text style={s.replyText}>{item.reply}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={s.emptyBox}>
            <Ionicons name="chatbubbles-outline" size={48} color="#CCC" />
            <Text style={s.emptyTitle}>No queries yet</Text>
            <Text style={s.emptySubtitle}>Customer disputes will appear here</Text>
          </View>
        }
      />

      {/* Reply Modal */}
      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelected(null)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Reply to Query</Text>
            <TouchableOpacity onPress={() => setSelected(null)}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>
          <View style={s.modalBody}>
            {selected && (
              <>
                <Text style={s.modalCustomer}>{selected.customerName}</Text>
                <View style={s.chip}><Text style={s.chipText}>{selected.issueType} · {selected.date}</Text></View>
                <Text style={s.modalMessage}>{selected.message}</Text>
                <Text style={s.label}>Your Reply</Text>
                <TextInput
                  style={s.replyInput}
                  placeholder="Type your response..."
                  placeholderTextColor="#AAA"
                  value={reply}
                  onChangeText={setReply}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
                <TouchableOpacity
                  style={[s.replyBtn, (!reply.trim() || replying) && { opacity: 0.5 }]}
                  onPress={handleReply}
                  disabled={!reply.trim() || replying}
                >
                  {replying
                    ? <ActivityIndicator color={COLORS.white} />
                    : <Text style={s.replyBtnText}>Send Reply & Resolve</Text>
                  }
                </TouchableOpacity>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: {
    backgroundColor: COLORS.white, borderRadius: 12, padding: 16,
    marginBottom: 10, elevation: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  customerName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' },
  chip: { backgroundColor: COLORS.background, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  chipText: { fontSize: 11, color: COLORS.textLight, fontWeight: '600' },
  time: { fontSize: 11, color: COLORS.textLight, marginLeft: 'auto' },
  message: { fontSize: 14, color: COLORS.text, lineHeight: 20 },
  replyBox: { marginTop: 10, backgroundColor: '#F0F7FF', borderRadius: 8, padding: 10 },
  replyLabel: { fontSize: 11, color: COLORS.primary, fontWeight: '700', marginBottom: 4 },
  replyText: { fontSize: 13, color: COLORS.text },
  emptyBox: { alignItems: 'center', paddingTop: 80 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: COLORS.text, marginTop: 16 },
  emptySubtitle: { fontSize: 13, color: COLORS.textLight, marginTop: 6 },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 20, borderBottomWidth: 1, borderBottomColor: '#F0F0F0', backgroundColor: COLORS.white,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  modalBody: { flex: 1, padding: 20, backgroundColor: COLORS.white },
  modalCustomer: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  modalMessage: { fontSize: 15, color: COLORS.text, marginVertical: 16, lineHeight: 22 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 8 },
  replyInput: {
    backgroundColor: COLORS.background, borderWidth: 1, borderColor: '#DDD',
    borderRadius: 10, padding: 14, fontSize: 15, color: COLORS.text, minHeight: 120, marginBottom: 16,
  },
  replyBtn: { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  replyBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 15 },
});
