import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography } from '../theme';

interface StatusBannerProps {
  connected: boolean;
  onReconnect?: () => void;
  message?: string;
}

export function StatusBanner({
  connected,
  onReconnect,
  message,
}: StatusBannerProps) {
  if (connected) return null;

  return (
    <View style={styles.banner}>
      <View style={styles.left}>
        <Ionicons name="cloud-offline-outline" size={18} color={colors.warning} />
        <Text style={styles.text}>
          {message || 'Mất kết nối realtime tới máy chủ SmartWatt'}
        </Text>
      </View>
      {onReconnect && (
        <TouchableOpacity style={styles.button} onPress={onReconnect}>
          <Text style={styles.buttonText}>Thử lại</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.warningSubtle,
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.sm,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  text: {
    ...typography.bodySmall,
    color: colors.warningText,
    marginLeft: spacing.sm,
    flex: 1,
  },
  button: {
    backgroundColor: colors.warning,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    marginLeft: spacing.sm,
  },
  buttonText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textInverse,
  },
});
