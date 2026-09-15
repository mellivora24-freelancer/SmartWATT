import { colors } from '../theme/colors';

export type AlertBand = 'normal' | 'warning' | 'danger';

export interface BandResult {
  band: AlertBand;
  ratio: number | null;
  color: string;
  subtleBg: string;
  textColor: string;
  label: string;
}

/**
 * Calculates the threshold ratio and alert band for a metric value against min/max thresholds.
 *
 * Rules:
 * - Upper threshold (max): ratio = value / max
 * - Lower threshold (min): ratio = min / value (so when value drops below min, ratio > 1)
 * - Band thresholds:
 *     ratio < 0.8  -> 'normal' (Green)
 *     0.8 <= ratio <= 1.5 -> 'warning' (Amber)
 *     ratio > 1.5  -> 'danger' (Red)
 */
export function getMetricBand(
  value: number | null | undefined,
  minThreshold: number | null | undefined,
  maxThreshold: number | null | undefined
): BandResult {
  if (value === null || value === undefined || isNaN(value)) {
    return {
      band: 'normal',
      ratio: null,
      color: colors.textMuted,
      subtleBg: colors.surfaceSubtle,
      textColor: colors.textSecondary,
      label: 'Không có dữ liệu',
    };
  }

  let ratio = 0;

  // Evaluate upper limit first if present and exceeded or approached
  if (maxThreshold !== null && maxThreshold !== undefined && maxThreshold > 0) {
    ratio = value / maxThreshold;
  }

  // Check lower limit if specified (e.g. voltage drop)
  if (minThreshold !== null && minThreshold !== undefined && minThreshold > 0 && value > 0) {
    const lowerRatio = minThreshold / value;
    if (lowerRatio > ratio) {
      ratio = lowerRatio;
    }
  }

  // If no thresholds configured, treat as normal
  if (
    (minThreshold === null || minThreshold === undefined) &&
    (maxThreshold === null || maxThreshold === undefined)
  ) {
    return {
      band: 'normal',
      ratio: null,
      color: colors.normal,
      subtleBg: colors.normalSubtle,
      textColor: colors.normalText,
      label: 'Bình thường',
    };
  }

  if (ratio > 1.5) {
    return {
      band: 'danger',
      ratio,
      color: colors.danger,
      subtleBg: colors.dangerSubtle,
      textColor: colors.dangerText,
      label: 'Nguy hiểm',
    };
  }

  if (ratio >= 0.8) {
    return {
      band: 'warning',
      ratio,
      color: colors.warning,
      subtleBg: colors.warningSubtle,
      textColor: colors.warningText,
      label: 'Cảnh báo',
    };
  }

  return {
    band: 'normal',
    ratio,
    color: colors.normal,
    subtleBg: colors.normalSubtle,
    textColor: colors.normalText,
    label: 'Bình thường',
  };
}
