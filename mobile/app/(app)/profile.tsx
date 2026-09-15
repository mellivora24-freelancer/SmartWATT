import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/auth/AuthContext';
import {
  Button,
  Card,
  Header,
  Input,
} from '../../src/components';
import { config } from '../../src/config';
import { colors, radii, spacing, typography } from '../../src/theme';
import { formatDateTime, formatVND } from '../../src/utils/format';

export default function ProfileScreen() {
  const { user, signOut, updateUser } = useAuth();

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [password, setPassword] = useState('');
  const [electricPrice, setElectricPrice] = useState(
    user?.electric_price ? String(user.electric_price) : '2500'
  );
  const [waterPrice, setWaterPrice] = useState(
    user?.water_price ? String(user.water_price) : '10000'
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleUpdate = async () => {
    if (!name.trim() || !phone.trim()) {
      setError('Họ tên và số điện thoại không được để trống');
      return;
    }

    try {
      setError(null);
      setSuccess(null);
      setSaving(true);

      const price = parseFloat(electricPrice) || 0;
      const wPrice = parseFloat(waterPrice) || 10000;
      await updateUser({
        name: name.trim(),
        phone: phone.trim(),
        password: password.trim() ? password.trim() : undefined,
        electric_price: price,
        water_price: wPrice,
      });

      setPassword('');
      setSuccess('Cập nhật thông tin thành công!');
    } catch (err: any) {
      setError(err?.detail || err?.message || 'Cập nhật thất bại');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Đăng xuất', 'Bạn có chắc chắn muốn đăng xuất khỏi ứng dụng?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Đăng xuất',
        style: 'destructive',
        onPress: () => signOut(),
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Hồ sơ cá nhân" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* User Avatar Card */}
          <Card style={styles.userCard} elevated>
            <View style={styles.avatarBox}>
              <Ionicons name="person" size={32} color={colors.primary} />
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{user?.name || 'Chủ hộ SmartWatt'}</Text>
              <Text style={styles.userPhone}>{user?.phone}</Text>
              <Text style={styles.userJoined}>
                ⚡ Điện: {formatVND(user?.electric_price)}/kWh  •  💧 Nước: {formatVND(user?.water_price ?? 10000)}/m³
              </Text>
            </View>
          </Card>

          {error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={18} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {success && (
            <View style={styles.successBox}>
              <Ionicons name="checkmark-circle" size={18} color={colors.normal} />
              <Text style={styles.successText}>{success}</Text>
            </View>
          )}

          {/* Edit Form Card */}
          <Card style={styles.formCard} elevated>
            <Text style={styles.formTitle}>Chỉnh sửa thông tin</Text>

            <Input
              label="Họ và tên"
              value={name}
              onChangeText={(t) => {
                setName(t);
                if (error) setError(null);
              }}
              leftIcon={
                <Ionicons
                  name="person-outline"
                  size={20}
                  color={colors.textSecondary}
                />
              }
            />

            <Input
              label="Số điện thoại"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={(t) => {
                setPhone(t);
                if (error) setError(null);
              }}
              leftIcon={
                <Ionicons name="call-outline" size={20} color={colors.textSecondary} />
              }
            />

            <Input
              label="Đơn giá điện cơ bản"
              keyboardType="numeric"
              value={electricPrice}
              onChangeText={setElectricPrice}
              suffix="đ/kWh"
              helperText="Đơn giá dùng để nhân với kWh thực tế để dự đoán tiền điện tháng."
              leftIcon={
                <Ionicons
                  name="flash-outline"
                  size={20}
                  color={colors.electric}
                />
              }
            />

            <Input
              label="Đơn giá nước cơ bản"
              keyboardType="numeric"
              value={waterPrice}
              onChangeText={setWaterPrice}
              suffix="đ/m³"
              helperText="Đơn giá dùng để nhân với số m³ (1000L) thực tế để dự đoán tiền nước tháng."
              leftIcon={
                <Ionicons
                  name="water-outline"
                  size={20}
                  color={colors.water}
                />
              }
            />

            <Input
              label="Đổi mật khẩu mới (để trống nếu không đổi)"
              placeholder="Nhập mật khẩu mới"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              leftIcon={
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color={colors.textSecondary}
                />
              }
            />

            <Button
              title="Lưu thông tin"
              variant="primary"
              size="lg"
              loading={saving}
              onPress={handleUpdate}
              style={{ marginTop: spacing.sm }}
            />
          </Card>

          {/* System & Connection Info */}
          <Card style={styles.infoCard} variant="subtle">
            <Text style={styles.infoTitle}>Thông tin hệ thống</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Máy chủ API:</Text>
              <Text style={styles.infoVal}>{config.apiBaseUrl}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Realtime Socket:</Text>
              <Text style={styles.infoVal}>{config.wsBaseUrl}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Môi trường:</Text>
              <Text style={styles.infoVal}>{config.appEnv}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Phiên bản:</Text>
              <Text style={styles.infoVal}>SmartWatt v1.0.0 (Expo 52)</Text>
            </View>
          </Card>

          {/* Logout Button */}
          <Button
            title="Đăng xuất"
            variant="danger"
            size="lg"
            onPress={handleSignOut}
            icon={<Ionicons name="log-out-outline" size={20} color="#FFFFFF" />}
            style={styles.logoutBtn}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  avatarBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primarySubtle,
    borderWidth: 1,
    borderColor: colors.borderHighlight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.lg,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    ...typography.h3,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  userPhone: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  userJoined: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
    marginTop: 4,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dangerSubtle,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.dangerText,
    marginLeft: spacing.sm,
    flex: 1,
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.normalSubtle,
    borderWidth: 1,
    borderColor: colors.normal,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  successText: {
    ...typography.bodySmall,
    color: colors.normalText,
    marginLeft: spacing.sm,
    flex: 1,
  },
  formCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  formTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  infoCard: {
    backgroundColor: colors.surfaceSubtle,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  infoTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  infoLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  infoVal: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  logoutBtn: {
    marginBottom: spacing.xl,
  },
});
