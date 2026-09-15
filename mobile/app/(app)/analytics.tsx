import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { analyticsApi, devicesApi } from '../../src/api/endpoints';
import {
  BaselineResponse,
  DeviationResponse,
  Device,
  ThresholdSuggestionItem,
  ThresholdSuggestionsResponse,
} from '../../src/api/types';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Header,
  LoadingState,
  MetricChart,
} from '../../src/components';
import { colors, radii, spacing, typography } from '../../src/theme';
import {
  formatPower,
  formatWaterFlow,
} from '../../src/utils/format';

type AnalyticsTab = 'suggestions' | 'deviation' | 'baseline';

export default function AnalyticsScreen() {
  const router = useRouter();

  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('suggestions');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Suggestions state
  const [suggestionsData, setSuggestionsData] =
    useState<ThresholdSuggestionsResponse | null>(null);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [applying, setApplying] = useState(false);

  // Deviation state
  const [deviationData, setDeviationData] = useState<DeviationResponse | null>(null);

  // Baseline state
  const [baselineData, setBaselineData] = useState<BaselineResponse | null>(null);
  const [selectedWeekday, setSelectedWeekday] = useState<number>(1); // Monday default

  const loadData = useCallback(async () => {
    try {
      const devList = await devicesApi.list();
      setDevices(devList);

      const target = selectedDevice
        ? devList.find((d) => d.id === selectedDevice.id) || devList[0]
        : devList[0];

      if (target) {
        setSelectedDevice(target);
        const [sugRes, devRes, baseRes] = await Promise.allSettled([
          analyticsApi.getThresholdSuggestions(target.id),
          analyticsApi.getDeviation(target.id),
          analyticsApi.getBaseline(target.id),
        ]);

        if (sugRes.status === 'fulfilled') {
          setSuggestionsData(sugRes.value);
          // Pre-select all suggestions that need tuning
          const toSelect = (sugRes.value.suggestions || [])
            .filter(
              (s) =>
                s.status === 'too_tight' ||
                s.status === 'too_loose' ||
                s.status === 'missing'
            )
            .map((s) => s.column);
          setSelectedColumns(toSelect);
        }
        if (devRes.status === 'fulfilled') {
          setDeviationData(devRes.value);
        }
        if (baseRes.status === 'fulfilled') {
          setBaselineData(baseRes.value);
        }
      }
    } catch {
      // Ignored
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDevice]);

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleDeviceChange = (dev: Device) => {
    setSelectedDevice(dev);
    setLoading(true);
    loadData();
  };

  const toggleColumnSelection = (column: string) => {
    setSelectedColumns((prev) =>
      prev.includes(column) ? prev.filter((c) => c !== column) : [...prev, column]
    );
  };

  const handleApplySuggestions = async () => {
    if (!selectedDevice || selectedColumns.length === 0) return;

    try {
      setApplying(true);
      const res = await analyticsApi.applyThresholdSuggestions(
        selectedDevice.id,
        selectedColumns
      );
      Alert.alert(
        'Thành công',
        `Đã áp dụng tự động ${res.applied.length} ngưỡng vào cấu hình thiết bị!`
      );
      loadData();
    } catch (err: any) {
      Alert.alert('Lỗi', err?.detail || 'Không thể áp dụng ngưỡng');
    } finally {
      setApplying(false);
    }
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title="Trung tâm Phân tích" />
        <LoadingState message="Đang nạp phân tích năng lượng..." />
      </SafeAreaView>
    );
  }

  if (devices.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title="Trung tâm Phân tích" />
        <View style={styles.emptyWrap}>
          <EmptyState
            icon="analytics-outline"
            title="Chưa có thiết bị nào"
            description="Hãy thêm thiết bị SmartWatt vào tài khoản để mở khóa phân tích."
          />
        </View>
      </SafeAreaView>
    );
  }

  // Format Deviation 24h chart
  const deviationChartData = (deviationData?.hours || []).map((h) => {
    const isAbnormal =
      deviationData?.power_abnormal_hours?.includes(h.hour) || false;
    return {
      value: h.power_actual || 0,
      label: `${h.hour}h`,
      frontColor: isAbnormal ? colors.danger : colors.primary,
    };
  });

  // Filter baseline cells for selected weekday
  const filteredBaselineCells = (baselineData?.cells || []).filter(
    (c) => c.weekday === selectedWeekday
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Phân tích & Tối ưu"
        subtitle={
          selectedDevice
            ? `${selectedDevice.name || selectedDevice.code} (${selectedDevice.code})`
            : ''
        }
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
        {/* Device Switcher */}
        {devices.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.deviceSelector}
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
                  onPress={() => handleDeviceChange(dev)}
                >
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

        {/* Quick Link to Water Leak */}
        {selectedDevice && (
          <TouchableOpacity
            style={styles.leakBanner}
            onPress={() =>
              router.push({
                pathname: '/device/[id]/leak',
                params: { id: selectedDevice.id },
              })
            }
            activeOpacity={0.8}
          >
            <View style={styles.leakLeft}>
              <View style={styles.leakIconCircle}>
                <Ionicons name="water" size={18} color={colors.water} />
              </View>
              <View>
                <Text style={styles.leakTitle}>Phân tích Rò rỉ Nước Ban đêm</Text>
                <Text style={styles.leakDesc}>
                  Xem chi tiết 14 đêm đo đạc và thuật toán phát hiện rò rỉ
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        )}

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[
              styles.tabBtn,
              activeTab === 'suggestions' && styles.tabBtnActive,
            ]}
            onPress={() => setActiveTab('suggestions')}
          >
            <Text
              style={[
                styles.tabBtnText,
                activeTab === 'suggestions' && styles.tabBtnTextActive,
              ]}
            >
              Đề xuất ngưỡng
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabBtn,
              activeTab === 'deviation' && styles.tabBtnActive,
            ]}
            onPress={() => setActiveTab('deviation')}
          >
            <Text
              style={[
                styles.tabBtnText,
                activeTab === 'deviation' && styles.tabBtnTextActive,
              ]}
            >
              Bất thường 24h
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabBtn,
              activeTab === 'baseline' && styles.tabBtnActive,
            ]}
            onPress={() => setActiveTab('baseline')}
          >
            <Text
              style={[
                styles.tabBtnText,
                activeTab === 'baseline' && styles.tabBtnTextActive,
              ]}
            >
              Baseline Tuần
            </Text>
          </TouchableOpacity>
        </View>

        {/* TAB 1: THRESHOLD AUTO-TUNING SUGGESTIONS */}
        {activeTab === 'suggestions' && (
          <View>
            <Card style={styles.sectionCard} elevated>
              <View style={styles.sugHeader}>
                <Text style={styles.sectionTitle}>Tối ưu hóa ngưỡng tự động</Text>
                <Text style={styles.sugDesc}>
                  Hệ thống phân tích phân vị thống kê (99th/1st percentile) từ {suggestionsData?.samples || 0} mẫu đo để đề xuất ngưỡng an toàn nhất.
                </Text>
              </View>

              {suggestionsData?.ready ? (
                <View>
                  {suggestionsData.suggestions.map((sug: ThresholdSuggestionItem, idx: number) => {
                    const isSelected = selectedColumns.includes(sug.column);
                    const isNeedTune =
                      sug.status === 'too_tight' ||
                      sug.status === 'too_loose' ||
                      sug.status === 'missing';

                    let statusVariant: any = 'normal';
                    let statusLabel = 'Hợp lý (OK)';
                    if (sug.status === 'too_tight') {
                      statusVariant = 'danger';
                      statusLabel = 'Quá chặt (Dễ báo ảo)';
                    } else if (sug.status === 'too_loose') {
                      statusVariant = 'warning';
                      statusLabel = 'Quá lỏng';
                    } else if (sug.status === 'missing') {
                      statusVariant = 'warning';
                      statusLabel = 'Chưa đặt';
                    } else if (sug.status === 'insufficient_data') {
                      statusVariant = 'default';
                      statusLabel = 'Chưa đủ mẫu';
                    }

                    return (
                      <TouchableOpacity
                        key={idx}
                        style={[
                          styles.sugItem,
                          isSelected && styles.sugItemSelected,
                        ]}
                        onPress={() =>
                          sug.suggested_value !== null &&
                          toggleColumnSelection(sug.column)
                        }
                        activeOpacity={0.7}
                      >
                        <View style={styles.sugCheckbox}>
                          <Ionicons
                            name={
                              isSelected
                                ? 'checkbox'
                                : 'square-outline'
                            }
                            size={20}
                            color={isSelected ? colors.primary : colors.textMuted}
                          />
                        </View>

                        <View style={styles.sugContent}>
                          <View style={styles.sugTopRow}>
                            <Text style={styles.sugMetricName}>
                              {sug.column} ({sug.direction === 'max' ? 'Ngưỡng trên' : 'Ngưỡng dưới'})
                            </Text>
                            <Badge
                              label={statusLabel}
                              variant={statusVariant}
                              size="sm"
                            />
                          </View>

                          <View style={styles.sugValuesRow}>
                            <Text style={styles.sugValLabel}>
                              Hiện tại:{' '}
                              <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>
                                {sug.current_value !== null ? sug.current_value : 'Chưa đặt'}
                              </Text>
                            </Text>
                            <Ionicons
                              name="arrow-forward"
                              size={12}
                              color={colors.textSecondary}
                              style={{ marginHorizontal: 6 }}
                            />
                            <Text style={styles.sugValLabel}>
                              Đề xuất:{' '}
                              <Text style={{ color: colors.primary, fontWeight: '700' }}>
                                {sug.suggested_value !== null ? sug.suggested_value : '--'}
                              </Text>
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}

                  <Button
                    title={`Áp dụng ${selectedColumns.length} ngưỡng đã chọn`}
                    variant="primary"
                    size="lg"
                    loading={applying}
                    disabled={selectedColumns.length === 0}
                    onPress={handleApplySuggestions}
                    style={{ marginTop: spacing.md }}
                  />
                </View>
              ) : (
                <View style={styles.insufficientBox}>
                  <Ionicons name="time-outline" size={24} color={colors.warning} />
                  <Text style={styles.insufficientText}>
                    Cần tối thiểu 200 mẫu đo telemetry để sinh đề xuất tối ưu ngưỡng chính xác.
                  </Text>
                </View>
              )}
            </Card>
          </View>
        )}

        {/* TAB 2: DAILY DEVIATION */}
        {activeTab === 'deviation' && (
          <View>
            <Card style={styles.sectionCard} elevated>
              <Text style={styles.sectionTitle}>Phát hiện Bất thường Tiêu thụ</Text>
              <Text style={styles.sugDesc}>
                So sánh công suất từng giờ hôm nay với mô hình baseline bằng Z-score. Các giờ màu đỏ là giờ tiêu thụ cao đột biến.
              </Text>

              {deviationData?.ready ? (
                <View style={{ marginTop: spacing.md }}>
                  <MetricChart
                    type="bar"
                    data={deviationChartData}
                    unit="W"
                    color={colors.primary}
                    height={200}
                  />

                  {deviationData.power_abnormal_hours &&
                  deviationData.power_abnormal_hours.length > 0 ? (
                    <View style={styles.abnormalAlert}>
                      <Ionicons name="warning" size={18} color={colors.danger} />
                      <Text style={styles.abnormalText}>
                        Phát hiện tiêu thụ điện vượt chuẩn vào các khung giờ:{' '}
                        {deviationData.power_abnormal_hours.map((h) => `${h}h`).join(', ')}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.normalAlert}>
                      <Ionicons name="checkmark-circle" size={18} color={colors.normal} />
                      <Text style={styles.normalText}>
                        Công suất tiêu thụ hôm nay dao động hoàn toàn bình thường so với baseline.
                      </Text>
                    </View>
                  )}
                </View>
              ) : (
                <View style={styles.insufficientBox}>
                  <Ionicons name="analytics-outline" size={24} color={colors.warning} />
                  <Text style={styles.insufficientText}>
                    Chưa có đủ số ngày đo để thiết lập baseline so sánh độ lệch.
                  </Text>
                </View>
              )}
            </Card>
          </View>
        )}

        {/* TAB 3: WEEKLY BASELINE PROFILE */}
        {activeTab === 'baseline' && (
          <View>
            <Card style={styles.sectionCard} elevated>
              <Text style={styles.sectionTitle}>Mô hình Tiêu thụ Chuẩn (Baseline)</Text>
              <Text style={styles.sugDesc}>
                Phân tích mức trung vị công suất & lưu lượng nước cho 24 giờ của từng ngày trong tuần.
              </Text>

              {/* Weekday selector */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.weekdayScroll}
              >
                {[
                  { id: 1, label: 'Thứ 2' },
                  { id: 2, label: 'Thứ 3' },
                  { id: 3, label: 'Thứ 4' },
                  { id: 4, label: 'Thứ 5' },
                  { id: 5, label: 'Thứ 6' },
                  { id: 6, label: 'Thứ 7' },
                  { id: 0, label: 'Chủ nhật' },
                ].map((wd) => {
                  const isSel = selectedWeekday === wd.id;
                  return (
                    <TouchableOpacity
                      key={wd.id}
                      style={[
                        styles.weekdayPill,
                        isSel && styles.weekdayPillActive,
                      ]}
                      onPress={() => setSelectedWeekday(wd.id)}
                    >
                      <Text
                        style={[
                          styles.weekdayPillText,
                          isSel && styles.weekdayPillTextActive,
                        ]}
                      >
                        {wd.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Hourly Grid list */}
              {filteredBaselineCells.map((cell, idx) => (
                <View key={idx} style={styles.baselineHourRow}>
                  <View style={styles.hourCol}>
                    <Text style={styles.hourText}>{cell.hour}:00 - {cell.hour + 1}:00</Text>
                  </View>

                  <View style={styles.hourMetricsCol}>
                    <Text style={styles.hourMetricVal}>
                      Điện: <Text style={{ color: colors.electric, fontWeight: '700' }}>{formatPower(cell.power_center)}</Text>
                    </Text>
                    <Text style={styles.hourMetricVal}>
                      Nước: <Text style={{ color: colors.water, fontWeight: '700' }}>{formatWaterFlow(cell.water_center)}</Text>
                    </Text>
                  </View>

                  <Badge
                    label={cell.ready ? `${cell.sample_days} ngày` : 'Chưa đủ'}
                    variant={cell.ready ? 'normal' : 'default'}
                    size="sm"
                  />
                </View>
              ))}
            </Card>
          </View>
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
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  deviceSelector: {
    marginBottom: spacing.md,
  },
  devicePill: {
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
    fontWeight: '500',
  },
  devicePillTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  leakBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.water,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  leakLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  leakIconCircle: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: colors.waterSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  leakTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  leakDesc: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radii.md,
    padding: 2,
    marginBottom: spacing.lg,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radii.sm,
  },
  tabBtnActive: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  tabBtnText: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '600',
  },
  tabBtnTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  sugHeader: {
    marginBottom: spacing.md,
  },
  sugDesc: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 3,
  },
  sugItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  sugItemSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceElevated,
  },
  sugCheckbox: {
    marginRight: spacing.sm,
  },
  sugContent: {
    flex: 1,
  },
  sugTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sugMetricName: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  sugValuesRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sugValLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  insufficientBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warningSubtle,
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  insufficientText: {
    ...typography.bodySmall,
    color: colors.warningText,
    marginLeft: spacing.sm,
    flex: 1,
  },
  abnormalAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dangerSubtle,
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  abnormalText: {
    ...typography.bodySmall,
    color: colors.dangerText,
    marginLeft: spacing.sm,
    flex: 1,
  },
  normalAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.normalSubtle,
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  normalText: {
    ...typography.bodySmall,
    color: colors.normalText,
    marginLeft: spacing.sm,
    flex: 1,
  },
  weekdayScroll: {
    marginVertical: spacing.md,
  },
  weekdayPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
  },
  weekdayPillActive: {
    backgroundColor: colors.primarySubtle,
    borderColor: colors.primary,
  },
  weekdayPillText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  weekdayPillTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  baselineHourRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs + 2,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  hourCol: {
    width: 100,
  },
  hourText: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  hourMetricsCol: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  hourMetricVal: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
