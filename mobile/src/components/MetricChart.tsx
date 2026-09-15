import React from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BarChart, LineChart } from 'react-native-gifted-charts';
import { colors, radii, spacing, typography } from '../theme';

const SCREEN_WIDTH = Dimensions.get('window').width;

export interface ChartDataPoint {
  value: number;
  label: string;
  frontColor?: string;
  bucketKey?: string;
  fullBucket?: any;
  fullData?: any;
}

interface MetricChartProps {
  type?: 'bar' | 'line';
  data: ChartDataPoint[];
  unit?: string;
  height?: number;
  color?: string;
  onPointPress?: (item: ChartDataPoint) => void;
  maxValue?: number;
  noOfSections?: number;
}

export function MetricChart({
  type = 'bar',
  data,
  unit = '',
  height = 180,
  color = colors.primary,
  onPointPress,
  maxValue,
  noOfSections = 4,
}: MetricChartProps) {
  if (!data || data.length === 0) {
    return (
      <View style={[styles.emptyContainer, { height }]}>
        <Text style={styles.emptyText}>Chưa có dữ liệu biểu đồ</Text>
      </View>
    );
  }

  const chartData = data.map((item) => ({
    ...item,
    value: Math.max(0, item.value || 0),
    frontColor: item.frontColor || color,
    onPress: () => onPointPress?.(item),
  }));

  const chartWidth = Math.max(SCREEN_WIDTH - 64, data.length * 36);

  return (
    <View style={styles.container}>
      {type === 'bar' ? (
        <BarChart
          data={chartData}
          height={height}
          width={chartWidth}
          barWidth={Math.max(12, Math.min(24, Math.floor(chartWidth / (data.length * 2))))}
          spacing={Math.max(8, Math.min(20, Math.floor(chartWidth / (data.length * 2.5))))}
          roundedTop
          roundedBottom={false}
          hideRules={false}
          rulesColor={colors.border}
          rulesType="solid"
          yAxisColor={colors.border}
          xAxisColor={colors.border}
          yAxisTextStyle={styles.axisText}
          xAxisLabelTextStyle={styles.axisText}
          noOfSections={noOfSections}
          maxValue={maxValue}
          isAnimated
          animationDuration={300}
        />
      ) : (
        <LineChart
          data={chartData}
          height={height}
          width={chartWidth}
          color={color}
          thickness={2.5}
          dataPointsColor={color}
          dataPointsRadius={4}
          hideRules={false}
          rulesColor={colors.border}
          rulesType="solid"
          yAxisColor={colors.border}
          xAxisColor={colors.border}
          yAxisTextStyle={styles.axisText}
          xAxisLabelTextStyle={styles.axisText}
          noOfSections={noOfSections}
          maxValue={maxValue}
          curved={false}
          isAnimated
          animationDuration={300}
        />
      )}

      {unit ? (
        <View style={styles.unitBadge}>
          <Text style={styles.unitText}>Đơn vị: {unit}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    overflow: 'hidden',
  },
  axisText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '500',
  },
  emptyContainer: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  unitBadge: {
    alignSelf: 'flex-end',
    marginTop: spacing.xs,
  },
  unitText: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
  },
});
