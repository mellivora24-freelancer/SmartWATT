import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ForecastResponse } from '../api/types';
import { colors, radii, spacing, typography } from '../theme';
import { formatVND, formatWaterVolume } from '../utils/format';
import { Card } from './Card';

interface WaterCostWidgetProps {
  forecast: ForecastResponse | null;
  loading?: boolean;
}

export function WaterCostWidget({
  forecast,
  loading = false,
}: WaterCostWidgetProps) {
  if (loading || !forecast) {
    return (
      <Card style={styles.card}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Ionicons name="water" size={18} color={colors.water} />
            <Text style={styles.title}>Chi phí nước tháng này</Text>
          </View>
        </View>
        <Text style={styles.loadingText}>Đang tính toán dự báo nước...</Text>
      </Card>
    );
  }

  const { water, period, water_price } = forecast;
  const isUp = water.trend === 'up';
  const trendColor = isUp ? colors.trendUp : colors.trendDown;
  const trendIcon = isUp ? 'trending-up' : 'trending-down';
  const trendText = isUp ? 'Dự báo tăng' : 'Dự báo giảm';

  const currentM3 = water.current_m3 ?? (water.current_l ? water.current_l / 1000 : 0);
  const predictedM3 = water.predicted_m3 ?? (water.predicted_l ? water.predicted_l / 1000 : 0);
  const previousCost =
    water.previous_month_cost ??
    (water.previous_month_l !== null && water.previous_month_l !== undefined
      ? (water.previous_month_l / 1000) * (water_price || 10000)
      : null);

  return (
    <Card style={styles.card} elevated>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={styles.iconCircle}>
            <Ionicons name="water" size={16} color={colors.water} />
          </View>
          <Text style={styles.title}>
            Nước sinh hoạt Tháng {period.month}/{period.year}
          </Text>
        </View>

        <View
          style={[
            styles.trendBadge,
            { backgroundColor: isUp ? colors.dangerSubtle : colors.normalSubtle },
          ]}
        >
          <Ionicons name={trendIcon} size={14} color={trendColor} />
          <Text style={[styles.trendText, { color: trendColor }]}>
            {trendText}
          </Text>
        </View>
      </View>

      {/* Main current water cost */}
      <View style={styles.mainSection}>
        <Text style={styles.label}>Chi phí nước ước tính hiện tại</Text>
        <Text style={styles.currentCost}>{formatVND(water.current_cost)}</Text>
        <Text style={styles.currentVolume}>
          Đã tiêu thụ:{' '}
          <Text style={styles.volumeHighlight}>
            {formatWaterVolume(water.current_l)}
          </Text>{' '}
          ({currentM3.toFixed(3)} m³) • ngày {period.current_day}/{period.days_in_month}
        </Text>
      </View>

      <View style={styles.divider} />

      {/* Forecast comparison footer */}
      <View style={styles.footer}>
        <View style={styles.forecastColumn}>
          <Text style={styles.footerLabel}>Dự đoán cả tháng</Text>
          <Text style={[styles.forecastCost, { color: trendColor }]}>
            {formatVND(water.predicted_cost)}
          </Text>
          <Text style={styles.forecastVolume}>
            ~ {formatWaterVolume(water.predicted_l)} ({predictedM3.toFixed(2)} m³)
          </Text>
        </View>

        <View style={styles.separator} />

        <View style={styles.forecastColumn}>
          <Text style={styles.footerLabel}>
            Tháng trước ({period.month === 1 ? 12 : period.month - 1})
          </Text>
          {water.previous_month_l !== null && water.previous_month_l !== undefined ? (
            <>
              <Text style={styles.previousCost}>
                {formatVND(previousCost)}
              </Text>
              <Text style={styles.previousVolume}>
                {formatWaterVolume(water.previous_month_l)}
              </Text>
            </>
          ) : (
            <Text style={styles.noPreviousText}>Chưa có dữ liệu</Text>
          )}
        </View>
      </View>

      {/* Price tag note */}
      <View style={styles.priceNoteRow}>
        <Ionicons name="pricetag-outline" size={12} color={colors.textMuted} />
        <Text style={styles.priceNoteText}>
          Đơn giá nước áp dụng: {formatVND(water_price || 10000)}/m³ (1.000 Lít)
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: radii.sm,
    backgroundColor: colors.waterSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  title: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  trendText: {
    ...typography.caption,
    fontWeight: '700',
    marginLeft: 3,
  },
  mainSection: {
    marginVertical: spacing.xs,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  currentCost: {
    ...typography.h1,
    color: colors.textPrimary,
    fontWeight: '800',
    marginVertical: spacing.xs,
  },
  currentVolume: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  volumeHighlight: {
    color: colors.water,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  forecastColumn: {
    flex: 1,
  },
  separator: {
    width: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  footerLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: 2,
  },
  forecastCost: {
    ...typography.bodyLarge,
    fontWeight: '700',
  },
  forecastVolume: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  previousCost: {
    ...typography.bodyLarge,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  previousVolume: {
    ...typography.caption,
    color: colors.textMuted,
  },
  noPreviousText: {
    ...typography.bodySmall,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: 2,
  },
  priceNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceSubtle,
    gap: 4,
  },
  priceNoteText: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
  },
  loadingText: {
    ...typography.bodyMedium,
    color: colors.textMuted,
    marginVertical: spacing.md,
  },
});
