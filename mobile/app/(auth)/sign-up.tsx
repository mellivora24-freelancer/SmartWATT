import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Input } from '../../src/components';
import { useAuth } from '../../src/auth/AuthContext';
import { colors, radii, spacing, typography } from '../../src/theme';

export default function SignUpScreen() {
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [electricPrice, setElectricPrice] = useState('2500');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignUp = async () => {
    if (!name.trim() || !phone.trim() || !password.trim()) {
      setError('Vui lòng điền đầy đủ họ tên, số điện thoại và mật khẩu');
      return;
    }

    const price = parseFloat(electricPrice) || 0;

    try {
      setError(null);
      setLoading(true);
      await signUp(name.trim(), phone.trim(), password, price);
    } catch (err: any) {
      setError(err?.detail || err?.message || 'Đăng ký không thành công');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.brandHeader}>
            <View style={styles.logoBox}>
              <Ionicons name="flash" size={32} color={colors.primary} />
            </View>
            <Text style={styles.brandTitle}>TẠO TÀI KHOẢN</Text>
            <Text style={styles.brandSubtitle}>
              Bắt đầu quản lý điện và nước gia đình với SmartWatt
            </Text>
          </View>

          <Card style={styles.formCard} elevated>
            <Text style={styles.cardTitle}>Đăng ký mới</Text>

            {error && (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={18} color={colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <Input
              label="Họ và tên"
              placeholder="Nguyễn Văn A"
              value={name}
              onChangeText={(text) => {
                setName(text);
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
              placeholder="0912345678"
              keyboardType="phone-pad"
              autoCapitalize="none"
              value={phone}
              onChangeText={(text) => {
                setPhone(text);
                if (error) setError(null);
              }}
              leftIcon={
                <Ionicons name="call-outline" size={20} color={colors.textSecondary} />
              }
            />

            <Input
              label="Mật khẩu"
              placeholder="Tối thiểu 6 ký tự"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (error) setError(null);
              }}
              leftIcon={
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color={colors.textSecondary}
                />
              }
              rightIcon={
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              }
            />

            <Input
              label="Đơn giá điện cơ bản"
              placeholder="2500"
              keyboardType="numeric"
              value={electricPrice}
              onChangeText={setElectricPrice}
              suffix="đ/kWh"
              helperText="Dùng để tự động tính chi phí & dự đoán tiền điện hàng tháng"
              leftIcon={
                <Ionicons
                  name="pricetag-outline"
                  size={20}
                  color={colors.textSecondary}
                />
              }
            />

            <Button
              title="Đăng ký tài khoản"
              onPress={handleSignUp}
              loading={loading}
              size="lg"
              style={styles.submitButton}
            />

            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Đã có tài khoản? </Text>
              <Link href="/(auth)/sign-in" asChild>
                <TouchableOpacity>
                  <Text style={styles.linkText}>Đăng nhập</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </Card>
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
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  brandHeader: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logoBox: {
    width: 60,
    height: 60,
    borderRadius: radii.xl,
    backgroundColor: colors.primarySubtle,
    borderWidth: 1,
    borderColor: colors.borderHighlight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  brandTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    letterSpacing: 1.5,
    fontWeight: '800',
  },
  brandSubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  formCard: {
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  cardTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dangerSubtle,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.dangerText,
    marginLeft: spacing.sm,
    flex: 1,
  },
  submitButton: {
    marginTop: spacing.sm,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  footerText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  linkText: {
    ...typography.bodyMedium,
    color: colors.primary,
    fontWeight: '700',
  },
});
