import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { alertsApi, devicesApi } from '../../src/api/endpoints';
import { AlertItem, Device } from '../../src/api/types';
import {
  Badge,
  Card,
  EmptyState,
  Header,
  LoadingState,
} from '../../src/components';
import { useRealtime } from '../../src/realtime/RealtimeContext';
import { colors, radii, spacing, typography } from '../../src/theme';
import { formatDateTime } from '../../src/utils/format';

type AlertFilter = 'all' | 'danger' | 'warning' | 'water';

export default function AlertsScreen() {
  const { recentAlerts, clearAlerts, removeAlert } = useRealtime();

  const [devices, setDevices] = useState<Device[]>([]);
  const [dbAlerts, setDbAlerts] = useState<AlertItem[]>([]);
  const [filter, setFilter] = useState<AlertFilter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadAlerts = useCallback(async () => {
    try {
      const devList = await devicesApi.list();
      setDevices(devList);

      const allAlertPromises = devList.map((d) => devicesApi.getAlerts(d.id, 50));
      const results = await Promise.allSettled(allAlertPromises);

      const combined: AlertItem[] = [];
      results.forEach((res) => {
        if (res.status === 'fulfilled') {
          combined.push(...res.value);
        }
      });

      // Sort by timestamp descending
      combined.sort(
        (a, b) =>
          new Date(b.timestamp || b.created_at || '').getTime() -
          new Date(a.timestamp || a.created_at || '').getTime()
      );
      setDbAlerts(combined);
    } catch {
      // Ignored
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAlerts();
    }, [loadAlerts])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadAlerts();
  };

  const handleDeleteAlert = (item: AlertItem) => {
    Alert.alert(
      'Xóa thông báo',
      `Bạn có muốn xóa thông báo "${item.message || item.metric}"?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              if (item.id) {
                await alertsApi.delete(item.id);
              }
              // Update local DB list
              setDbAlerts((prev) =>
                prev.filter((a) => {
                  if (item.id && a.id) return a.id !== item.id;
                  return a.timestamp !== item.timestamp;
                })
              );
              // Update realtime context
              removeAlert(item);
            } catch (err: any) {
              Alert.alert(
                'Lỗi',
                err?.detail || err?.message || 'Không thể xóa thông báo lúc này'
              );
            }
          },
        },
      ]
    );
  };

  // Merge realtime alerts on top of DB alerts, removing duplicates
  const alertMap = new Map<string, AlertItem>();
  [...recentAlerts, ...dbAlerts].forEach((item) => {
    const key = item.id
      ? `id_${item.id}`
      : `${item.device_id}_${item.metric}_${item.timestamp}`;
    if (!alertMap.has(key)) {
      alertMap.set(key, item);
    }
  });

  const allAlerts = Array.from(alertMap.values()).sort(
    (a, b) =>
      new Date(b.timestamp || b.created_at || '').getTime() -
      new Date(a.timestamp || a.created_at || '').getTime()
  );

  const filteredAlerts = allAlerts.filter((item) => {
    if (filter === 'danger') return item.severity === 'danger';
    if (filter === 'warning') return item.severity === 'warning';
    if (filter === 'water')
      return (
        item.metric === 'water_flow_lpm' ||
        item.metric === 'water_leak' ||
        item.rule_type === 'water'
      );
    return true;
  });

  const getDeviceName = (deviceId: number, deviceCode?: string) => {
    const d = devices.find((dev) => dev.id === deviceId);
    return d?.name || d?.code || deviceCode || `Thiết bị #${deviceId}`;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Cảnh báo & Sự cố"
        subtitle={`${filteredAlerts.length} thông báo`}
        rightAction={
          recentAlerts.length > 0 ? (
            <TouchableOpacity onPress={clearAlerts} style={styles.clearBtn}>
              <Text style={styles.clearBtnText}>Xóa tạm</Text>
            </TouchableOpacity>
          ) : undefined
        }
      />

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {[
          { id: 'all' as AlertFilter, label: 'Tất cả' },
          { id: 'danger' as AlertFilter, label: 'Nguy hiểm' },
          { id: 'warning' as AlertFilter, label: 'Cảnh báo' },
          { id: 'water' as AlertFilter, label: 'Nước' },
        ].map((f) => {
          const isSel = filter === f.id;
          return (
            <TouchableOpacity
              key={f.id}
              style={[styles.filterPill, isSel && styles.filterPillActive]}
              onPress={() => setFilter(f.id)}
            >
              <Text
                style={[
                  styles.filterPillText,
                  isSel && styles.filterPillTextActive,
                ]}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Action Hint */}
      {filteredAlerts.length > 0 && (
        <View style={styles.hintBar}>
          <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} />
          <Text style={styles.hintText}>
            Nhấn giữ hoặc chạm vào biểu tượng thùng rác để xóa thông báo
          </Text>
        </View>
      )}

      {loading && !refreshing ? (
        <LoadingState message="Đang nạp nhật ký sự cố..." />
      ) : filteredAlerts.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            icon="notifications-off-outline"
            title="Không có cảnh báo nào"
            description="Tất cả các chỉ số điện và lưu lượng nước hiện đang nằm trong ngưỡng an toàn."
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
          {filteredAlerts.map((alert, idx) => {
            const isDanger = alert.severity === 'danger';
            const isWater =
              alert.metric === 'water_flow_lpm' ||
              alert.metric === 'water_leak';

            let iconName: keyof typeof Ionicons.glyphMap = 'alert-circle';
            if (isWater) iconName = 'water';
            else if (alert.metric === 'voltage') iconName = 'speedometer';
            else if (alert.metric === 'current' || alert.metric === 'power')
              iconName = 'flash';

            return (
              <TouchableOpacity
                key={alert.id || idx}
                activeOpacity={0.8}
                onLongPress={() => handleDeleteAlert(alert)}
                delayLongPress={350}
              >
                <Card
                  style={[
                    styles.alertCard,
                    {
                      borderColor: isDanger ? colors.danger : colors.warning,
                      backgroundColor: isDanger
                        ? colors.dangerSubtle
                        : colors.warningSubtle,
                    },
                  ]}
                  variant="elevated"
                >
                  <View style={styles.alertHeader}>
                    <View style={styles.alertHeaderLeft}>
                      <View
                        style={[
                          styles.alertIconBox,
                          {
                            backgroundColor: isDanger
                              ? colors.danger
                              : colors.warning,
                          },
                        ]}
                      >
                        <Ionicons
                          name={iconName}
                          size={18}
                          color="#FFFFFF"
                        />
                      </View>
                      <View>
                        <Text style={styles.alertDevice}>
                          {getDeviceName(alert.device_id, alert.device_code)}
                        </Text>
                        <Text style={styles.alertTime}>
                          {formatDateTime(alert.timestamp || alert.created_at || '')}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.alertHeaderRight}>
                      <Badge
                        label={
                          isDanger
                            ? 'Nguy hiểm'
                            : isWater
                            ? 'Lưu lượng'
                            : 'Vượt ngưỡng'
                        }
                        variant={isDanger ? 'danger' : 'warning'}
                        size="sm"
                      />
                      <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={() => handleDeleteAlert(alert)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={16}
                          color={colors.textMuted}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <Text style={styles.alertMessage}>
                    {alert.message ||
                      `Chỉ số ${alert.metric} đạt ${alert.value}, vượt quá ngưỡng an toàn.`}
                  </Text>

                  {alert.threshold !== undefined && alert.threshold !== null && (
                    <View style={styles.alertMeta}>
                      <Text style={styles.metaText}>
                        Giá trị đo:{' '}
                        <Text style={{ fontWeight: '700', color: colors.textPrimary }}>
                          {alert.value}
                        </Text>
                        {' • '}
                        Ngưỡng quy định:{' '}
                        <Text style={{ fontWeight: '700', color: colors.textPrimary }}>
                          {alert.threshold}
                        </Text>
                      </Text>
                    </View>
                  )}
                </Card>
              </TouchableOpacity>
            );
          })}
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
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
  },
  filterPillActive: {
    backgroundColor: colors.primarySubtle,
    borderColor: colors.primary,
  },
  filterPillText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  filterPillTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  hintBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 6,
    backgroundColor: 'rgba(56, 189, 248, 0.05)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(56, 189, 248, 0.1)',
  },
  hintText: {
    ...typography.caption,
    color: colors.textMuted,
    marginLeft: 6,
    fontSize: 11,
  },
  clearBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  clearBtnText: {
    ...typography.caption,
    color: colors.textSecondary,
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
  alertCard: {
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  alertHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  alertHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deleteBtn: {
    padding: 4,
    borderRadius: radii.sm,
  },
  alertIconBox: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  alertDevice: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  alertTime: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
  },
  alertMessage: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    marginVertical: spacing.xs,
    lineHeight: 18,
  },
  alertMeta: {
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  metaText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
