import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Modal, TextInput,
  ActivityIndicator, Alert, StyleSheet,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { signOut } from '../../services/firebase/auth';
import { updateProvider } from '../../services/firebase/provider';
import { navigationRef } from '../../navigation/AppNavigator';
import { FIELDS } from '../../constants/firebase';
import { COLORS, APP_NAME } from '../../constants';

const APP_VERSION = '1.0.0';

function SettingsRow({ icon, iconColor, label, sublabel, onPress, danger }) {
  return (
    <TouchableOpacity style={s.row} onPress={onPress} activeOpacity={0.7}>
      <View style={[s.rowIcon, { backgroundColor: (iconColor ?? COLORS.primary) + '18' }]}>
        <Ionicons name={icon} size={20} color={iconColor ?? COLORS.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.rowLabel, danger && { color: COLORS.error }]}>{label}</Text>
        {sublabel ? <Text style={s.rowSubLabel}>{sublabel}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color="#CCC" />
    </TouchableOpacity>
  );
}

export default function AdminMoreScreen() {
  const { user, providerData, refreshProfile } = useAuth();
  const navigation = useNavigation();

  const businessName = providerData?.[FIELDS.BUSINESS_NAME] ?? '';
  const ownerName    = providerData?.[FIELDS.OWNER_NAME]    ?? '';
  const joinCode     = providerData?.[FIELDS.JOIN_CODE]     ?? '';
  const rate         = providerData?.[FIELDS.PRICE_PER_LITER] ?? 60;

  const [rateModal, setRateModal]   = useState(false);
  const [newRate, setNewRate]       = useState(String(rate));
  const [savingRate, setSavingRate] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const handleCopyCode = async () => {
    await Clipboard.setStringAsync(joinCode);
    Alert.alert('Copied', `Join code "${joinCode}" copied to clipboard.`);
  };

  const handleChangeRate = async () => {
    const r = parseFloat(newRate);
    if (isNaN(r) || r <= 0) { Alert.alert('Invalid', 'Enter a valid rate.'); return; }
    setSavingRate(true);
    try {
      await updateProvider(user.uid, { [FIELDS.PRICE_PER_LITER]: r });
      await refreshProfile();
      setRateModal(false);
      Alert.alert('Updated', `Milk rate updated to ₹${r}/litre.`);
    } catch (err) {
      Alert.alert('Error', err.message ?? 'Failed to update rate.');
    } finally {
      setSavingRate(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          try {
            await signOut();
            // Use the root navigation ref — works from any depth in the tree
            if (navigationRef.isReady()) {
              navigationRef.reset({ index: 0, routes: [{ name: 'Welcome' }] });
            }
          } catch (err) {
            Alert.alert('Error', err.message ?? 'Failed to sign out.');
            setSigningOut(false);
          }
        },
      },
    ]);
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

      {/* Profile card */}
      <View style={s.profileCard}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{businessName.charAt(0).toUpperCase() || '?'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.bizName}>{businessName}</Text>
          <Text style={s.ownerName}>{ownerName}</Text>
          <Text style={s.phone}>{user?.phoneNumber ?? ''}</Text>
        </View>
      </View>

      {/* Join code */}
      <View style={s.codeCard}>
        <View style={{ flex: 1 }}>
          <Text style={s.codeLabel}>Your Join Code</Text>
          <Text style={s.codeValue}>{joinCode}</Text>
        </View>
        <TouchableOpacity style={s.copyBtn} onPress={handleCopyCode}>
          <Ionicons name="copy-outline" size={18} color={COLORS.primary} />
          <Text style={s.copyBtnText}>Copy</Text>
        </TouchableOpacity>
      </View>

      {/* Settings section */}
      <Text style={s.sectionTitle}>Settings</Text>
      <View style={s.section}>
        <SettingsRow
          icon="pricetag"
          label="Change Milk Rate"
          sublabel={`Current: ₹${rate}/litre`}
          onPress={() => { setNewRate(String(rate)); setRateModal(true); }}
        />
        <View style={s.divider} />
        <SettingsRow
          icon="person-add"
          label="Customer Requests"
          sublabel="Review pending join requests"
          onPress={() => navigation.navigate('Customers')}
        />
        <View style={s.divider} />
        <SettingsRow
          icon="receipt"
          label="Billing"
          sublabel="Generate & manage monthly bills"
          onPress={() => navigation.navigate('Billing')}
        />
        <View style={s.divider} />
        <SettingsRow
          icon="chatbubbles"
          label="Queries & Disputes"
          sublabel="Respond to customer queries"
          onPress={() => navigation.navigate('Queries')}
        />
      </View>

      {/* App info */}
      <Text style={s.sectionTitle}>About</Text>
      <View style={s.section}>
        <View style={s.infoRow}>
          <Text style={s.infoLabel}>App</Text>
          <Text style={s.infoValue}>{APP_NAME}</Text>
        </View>
        <View style={s.divider} />
        <View style={s.infoRow}>
          <Text style={s.infoLabel}>Version</Text>
          <Text style={s.infoValue}>{APP_VERSION}</Text>
        </View>
      </View>

      {/* Sign out */}
      <TouchableOpacity
        style={[s.signOutBtn, signingOut && { opacity: 0.6 }]}
        onPress={handleSignOut}
        disabled={signingOut}
      >
        {signingOut
          ? <ActivityIndicator color={COLORS.error} />
          : <>
              <Ionicons name="log-out-outline" size={20} color={COLORS.error} />
              <Text style={s.signOutText}>Sign Out</Text>
            </>
        }
      </TouchableOpacity>

      {/* Change rate modal */}
      <Modal visible={rateModal} transparent animationType="fade" onRequestClose={() => setRateModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>Change Milk Rate</Text>
            <Text style={s.modalSubtitle}>New rate will apply to future bills only.</Text>
            <TextInput
              style={s.rateInput}
              value={newRate}
              onChangeText={(v) => setNewRate(v.replace(/[^0-9.]/g, ''))}
              keyboardType="decimal-pad"
              placeholder="Enter rate"
              placeholderTextColor="#AAA"
              autoFocus
            />
            <View style={s.modalActions}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setRateModal(false)}>
                <Text style={s.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.saveBtn, savingRate && { opacity: 0.6 }]}
                onPress={handleChangeRate}
                disabled={savingRate}
              >
                {savingRate
                  ? <ActivityIndicator color={COLORS.white} />
                  : <Text style={s.saveBtnText}>Save</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  profileCard: {
    margin: 16, backgroundColor: COLORS.white, borderRadius: 16, padding: 20,
    flexDirection: 'row', alignItems: 'center', gap: 16, elevation: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4,
  },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#E8F2FC', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 24, fontWeight: '800', color: COLORS.primary },
  bizName:   { fontSize: 18, fontWeight: '800', color: COLORS.text },
  ownerName: { fontSize: 14, color: COLORS.textLight, marginTop: 2 },
  phone:     { fontSize: 13, color: COLORS.textLight, marginTop: 1 },
  codeCard: {
    marginHorizontal: 16, marginBottom: 8, backgroundColor: '#E8F2FC', borderRadius: 14,
    padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  codeLabel:   { fontSize: 12, color: COLORS.primary, fontWeight: '600', marginBottom: 4 },
  codeValue:   { fontSize: 22, fontWeight: '800', color: COLORS.primary, letterSpacing: 2 },
  copyBtn:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: COLORS.white, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  copyBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textLight, marginLeft: 16, marginTop: 12, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  section: {
    marginHorizontal: 16, backgroundColor: COLORS.white, borderRadius: 14, overflow: 'hidden',
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4,
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 14 },
  rowIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  rowSubLabel: { fontSize: 12, color: COLORS.textLight, marginTop: 1 },
  divider: { height: 1, backgroundColor: '#F5F5F5', marginLeft: 66 },
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  infoLabel: { fontSize: 15, color: COLORS.textLight },
  infoValue: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  signOutBtn: {
    margin: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.error,
    borderRadius: 14, paddingVertical: 16,
  },
  signOutText: { fontSize: 16, fontWeight: '700', color: COLORS.error },
  // Rate modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  modalBox: { backgroundColor: COLORS.white, borderRadius: 16, padding: 24, width: '80%' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
  modalSubtitle: { fontSize: 13, color: COLORS.textLight, marginBottom: 16 },
  rateInput: {
    backgroundColor: COLORS.background, borderWidth: 1, borderColor: '#DDD',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 18, fontWeight: '700', color: COLORS.text, textAlign: 'center', marginBottom: 16,
  },
  modalActions: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, borderWidth: 1.5, borderColor: '#DDD', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: COLORS.textLight },
  saveBtn: { flex: 1, backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.white },
});
