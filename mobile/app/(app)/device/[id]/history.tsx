import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { devicesApi } from '../../../../src/api/endpoints';
import {
  AggregationLevel,
  Device,
  SummaryResponse,
  TelemetryItem,
  TelemetrySummaryBucket,
} from '../../../../src/api/types';
import {
  Button,
  Card,
  DrilldownPicker,
  Header,
  LoadingState,
  MetricChart,
} from '../../../../src/components';
import { colors, radii, spacing, typography } from '../../../../src/theme';
import {
  formatCurrent,
  formatDateTime,
  formatEnergy,
  formatFrequency,
  formatPower,
  formatPowerFactor,
  formatShortDate,
  formatTimeOnly,
  formatVoltage,
  formatWaterFlow,
  formatWaterVolume,
} from '../../../../src/utils/format';

type MetricType =
  | 'power'
  | 'energy'
  | 'voltage'
  | 'current'
  | 'power_factor'
  | 'frequency'
  | 'water_volume'
  | 'water_flow';

const METRIC_OPTIONS: Array<{ key: MetricType; label: string; unit: string; color: string }> = [
  { key: 'power', label: 'Công suất', unit: 'W', color: colors.electric },
  { key: 'energy', label: 'Năng lượng', unit: 'kWh', color: colors.primary },
  { key: 'voltage', label: 'Điện áp', unit: 'V', color: colors.secondary },
  { key: 'current', label: 'Dòng điện', unit: 'A', color: colors.warning },
  { key: 'power_factor', label: 'Hệ số PF', unit: '', color: colors.primary },
  { key: 'frequency', label: 'Tần số', unit: 'Hz', color: colors.primary },
  { key: 'water_volume', label: 'Lượng nước', unit: 'L', color: colors.water },
  { key: 'water_flow', label: 'Lưu lượng nước', unit: 'L/p', color: colors.water },
];

export default function HistoryDrilldownScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const deviceId = parseInt(id, 10);

  const [device, setDevice] = useState<Device | null>(null);
  const [level, setLevel] = useState<AggregationLevel>('hour');
  const [rangeStart, setRangeStart] = useState<string | undefined>(undefined);
  const [rangeEnd, setRangeEnd] = useState<string | undefined>(undefined);
  const [historyStack, setHistoryStack] = useState<
    Array<{ level: AggregationLevel; start?: string; end?: string; label: string }>
  >([]);

  const [selectedMetric, setSelectedMetric] = useState<MetricType>('power');
  const [summaryData, setSummaryData] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Raw telemetry pagination state for minute level
  const [rawTelemetry, setRawTelemetry] = useState<TelemetryItem[]>([]);
  const [rawTotal, setRawTotal] = useState(0);
  const [rawOffset, setRawOffset] = useState(0);
  const [rawLoadingMore, setRawLoadingMore] = useState(false);

  // Load Device info
  useEffect(() => {
    if (deviceId) {
      devicesApi.get(deviceId).then(setDevice).catch(() => {});
    }
  }, [deviceId]);

  // Fetch summary or raw telemetry
  const fetchData = useCallback(async () => {
    if (!deviceId) return;
    try {
      setLoading(true);
      if (level === 'minute') {
        const [sumRes, telRes] = await Promise.all([
          devicesApi.getSummary(deviceId, {
            level: 'minute',
            start: rangeStart,
            end: rangeEnd,
          }),
          devicesApi.getTelemetry(deviceId, {
            start: rangeStart,
            end: rangeEnd,
            limit: 50,
            offset: 0,
          }),
        ]);
        setSummaryData(sumRes);
        setRawTelemetry(telRes.items || []);
        setRawTotal(telRes.total || 0);
        setRawOffset(0);
      } else {
        const sumRes = await devicesApi.getSummary(deviceId, {
          level,
          start: rangeStart,
          end: rangeEnd,
        });
        setSummaryData(sumRes);
        setRawTelemetry([]);
      }
    } catch {
      // Ignored
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [deviceId, level, rangeStart, rangeEnd]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const loadMoreRaw = async () => {
    if (rawLoadingMore || rawTelemetry.length >= rawTotal) return;
    try {
      setRawLoadingMore(true);
      const nextOffset = rawOffset + 50;
      const res = await devicesApi.getTelemetry(deviceId, {
        start: rangeStart,
        end: rangeEnd,
        limit: 50,
        offset: nextOffset,
      });
      setRawTelemetry((prev) => [...prev, ...(res.items || [])]);
      setRawOffset(nextOffset);
    } catch {
      // Ignored
    } finally {
      setRawLoadingMore(false);
    }
  };

  // Drill down when tapping a bucket
  const handleDrilldown = (bucket: TelemetrySummaryBucket) => {
    const nextLevelMap: Record<AggregationLevel, AggregationLevel | null> = {
      year: 'month',
      month: 'day',
      day: 'hour',
      hour: 'minute',
      minute: null,
    };

    const nextLvl = nextLevelMap[level];
    if (!nextLvl) return;

    // Push current level to history stack
    setHistoryStack((prev) => [
      ...prev,
      {
        level,
        start: rangeStart,
        end: rangeEnd,
        label: formatRangeTitle(level, summaryData?.start, summaryData?.end),
      },
    ]);

    // Set new range based on bucket timestamp
    setLevel(nextLvl);
    setRangeStart(bucket.bucket);
    setRangeEnd(undefined); // Let backend compute appropriate slice from start
  };

  const handleNavigateUp = () => {
    if (historyStack.length === 0) {
      const prevLevelMap: Record<AggregationLevel, AggregationLevel | null> = {
        minute: 'hour',
        hour: 'day',
        day: 'month',
        month: 'year',
        year: null,
      };
      const prevLvl = prevLevelMap[level];
      if (prevLvl) {
        setLevel(prevLvl);
        setRangeStart(undefined);
        setRangeEnd(undefined);
      }
      return;
    }

    const last = historyStack[historyStack.length - 1];
    setHistoryStack((prev) => prev.slice(0, -1));
    setLevel(last.level);
    setRangeStart(last.start);
    setRangeEnd(last.end);
  };

  const handleLevelTabSelect = (newLevel: AggregationLevel) => {
    setLevel(newLevel);
    setRangeStart(undefined);
    setRangeEnd(undefined);
    setHistoryStack([]);
  };

  function formatRangeTitle(
    lvl: AggregationLevel,
    start?: string,
    end?: string
  ): string {
    if (!start) return `Mức ${lvl.toUpperCase()}`;
    const s = new Date(start);
    if (isNaN(s.getTime())) return start;

    switch (lvl) {
      case 'year':
        return `Năm ${s.getFullYear()}`;
      case 'month':
        return `Tháng ${s.getMonth() + 1}/${s.getFullYear()}`;
      case 'day':
        return `Ngày ${s.getDate()}/${s.getMonth() + 1}/${s.getFullYear()}`;
      case 'hour':
        return `Ngày ${formatShortDate(s)} • Mức Giờ`;
      case 'minute':
        return `${formatShortDate(s)} ${formatTimeOnly(s)} • Mức Phút`;
      default:
        return `${lvl}`;
    }
  }

  // Format chart data based on selected metric
  const currentMetricConfig =
    METRIC_OPTIONS.find((m) => m.key === selectedMetric) || METRIC_OPTIONS[0];

  const chartData = (summaryData?.buckets || []).map((b) => {
    let val = 0;
    switch (selectedMetric) {
      case 'power':
        val = b.avg_power || 0;
        break;
      case 'energy':
        val = b.energy_kwh || 0;
        break;
      case 'voltage':
        val = b.avg_voltage || 0;
        break;
      case 'current':
        val = b.avg_current || 0;
        break;
      case 'power_factor':
        val = b.avg_power_factor || 0;
        break;
      case 'frequency':
        val = b.avg_frequency || 0;
        break;
      case 'water_volume':
        val = b.water_l || 0;
        break;
      case 'water_flow':
        val = b.avg_water_flow || 0;
        break;
    }

    const d = new Date(b.bucket);
    let label = b.bucket;
    if (!isNaN(d.getTime())) {
      if (level === 'year') label = `${d.getFullYear()}`;
      else if (level === 'month') label = `T${d.getMonth() + 1}`;
      else if (level === 'day') label = `${d.getDate()}/${d.getMonth() + 1}`;
      else if (level === 'hour') label = `${d.getHours()}h`;
      else if (level === 'minute') label = `${d.getMinutes()}p`;
    }

    return {
      value: val,
      label,
      bucketKey: b.bucket,
      fullBucket: b,
    };
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Lịch sử đo đạc"
        subtitle={device ? `${device.name || device.code} (${device.code})` : ''}
        showBack
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Drilldown Picker Header */}
        <DrilldownPicker
          level={level}
          rangeLabel={formatRangeTitle(level, summaryData?.start, summaryData?.end)}
          onLevelChange={handleLevelTabSelect}
          onNavigateUp={handleNavigateUp}
          canNavigateUp={level !== 'year' || historyStack.length > 0}
        />

        {/* Metric Selector Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.metricScroll}
        >
          {METRIC_OPTIONS.map((opt) => {
            const isSelected = selectedMetric === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                style={[
                  styles.metricPill,
                  isSelected && {
                    backgroundColor: `${opt.color}25`,
                    borderColor: opt.color,
                  },
                ]}
                onPress={() => setSelectedMetric(opt.key)}
              >
                <Text
                  style={[
                    styles.metricPillText,
                    isSelected && { color: opt.color, fontWeight: '700' },
                  ]}
                >
                  {opt.label} {opt.unit ? `(${opt.unit})` : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Main Chart */}
        {loading && !refreshing ? (
          <LoadingState message="Đang xử lý dữ liệu biểu đồ..." />
        ) : (
          <View style={styles.chartWrapper}>
            <View style={styles.chartHeader}>
              <Text style={styles.chartTitle}>
                {currentMetricConfig.label} ({currentMetricConfig.unit})
              </Text>
              {level !== 'minute' && (
                <Text style={styles.drillHint}>Chạm vào cột để đào sâu</Text>
              )}
            </View>

            <MetricChart
              type={selectedMetric === 'power' || selectedMetric === 'water_flow' ? 'line' : 'bar'}
              data={chartData}
              unit={currentMetricConfig.unit}
              color={currentMetricConfig.color}
              height={220}
              onPointPress={(item) => {
                if (item.fullBucket) {
                  handleDrilldown(item.fullBucket);
                }
              }}
            />
          </View>
        )}

        {/* Breakdown Buckets Table */}
        {summaryData && summaryData.buckets.length > 0 && (
          <Card style={styles.tableCard} variant="elevated">
            <Text style={styles.tableTitle}>Chi tiết từng mốc thời gian</Text>

            {summaryData.buckets.map((b, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.tableRow}
                onPress={() => handleDrilldown(b)}
                disabled={level === 'minute'}
              >
                <View style={styles.tableColTime}>
                  <Text style={styles.timeText}>{formatDateTime(b.bucket)}</Text>
                  <Text style={styles.sampleCount}>{b.samples} mẫu đo</Text>
                </View>

                <View style={styles.tableColMetrics}>
                  <Text style={styles.metricValRow}>
                    Điện: <Text style={{ color: colors.primary, fontWeight: '700' }}>{formatEnergy(b.energy_kwh)}</Text>
                    {' • '}
                    CS TB: <Text style={{ color: colors.electric }}>{formatPower(b.avg_power)}</Text>
                  </Text>
                  <Text style={styles.metricValRow}>
                    Nước: <Text style={{ color: colors.water, fontWeight: '700' }}>{formatWaterVolume(b.water_l)}</Text>
                    {' • '}
                    Điện áp: {formatVoltage(b.avg_voltage)}
                  </Text>
                </View>

                {level !== 'minute' && (
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={colors.textMuted}
                  />
                )}
              </TouchableOpacity>
            ))}
          </Card>
        )}

        {/* Minute Level: Raw Telemetry Stream */}
        {level === 'minute' && (
          <Card style={styles.rawCard} elevated>
            <View style={styles.rawHeader}>
              <Text style={styles.rawTitle}>Bản tin Telemetry Raw ({rawTotal})</Text>
            </View>

            {rawTelemetry.map((item, idx) => (
              <View key={idx} style={styles.rawRow}>
                <View style={styles.rawTimeBox}>
                  <Text style={styles.rawTimeText}>
                    {formatTimeOnly(item.timestamp)}
                  </Text>
                  <Text style={styles.rawSecText}>
                    {new Date(item.timestamp).getSeconds()}s
                  </Text>
                </View>

                <View style={styles.rawMetricsBox}>
                  <Text style={styles.rawLine}>
                    {formatVoltage(item.voltage)} | {formatCurrent(item.current)} |{' '}
                    <Text style={{ color: colors.electric, fontWeight: '700' }}>
                      {formatPower(item.power)}
                    </Text>
                  </Text>
                  <Text style={styles.rawLineSub}>
                    Nước: {formatWaterFlow(item.water_flow_lpm)} | PF: {formatPowerFactor(item.power_factor)} | {formatFrequency(item.frequency)}
                  </Text>
                </View>
              </View>
            ))}

            {rawTelemetry.length < rawTotal && (
              <Button
                title="Tải thêm telemetry..."
                variant="outline"
                size="sm"
                loading={rawLoadingMore}
                onPress={loadMoreRaw}
                style={{ marginTop: spacing.md }}
              />
            )}
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  metricScroll: {
    marginBottom: spacing.md,
  },
  metricPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
  },
  metricPillText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  chartWrapper: {
    marginBottom: spacing.lg,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  chartTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  drillHint: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  tableCard: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  tableTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableColTime: {
    width: 130,
  },
  timeText: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  sampleCount: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
  },
  tableColMetrics: {
    flex: 1,
    paddingHorizontal: spacing.xs,
  },
  metricValRow: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 11,
  },
  rawCard: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    marginBottom: spacing.xxl,
  },
  rawHeader: {
    marginBottom: spacing.sm,
  },
  rawTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  rawRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs + 2,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  rawTimeBox: {
    width: 60,
  },
  rawTimeText: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  rawSecText: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
  },
  rawMetricsBox: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  rawLine: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  rawLineSub: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 10,
  },
});
