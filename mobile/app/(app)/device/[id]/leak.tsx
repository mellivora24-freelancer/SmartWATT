import React, { useCallback, useEffect, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { analyticsApi, devicesApi } from '../../../../src/api/endpoints';
import { Device, WaterLeakResponse } from '../../../../src/api/types';
import {
  Badge,
  Card,
  Header,
  LoadingState,
} from '../../../../src/components';
import { useRealtime } from '../../../../src/realtime/RealtimeContext';
import { colors, radii, spacing, typography } from '../../../../src/theme';
import {
  formatDateTime,
  formatWaterFlow,
  formatWaterVolume,
} from '../../../../src/utils/format';

export default function WaterLeakScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const deviceId = parseInt(id, 10);

  const { latestTelemetry, isConnected } = useRealtime();
  const [device, setDevice] = useState<Device | null>(null);
  const [data, setData] = useState<WaterLeakResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadLeakData = useCallback(async () => {
    if (!deviceId) return;
    try {
      const [dev, leakRes] = await Promise.all([
        devicesApi.get(deviceId),
        analyticsApi.getWaterLeak(deviceId, 14),
      ]);
      setDevice(dev);
      setData(leakRes);
    } catch {
      // Handled
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [deviceId]);

  useEffect(() => {
    loadLeakData();
  }, [loadLeakData]);

  useFocusEffect(
    useCallback(() => {
      loadLeakData();
    }, [loadLeakData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadLeakData();
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title="Phát hiện rò rỉ nước" showBack />
        <LoadingState message="Đang phân tích lưu lượng nước ban đêm..." />
      </SafeAreaView>
    );
  }

  const isLeak = data?.status === 'leak_suspected';
  const isOk = data?.status === 'ok';

  const live = latestTelemetry[deviceId] || device?.latest_telemetry;
  const liveWaterFlow =
    live?.water_flow_lpm !== undefined
      ? live.water_flow_lpm
      : data?.current?.water_flow_lpm ?? 0;
  const isFlowingNow = (liveWaterFlow ?? 0) > 0.05;
  const liveTimestamp = live?.timestamp || data?.current?.timestamp;
  const liveTotalWater = live?.water_total_l;

  const currentHour = new Date().getHours();
  const startHour = data?.window?.start_hour ?? 0;
  const endHour = data?.window?.end_hour ?? 5;
  const inNightWindow = currentHour >= startHour && currentHour < endHour;

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Phát hiện rò rỉ nước"
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
            tintColor={colors.water}
          />
        }
      >
        {/* Status Overview Card */}
        <Card
          style={[
            styles.statusCard,
            {
              backgroundColor: isLeak
                ? colors.dangerSubtle
                : isOk
                ? colors.surface
                : colors.surfaceSubtle,
              borderColor: isLeak
                ? colors.danger
                : isOk
                ? colors.normal
                : colors.border,
            },
          ]}
          elevated
        >
          <View style={styles.statusHeader}>
            <View
              style={[
                styles.statusIconBox,
                {
                  backgroundColor: isLeak
                    ? colors.danger
                    : isOk
                    ? colors.normalSubtle
                    : colors.surfaceElevated,
                },
              ]}
            >
              <Ionicons
                name={isLeak ? 'warning' : isOk ? 'shield-checkmark' : 'help-circle'}
                size={28}
                color={isLeak ? '#FFFFFF' : isOk ? colors.normal : colors.textSecondary}
              />
            </View>

            <View style={styles.statusMeta}>
              <Text style={styles.statusTitle}>
                {isLeak
                  ? 'CẢNH BÁO: Nghi ngờ rò rỉ nước'
                  : isOk
                  ? 'Hệ thống nước an toàn'
                  : 'Chưa đủ dữ liệu baseline'}
              </Text>
              <Text style={styles.statusDesc}>
                {isLeak
                  ? 'Phát hiện nước chảy liên tục hoặc lưu lượng bất thường trong khung giờ ban đêm.'
                  : isOk
                  ? 'Không phát hiện hiện tượng rò rỉ hoặc dòng chảy ngầm trong 14 đêm gần nhất.'
                  : 'Cần tích lũy thêm tối thiểu 3 đêm dữ liệu để xây dựng baseline lưu lượng chuẩn.'}
              </Text>
            </View>
          </View>
        </Card>

        {/* Current State Live Window */}
        <Card style={styles.currentCard} variant="subtle">
          <View style={styles.currentHeader}>
            <Text style={styles.currentTitle}>Trạng thái hiện tại</Text>
            {inNightWindow && (
              <Badge
                label={`Khung giờ đêm (${startHour}h-${endHour}h)`}
                variant="info"
                size="sm"
              />
            )}
          </View>

          <View style={styles.currentRow}>
            <View style={styles.currentCol}>
              <Text style={styles.currentLabel}>Lưu lượng hiện tại</Text>
              <Text style={styles.currentVal}>
                {formatWaterFlow(liveWaterFlow)}
              </Text>
            </View>

            <View style={styles.currentDivider} />

            <View style={styles.currentCol}>
              <Text style={styles.currentLabel}>Dòng chảy</Text>
              <Badge
                label={isFlowingNow ? 'Đang chảy nước' : 'Đang ngắt nước'}
                variant={isFlowingNow ? 'warning' : 'normal'}
              />
            </View>
          </View>

          {liveTimestamp && (
            <Text style={styles.currentTime}>
              Cập nhật: {formatDateTime(liveTimestamp)}
            </Text>
          )}
        </Card>

        {/* Baseline Info */}
        <Card style={styles.baselineCard} elevated>
          <Text style={styles.sectionTitle}>Thông số Baseline ban đêm</Text>
          <Text style={styles.baselineDesc}>
            Khung giờ giám sát: {data?.window.start_hour}h:00 - {data?.window.end_hour}h:00 hàng đêm.
          </Text>

          <View style={styles.baselineGrid}>
            <View style={styles.baselineItem}>
              <Text style={styles.baselineLabel}>Số đêm phân tích</Text>
              <Text style={styles.baselineVal}>
                {data?.baseline.nights || 0} / {data?.baseline.min_nights || 3} đêm
              </Text>
            </View>

            <View style={styles.baselineItem}>
              <Text style={styles.baselineLabel}>Lượng nước trung vị đêm</Text>
              <Text style={styles.baselineVal}>
                {formatWaterVolume(data?.baseline.median_volume_l)}
              </Text>
            </View>

            <View style={styles.baselineItem}>
              <Text style={styles.baselineLabel}>Ngưỡng bùng phát (Burst)</Text>
              <Text style={[styles.baselineVal, { color: colors.danger }]}>
                {formatWaterVolume(data?.baseline.threshold_volume_l)}
              </Text>
            </View>
          </View>
        </Card>

        {/* Nightly History Table */}
        <View style={styles.historySection}>
          <Text style={styles.sectionTitle}>Lịch sử từng đêm (14 ngày qua)</Text>

          {data?.nights.map((night, idx) => {
            const isNightLeak =
              night.verdict === 'leak_continuous' || night.verdict === 'leak_burst';
            const isNightNormal = night.verdict === 'normal';

            return (
              <Card
                key={idx}
                style={[
                  styles.nightCard,
                  isNightLeak && {
                    borderColor: colors.danger,
                    backgroundColor: colors.dangerSubtle,
                  },
                ]}
                variant={isNightLeak ? 'default' : 'subtle'}
              >
                <View style={styles.nightHeader}>
                  <View style={styles.nightDateRow}>
                    <Ionicons name="moon-outline" size={16} color={colors.water} />
                    <Text style={styles.nightDateText}>Đêm {night.night}</Text>
                  </View>

                  <Badge
                    label={
                      isNightLeak
                        ? night.verdict === 'leak_continuous'
                          ? 'Chảy liên tục'
                          : 'Bùng phát lưu lượng'
                        : isNightNormal
                        ? 'Bình thường'
                        : 'Thiếu mẫu'
                    }
                    variant={
                      isNightLeak ? 'danger' : isNightNormal ? 'normal' : 'default'
                    }
                    size="sm"
                  />
                </View>

                <View style={styles.nightStats}>
                  <Text style={styles.nightStatItem}>
                    Tổng: <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>{formatWaterVolume(night.volume_l)}</Text>
                  </Text>
                  <Text style={styles.nightStatItem}>
                    Tỷ lệ chảy: <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>{(night.flowing_ratio * 100).toFixed(0)}%</Text>
                  </Text>
                  <Text style={styles.nightStatItem}>
                    Đỉnh: <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>{formatWaterFlow(night.max_flow_lpm)}</Text>
                  </Text>
                </View>

                <Text style={styles.nightReasonText}>{night.reason}</Text>
              </Card>
            );
          })}
        </View>
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
  statusCard: {
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIconBox: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  statusMeta: {
    flex: 1,
  },
  statusTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    fontWeight: '800',
  },
  statusDesc: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 3,
  },
  currentCard: {
    padding: spacing.md,
    backgroundColor: colors.surfaceSubtle,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  currentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  currentTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  currentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: spacing.xs,
  },
  currentCol: {
    flex: 1,
  },
  currentLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
    marginBottom: 2,
  },
  currentVal: {
    ...typography.bodyLarge,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  currentDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  currentTime: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
    marginTop: spacing.xs,
  },
  baselineCard: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    fontWeight: '700',
    marginBottom: 2,
  },
  baselineDesc: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  baselineGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  baselineItem: {
    flex: 1,
  },
  baselineLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
    marginBottom: 2,
  },
  baselineVal: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  historySection: {
    marginBottom: spacing.xl,
  },
  nightCard: {
    padding: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.surfaceSubtle,
    borderColor: colors.border,
  },
  nightHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  nightDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nightDateText: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '700',
    marginLeft: 6,
  },
  nightStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: spacing.xs,
  },
  nightStatItem: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 11,
  },
  nightReasonText: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
    fontStyle: 'italic',
  },
});
