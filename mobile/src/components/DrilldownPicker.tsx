import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AggregationLevel } from '../api/types';
import { colors, radii, spacing, typography } from '../theme';

interface DrilldownPickerProps {
  level: AggregationLevel;
  rangeLabel: string;
  onLevelChange: (level: AggregationLevel) => void;
  onNavigateUp?: () => void;
  canNavigateUp?: boolean;
}

const LEVEL_NAMES: Record<AggregationLevel, string> = {
  year: 'Năm',
  month: 'Tháng',
  day: 'Ngày',
  hour: 'Giờ',
  minute: 'Phút',
};

const LEVELS_ORDER: AggregationLevel[] = ['year', 'month', 'day', 'hour', 'minute'];

export function DrilldownPicker({
  level,
  rangeLabel,
  onLevelChange,
  onNavigateUp,
  canNavigateUp = false,
}: DrilldownPickerProps) {
  return (
    <View style={styles.container}>
      {/* Level selector tabs */}
      <View style={styles.tabsRow}>
        {LEVELS_ORDER.map((lvl) => {
          const isActive = lvl === level;
          return (
            <TouchableOpacity
              key={lvl}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => onLevelChange(lvl)}
            >
              <Text
                style={[
                  styles.tabText,
                  isActive && styles.tabTextActive,
                ]}
              >
                {LEVEL_NAMES[lvl]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Range and drill-up header */}
      <View style={styles.rangeBar}>
        {canNavigateUp && (
          <TouchableOpacity style={styles.upButton} onPress={onNavigateUp}>
            <Ionicons name="arrow-up" size={16} color={colors.primary} />
            <Text style={styles.upText}>Cấp trên</Text>
          </TouchableOpacity>
        )}

        <View style={styles.labelWrapper}>
          <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.rangeText} numberOfLines={1}>
            {rangeLabel}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radii.md,
    padding: 2,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.xs + 2,
    alignItems: 'center',
    borderRadius: radii.sm,
  },
  tabActive: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  tabText: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '500',
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  rangeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  upButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySubtle,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  upText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
    marginLeft: 3,
  },
  labelWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
  },
  rangeText: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '600',
    marginLeft: spacing.xs,
  },
});
