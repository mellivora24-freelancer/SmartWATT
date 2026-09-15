import React, { useCallback, useEffect, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { devicesApi } from '../../src/api/endpoints';
import {
  Device,
  ForecastResponse,
  SummaryResponse,
  TelemetryItem,
} from '../../src/api/types';
import {
  Badge,
  Button,
  Card,
  CostWidget,
  EmptyState,
  LoadingState,
  MetricCard,
  MetricChart,
  StatusBanner,
  WaterCostWidget,
} from '../../src/components';
import { useRealtime } from '../../src/realtime/RealtimeContext';
import { colors, radii, spacing, typography } from '../../src/theme';
import {
  formatCurrent,
  formatDateTime,
  formatEnergy,
  formatFrequency,
  formatPower,
  formatPowerFactor,
  formatVoltage,
  formatWaterFlow,
  formatWaterVolume,
} from '../../src/utils/format';

export default function HomeScreen() {
  const router = useRouter();
  const { isConnected, latestTelemetry, reconnect } = useRealtime();

  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [selectedChartMetric, setSelectedChartMetric] = useState<
    'power' | 'energy' | 'water'
  >('power');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const devList = await devicesApi.list();
      setDevices(devList);

      if (devList.length > 0) {
        setSelectedDevice((prev) => {
          const current = prev ? devList.find((d) => d.id === prev.id) || devList[0] : devList[0];
          
          // Fetch forecast and summary for the active device
          Promise.allSettled([
            devicesApi.getForecast(current.id),
            devicesApi.getSummary(current.id, { level: 'hour' }),
          ]).then(([forecastRes, summaryRes]) => {
            if (forecastRes.status === 'fulfilled') {
              setForecast(forecastRes.value);
            }
            if (summaryRes.status === 'fulfilled') {
              setSummary(summaryRes.value);
            }
          });

          return current;
        });
      } else {
        setSelectedDevice(null);
        setForecast(null);
        setSummary(null);
      }
    } catch {
      // Handled via offline banner
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleSelectDevice = (dev: Device) => {
    setSelectedDevice(dev);
    setLoading(true);
    Promise.allSettled([
      devicesApi.getForecast(dev.id),
      devicesApi.getSummary(dev.id, { level: 'hour' }),
    ]).then(([forecastRes, summaryRes]) => {
      if (forecastRes.status === 'fulfilled') setForecast(forecastRes.value);
      if (summaryRes.status === 'fulfilled') setSummary(summaryRes.value);
      setLoading(false);
    });
  };

  // Get current live telemetry for selected device (realtime WS prioritized, fallback to latest_telemetry)
  const activeTelemetry: TelemetryItem | undefined = selectedDevice
    ? latestTelemetry[selectedDevice.id] || selectedDevice.latest_telemetry || undefined
    : undefined;

  const isOnline = activeTelemetry?.timestamp
    ? Date.now() - new Date(activeTelemetry.timestamp).getTime() < 60000
    : false;

  // Format 24h summary data for chart
  const chartData = (summary?.buckets || []).map((b) => {
    const d = new Date(b.bucket);
    const hourLabel = isNaN(d.getTime()) ? b.bucket.slice(11, 16) : `${d.getHours()}h`;

    let val = 0;
    if (selectedChartMetric === 'power') {
      val = b.avg_power || 0;
    } else if (selectedChartMetric === 'energy') {
      val = b.energy_kwh || 0;
    } else if (selectedChartMetric === 'water') {
      val = b.water_l || 0;
    }

    return {
      value: val,
      label: hourLabel,
      bucketKey: b.bucket,
    };
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* App Header */}
      <View style={styles.topHeader}>
        <View style={styles.headerLeft}>
          <View style={styles.brandIcon}>
            <Ionicons name="flash" size={20} color={colors.primary} />
          </View>
          <View>
            <Text style={styles.headerTitle}>SmartWatt</Text>
            <Text style={styles.headerSubtitle}>
              {isConnected ? 'Realtime Connected' : 'Đang thử kết nối...'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.chatButton}
          onPress={() =>
            router.push({
              pathname: '/chat',
              params: { deviceId: selectedDevice?.id },
            })
          }
          activeOpacity={0.8}
        >
          <Ionicons name="sparkles" size={16} color={colors.primary} />
          <Text style={styles.chatButtonText}>AI Chat</Text>
        </TouchableOpacity>
      </View>

      <StatusBanner connected={isConnected} onReconnect={reconnect} />

      {loading && !refreshing ? (
        <LoadingState message="Đang nạp dữ liệu năng lượng..." />
      ) : devices.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            icon="hardware-chip-outline"
            title="Chưa có thiết bị nào"
            description="Hãy thêm mã thiết bị SmartWatt (ví dụ SW-001) để bắt đầu giám sát dòng điện và nước."
            actionTitle="Thêm thiết bị"
            onAction={() => router.push('/devices')}
          />
        </View>
      ) : (
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
          {/* Device Selector Pill Carousel */}
          {devices.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.deviceSelectorRow}
            >
              {devices.map((dev) => {
                const isSelected = selectedDevice?.id === dev.id;
                return (
                  <TouchableOpacity
                    key={dev.id}
                    style={[
                      styles.devicePill,
                      isSelected && styles.devicePillActive,
                    ]}
                    onPress={() => handleSelectDevice(dev)}
                  >
                    <Ionicons
                      name="hardware-chip-outline"
                      size={14}
                      color={isSelected ? colors.primary : colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.devicePillText,
                        isSelected && styles.devicePillTextActive,
                      ]}
                    >
                      {dev.name || dev.code}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {/* Active Device Info Bar */}
          {selectedDevice && (
            <View style={styles.deviceMetaBar}>
              <View style={styles.deviceInfoLeft}>
                <View style={styles.deviceNameRow}>
                  <Text style={styles.deviceName}>
                    {selectedDevice.name || selectedDevice.code}
                  </Text>
                  <Badge
                    label={
                      isOnline
                        ? 'Trực tuyến'
                        : activeTelemetry
                        ? 'Ngoại tuyến'
                        : 'Chưa có dữ liệu'
                    }
                    variant={isOnline ? 'normal' : activeTelemetry ? 'danger' : 'default'}
                    size="sm"
                  />
                </View>
                <Text style={styles.deviceCodeLocation}>
                  Mã: {selectedDevice.code}
                  {selectedDevice.location ? ` • ${selectedDevice.location}` : ''}
                </Text>
              </View>
              {activeTelemetry?.timestamp && (
                <Text style={styles.telemetryTime}>
                  Cập nhật: {formatDateTime(activeTelemetry.timestamp)}
                </Text>
              )}
            </View>
          )}

          {/* Electricity Month Forecast & Water Widgets */}
          <CostWidget forecast={forecast} />
          <WaterCostWidget forecast={forecast} />

          {/* Live Metric Cards Grid */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Chỉ số tức thời</Text>
            <TouchableOpacity
              onPress={() =>
                selectedDevice &&
                router.push({
                  pathname: '/device/[id]/history',
                  params: { id: selectedDevice.id },
                })
              }
            >
              <Text style={styles.sectionLink}>Lịch sử chi tiết &rarr;</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.metricsGrid}>
            <View style={styles.metricRow}>
              <MetricCard
                label="Điện áp"
                valueString={formatVoltage(activeTelemetry?.voltage)}
                rawValue={activeTelemetry?.voltage}
                minThreshold={selectedDevice?.min_voltage}
                maxThreshold={selectedDevice?.max_voltage}
                icon="speedometer-outline"
                accentColor={colors.primary}
              />
              <View style={{ width: spacing.md }} />
              <MetricCard
                label="Dòng điện"
                valueString={formatCurrent(activeTelemetry?.current)}
                rawValue={activeTelemetry?.current}
                minThreshold={selectedDevice?.min_current}
                maxThreshold={selectedDevice?.max_current}
                icon="pulse-outline"
                accentColor={colors.electric}
              />
            </View>

            <View style={styles.metricRow}>
              <MetricCard
                label="Công suất"
                valueString={formatPower(activeTelemetry?.power)}
                rawValue={activeTelemetry?.power}
                minThreshold={selectedDevice?.min_power}
                maxThreshold={selectedDevice?.max_power}
                icon="flash-outline"
                accentColor={colors.warning}
              />
              <View style={{ width: spacing.md }} />
              <MetricCard
                label="Lưu lượng nước"
                valueString={formatWaterFlow(activeTelemetry?.water_flow_lpm)}
                rawValue={activeTelemetry?.water_flow_lpm}
                minThreshold={selectedDevice?.min_water_flow}
                maxThreshold={selectedDevice?.max_water_flow}
                icon="water-outline"
                accentColor={colors.water}
              />
            </View>

            <View style={styles.metricRow}>
              <MetricCard
                label="Hệ số CS (PF)"
                valueString={formatPowerFactor(activeTelemetry?.power_factor)}
                rawValue={activeTelemetry?.power_factor}
                minThreshold={selectedDevice?.min_power_factor}
                maxThreshold={selectedDevice?.max_power_factor}
                icon="git-commit-outline"
                accentColor={colors.secondary}
              />
              <View style={{ width: spacing.md }} />
              <MetricCard
                label="Tần số"
                valueString={formatFrequency(activeTelemetry?.frequency)}
                rawValue={activeTelemetry?.frequency}
                minThreshold={selectedDevice?.min_frequency}
                maxThreshold={selectedDevice?.max_frequency}
                icon="analytics-outline"
                accentColor={colors.primary}
              />
            </View>
          </View>

          {/* Cumulative Counters Card */}
          <Card style={styles.cumulativeCard} variant="elevated">
            <Text style={styles.cumulativeTitle}>
              Tổng tích lũy counter trên thiết bị
            </Text>
            <View style={styles.cumulativeRow}>
              <View style={styles.cumulativeCol}>
                <View style={styles.cumulativeIconBoxElectric}>
                  <Ionicons name="flash" size={16} color={colors.electric} />
                </View>
                <View>
                  <Text style={styles.cumulativeLabel}>Tổng điện tích lũy</Text>
                  <Text style={styles.cumulativeValue}>
                    {formatEnergy(activeTelemetry?.energy_total)}
                  </Text>
                </View>
              </View>

              <View style={styles.cumulativeDivider} />

              <View style={styles.cumulativeCol}>
                <View style={styles.cumulativeIconBoxWater}>
                  <Ionicons name="water" size={16} color={colors.water} />
                </View>
                <View>
                  <Text style={styles.cumulativeLabel}>Tổng nước tích lũy</Text>
                  <Text style={styles.cumulativeValue}>
                    {formatWaterVolume(activeTelemetry?.water_total_l)}
                  </Text>
                </View>
              </View>
            </View>
          </Card>

          {/* 24h Hourly Quick Chart */}
          <View style={styles.chartSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Biểu đồ 24 giờ qua</Text>
              {/* Metric Switcher */}
              <View style={styles.chartToggle}>
                <TouchableOpacity
                  style={[
                    styles.toggleBtn,
                    selectedChartMetric === 'power' && styles.toggleBtnActive,
                  ]}
                  onPress={() => setSelectedChartMetric('power')}
                >
                  <Text
                    style={[
                      styles.toggleBtnText,
                      selectedChartMetric === 'power' &&
                        styles.toggleBtnTextActive,
                    ]}
                  >
                    Công suất
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.toggleBtn,
                    selectedChartMetric === 'energy' && styles.toggleBtnActive,
                  ]}
                  onPress={() => setSelectedChartMetric('energy')}
                >
                  <Text
                    style={[
                      styles.toggleBtnText,
                      selectedChartMetric === 'energy' &&
                        styles.toggleBtnTextActive,
                    ]}
                  >
                    Điện kWh
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.toggleBtn,
                    selectedChartMetric === 'water' && styles.toggleBtnActive,
                  ]}
                  onPress={() => setSelectedChartMetric('water')}
                >
                  <Text
                    style={[
                      styles.toggleBtnText,
                      selectedChartMetric === 'water' &&
                        styles.toggleBtnTextActive,
                    ]}
                  >
                    Nước L
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <MetricChart
              type="bar"
              data={chartData}
              unit={
                selectedChartMetric === 'power'
                  ? 'W'
                  : selectedChartMetric === 'energy'
                  ? 'kWh'
                  : 'L'
              }
              color={
                selectedChartMetric === 'power'
                  ? colors.electric
                  : selectedChartMetric === 'energy'
                  ? colors.primary
                  : colors.water
              }
              height={180}
              onPointPress={(item) => {
                if (selectedDevice) {
                  router.push({
                    pathname: '/device/[id]/history',
                    params: { id: selectedDevice.id },
                  });
                }
              }}
            />
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: colors.primarySubtle,
    borderWidth: 1,
    borderColor: colors.borderHighlight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    fontWeight: '800',
  },
  headerSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 10,
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySubtle,
    borderWidth: 1,
    borderColor: colors.borderHighlight,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  chatButtonText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
    marginLeft: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  deviceSelectorRow: {
    marginBottom: spacing.md,
  },
  devicePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    marginRight: spacing.sm,
  },
  devicePillActive: {
    backgroundColor: colors.primarySubtle,
    borderColor: colors.primary,
  },
  devicePillText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginLeft: 6,
    fontWeight: '500',
  },
  devicePillTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  deviceMetaBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.lg,
  },
  deviceInfoLeft: {
    flex: 1,
  },
  deviceNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  deviceName: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  deviceCodeLocation: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 1,
  },
  telemetryTime: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  sectionLink: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
  },
  metricsGrid: {
    marginBottom: spacing.lg,
  },
  metricRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  cumulativeCard: {
    padding: spacing.md,
    marginBottom: spacing.xl,
    backgroundColor: colors.surface,
    borderColor: colors.borderLight,
  },
  cumulativeTitle: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
  },
  cumulativeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cumulativeCol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cumulativeIconBoxElectric: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    backgroundColor: colors.electricSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  cumulativeIconBoxWater: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    backgroundColor: colors.waterSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  cumulativeLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
  },
  cumulativeValue: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  cumulativeDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  chartSection: {
    marginBottom: spacing.xxl,
  },
  chartToggle: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radii.sm,
    padding: 2,
  },
  toggleBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.xs,
  },
  toggleBtnActive: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  toggleBtnText: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
  },
  toggleBtnTextActive: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
});
