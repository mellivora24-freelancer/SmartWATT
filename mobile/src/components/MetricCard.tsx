import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography } from '../theme';
import { getMetricBand } from '../utils/bands';
import { Badge } from './Badge';

interface MetricCardProps {
  label: string;
  valueString: string;
  rawValue?: number | null;
  minThreshold?: number | null;
  maxThreshold?: number | null;
  icon: keyof typeof Ionicons.glyphMap;
  unit?: string;
  onPress?: () => void;
  accentColor?: string;
}

export function MetricCard({
  label,
  valueString,
  rawValue,
  minThreshold,
  maxThreshold,
  icon,
  unit,
  onPress,
  accentColor,
}: MetricCardProps) {
  const bandResult = getMetricBand(rawValue, minThreshold, maxThreshold);

  // Border highlight based on danger/warning or default
  let borderColor = colors.border;
  if (bandResult.band === 'danger') {
    borderColor = colors.danger;
  } else if (bandResult.band === 'warning') {
    borderColor = colors.warning;
  }

  const Component = onPress ? TouchableOpacity : View;

  return (
    <Component
      style={[
        styles.card,
        {
          borderColor,
          backgroundColor:
            bandResult.band === 'danger'
              ? colors.dangerSubtle
              : bandResult.band === 'warning'
              ? colors.warningSubtle
              : colors.surface,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.header}>
        <View
          style={[
            styles.iconWrapper,
            {
              backgroundColor: accentColor
                ? `${accentColor}20`
                : colors.surfaceElevated,
            },
          ]}
        >
          <Ionicons
            name={icon}
            size={18}
            color={accentColor || colors.primary}
          />
        </View>

        {bandResult.ratio !== null && (
          <Badge
            label={bandResult.label}
            variant={
              bandResult.band === 'danger'
                ? 'danger'
                : bandResult.band === 'warning'
                ? 'warning'
                : 'normal'
            }
            size="sm"
          />
        )}
      </View>

      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>

      <View style={styles.valueRow}>
        <Text style={styles.value} numberOfLines={1}>
          {valueString}
        </Text>
        {unit && <Text style={styles.unit}>{unit}</Text>}
      </View>

      {(minThreshold !== undefined || maxThreshold !== undefined) && (
        <View style={styles.thresholdRow}>
          <Text style={styles.thresholdText}>
            Ngưỡng:{' '}
            {minThreshold !== null && minThreshold !== undefined
              ? `≥ ${minThreshold}`
              : ''}
            {minThreshold && maxThreshold ? ' | ' : ''}
            {maxThreshold !== null && maxThreshold !== undefined
              ? `≤ ${maxThreshold}`
              : ''}
            {!minThreshold && !maxThreshold ? 'Mặc định' : ''}
          </Text>
        </View>
      )}
    </Component>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.md,
    flex: 1,
    minWidth: 150,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '500',
    marginBottom: 2,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginVertical: 2,
  },
  value: {
    ...typography.h2,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  unit: {
    ...typography.caption,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  thresholdRow: {
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  thresholdText: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
  },
});
