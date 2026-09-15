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

export default function SignInScreen() {
  const { signIn } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    if (!phone.trim() || !password.trim()) {
      setError('Vui lòng nhập đầy đủ số điện thoại và mật khẩu');
      return;
    }

    try {
      setError(null);
      setLoading(true);
      await signIn(phone.trim(), password);
    } catch (err: any) {
      setError(err?.detail || err?.message || 'Đăng nhập không thành công');
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
          {/* Logo & Brand Header */}
          <View style={styles.brandHeader}>
            <View style={styles.logoBox}>
              <Ionicons name="flash" size={32} color={colors.primary} />
            </View>
            <Text style={styles.brandTitle}>SMARTWATT</Text>
            <Text style={styles.brandSubtitle}>
              Hệ thống Giám sát Điện Năng & Nước Thông Minh
            </Text>
          </View>

          {/* Form Card */}
          <Card style={styles.formCard} elevated>
            <Text style={styles.cardTitle}>Đăng nhập</Text>
            <Text style={styles.cardSubtitle}>
              Nhập số điện thoại và mật khẩu để tiếp tục
            </Text>

            {error && (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={18} color={colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

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
              placeholder="Nhập mật khẩu"
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

            <Button
              title="Đăng nhập"
              onPress={handleSignIn}
              loading={loading}
              size="lg"
              style={styles.submitButton}
            />

            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Chưa có tài khoản? </Text>
              <Link href="/(auth)/sign-up" asChild>
                <TouchableOpacity>
                  <Text style={styles.linkText}>Đăng ký ngay</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </Card>

          {/* LAN deployment hint */}
          <View style={styles.lanNote}>
            <Ionicons name="wifi-outline" size={16} color={colors.textMuted} />
            <Text style={styles.lanNoteText}>
              Hoạt động trong mạng LAN gia đình
            </Text>
          </View>
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
    marginBottom: spacing.xxl,
  },
  logoBox: {
    width: 64,
    height: 64,
    borderRadius: radii.xl,
    backgroundColor: colors.primarySubtle,
    borderWidth: 1,
    borderColor: colors.borderHighlight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  brandTitle: {
    ...typography.h1,
    color: colors.textPrimary,
    letterSpacing: 2,
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
    ...typography.h2,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  cardSubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
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
    marginTop: spacing.md,
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
  lanNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  lanNoteText: {
    ...typography.caption,
    color: colors.textMuted,
    marginLeft: spacing.xs,
  },
});
