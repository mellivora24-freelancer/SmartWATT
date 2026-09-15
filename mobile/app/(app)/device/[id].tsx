import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { devicesApi } from '../../../src/api/endpoints';
import { Device, ThresholdFields } from '../../../src/api/types';
import {
  Badge,
  Button,
  Card,
  Header,
  Input,
  LoadingState,
} from '../../../src/components';
import { useRealtime } from '../../../src/realtime/RealtimeContext';
import { colors, radii, spacing, typography } from '../../../src/theme';
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
} from '../../../src/utils/format';

export default function DeviceDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const deviceId = parseInt(id, 10);

  const { latestTelemetry } = useRealtime();

  const [device, setDevice] = useState<Device | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [thresholds, setThresholds] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!deviceId) return;

    devicesApi
      .get(deviceId)
      .then((data) => {
        setDevice(data);
        setName(data.name || '');
        setLocation(data.location || '');

        const tMap: Record<string, string> = {};
        const keys: (keyof ThresholdFields)[] = [
          'min_voltage',
          'max_voltage',
          'min_current',
          'max_current',
          'min_power',
          'max_power',
          'min_frequency',
          'max_frequency',
          'min_power_factor',
          'max_power_factor',
          'min_water_flow',
          'max_water_flow',
        ];

        keys.forEach((k) => {
          if (data[k] !== null && data[k] !== undefined) {
            tMap[k] = String(data[k]);
          } else {
            tMap[k] = '';
          }
        });

        setThresholds(tMap);
      })
      .catch((err) => {
        setError(err?.detail || 'Không thể tải thông tin thiết bị');
      })
      .finally(() => setLoading(false));
  }, [deviceId]);

  const handleThresholdChange = (key: string, val: string) => {
    setThresholds((prev) => ({ ...prev, [key]: val }));
    if (error) setError(null);
    if (success) setSuccess(null);
  };

  const parseOrNull = (val: string | undefined): number | null => {
    if (!val || val.trim() === '') return null;
    const num = parseFloat(val.trim());
    return isNaN(num) ? null : num;
  };

  const handleSave = async () => {
    setError(null);
    setSuccess(null);

    const minV = parseOrNull(thresholds.min_voltage);
    const maxV = parseOrNull(thresholds.max_voltage);
    const minI = parseOrNull(thresholds.min_current);
    const maxI = parseOrNull(thresholds.max_current);
    const minP = parseOrNull(thresholds.min_power);
    const maxP = parseOrNull(thresholds.max_power);
    const minF = parseOrNull(thresholds.min_frequency);
    const maxF = parseOrNull(thresholds.max_frequency);
    const minPf = parseOrNull(thresholds.min_power_factor);
    const maxPf = parseOrNull(thresholds.max_power_factor);
    const minW = parseOrNull(thresholds.min_water_flow);
    const maxW = parseOrNull(thresholds.max_water_flow);

    // Validate min <= max
    if (minV !== null && maxV !== null && minV > maxV) {
      setError('Ngưỡng điện áp tối thiểu không được lớn hơn tối đa');
      return;
    }
    if (minI !== null && maxI !== null && minI > maxI) {
      setError('Ngưỡng dòng điện tối thiểu không được lớn hơn tối đa');
      return;
    }
    if (minP !== null && maxP !== null && minP > maxP) {
      setError('Ngưỡng công suất tối thiểu không được lớn hơn tối đa');
      return;
    }
    if (minF !== null && maxF !== null && minF > maxF) {
      setError('Ngưỡng tần số tối thiểu không được lớn hơn tối đa');
      return;
    }
    if (minPf !== null && maxPf !== null && minPf > maxPf) {
      setError('Ngưỡng hệ số công suất tối thiểu không được lớn hơn tối đa');
      return;
    }
    if (minW !== null && maxW !== null && minW > maxW) {
      setError('Ngưỡng lưu lượng nước tối thiểu không được lớn hơn tối đa');
      return;
    }

    try {
      setSaving(true);
      const updated = await devicesApi.update(deviceId, {
        name: name.trim() || null,
        location: location.trim() || null,
        min_voltage: minV,
        max_voltage: maxV,
        min_current: minI,
        max_current: maxI,
        min_power: minP,
        max_power: maxP,
        min_frequency: minF,
        max_frequency: maxF,
        min_power_factor: minPf,
        max_power_factor: maxPf,
        min_water_flow: minW,
        max_water_flow: maxW,
      });

      setDevice(updated);
      setSuccess('Đã lưu cấu hình và đồng bộ rule-base thành công!');
    } catch (err: any) {
      setError(err?.detail || err?.message || 'Không thể lưu cài đặt');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Gỡ thiết bị',
      'Bạn có chắc chắn muốn gỡ thiết bị này khỏi tài khoản? Dữ liệu lịch sử đo đạc vẫn được lưu an toàn trên máy chủ.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Gỡ thiết bị',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeleting(true);
              await devicesApi.remove(deviceId);
              router.replace('/(app)/devices');
            } catch (err: any) {
              setError(err?.detail || 'Không thể gỡ thiết bị');
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title="Cài đặt thiết bị" showBack />
        <LoadingState message="Đang nạp thông tin thiết bị..." />
      </SafeAreaView>
    );
  }

  if (!device) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title="Lỗi" showBack />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Không tìm thấy thiết bị này</Text>
        </View>
      </SafeAreaView>
    );
  }

  const live = latestTelemetry[deviceId] || device.latest_telemetry;

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title={device.name || device.code}
        subtitle={`Mã thiết bị: ${device.code}`}
        showBack
        rightAction={
          <TouchableOpacity
            style={styles.aiHeaderBtn}
            onPress={() =>
              router.push({
                pathname: '/chat',
                params: { deviceId: device.id },
              })
            }
          >
            <Ionicons name="sparkles" size={16} color={colors.primary} />
            <Text style={styles.aiHeaderBtnText}>Hỏi AI</Text>
          </TouchableOpacity>
        }
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Quick Links Navigation Bar */}
          <View style={styles.quickLinks}>
            <TouchableOpacity
              style={styles.quickLinkBtn}
              onPress={() =>
                router.push({
                  pathname: '/device/[id]/history',
                  params: { id: device.id },
                })
              }
            >
              <Ionicons name="stats-chart" size={16} color={colors.primary} />
              <Text style={styles.quickLinkText}>Lịch sử & Biểu đồ</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.quickLinkBtn, styles.quickLinkWater]}
              onPress={() =>
                router.push({
                  pathname: '/device/[id]/leak',
                  params: { id: device.id },
                })
              }
            >
              <Ionicons name="water" size={16} color={colors.water} />
              <Text style={[styles.quickLinkText, { color: colors.water }]}>
                Rò rỉ nước
              </Text>
            </TouchableOpacity>
          </View>

          {/* Live snapshot card */}
          {live && (() => {
            const isOnline = live?.timestamp
              ? Date.now() - new Date(live.timestamp).getTime() < 60000
              : false;
            return (
              <Card style={styles.liveCard} variant="subtle">
                <View style={styles.liveHeader}>
                  <Text style={styles.liveTitle}>Số liệu đo tức thời</Text>
                  <Badge
                    label={isOnline ? 'Trực tiếp' : 'Ngoại tuyến'}
                    variant={isOnline ? 'normal' : 'danger'}
                    size="sm"
                  />
                </View>

                <View style={styles.liveGrid}>
                <View style={styles.liveItem}>
                  <Text style={styles.liveLabel}>Điện áp</Text>
                  <Text style={styles.liveVal}>{formatVoltage(live.voltage)}</Text>
                </View>
                <View style={styles.liveItem}>
                  <Text style={styles.liveLabel}>Dòng điện</Text>
                  <Text style={styles.liveVal}>{formatCurrent(live.current)}</Text>
                </View>
                <View style={styles.liveItem}>
                  <Text style={styles.liveLabel}>Công suất</Text>
                  <Text style={styles.liveVal}>{formatPower(live.power)}</Text>
                </View>
                <View style={styles.liveItem}>
                  <Text style={styles.liveLabel}>Lưu lượng</Text>
                  <Text style={styles.liveVal}>
                    {formatWaterFlow(live.water_flow_lpm)}
                  </Text>
                </View>
              </View>

              <View style={styles.liveFooter}>
                <Text style={styles.liveFooterText}>
                  Điện tích lũy: {formatEnergy(live.energy_total)} • Nước: {formatWaterVolume(live.water_total_l)}
                </Text>
                <Text style={styles.liveFooterTime}>
                  {formatDateTime(live.timestamp)}
                </Text>
              </View>
            </Card>
          );
        })()}

          {/* Form Banner alerts */}
          {error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={18} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {success && (
            <View style={styles.successBox}>
              <Ionicons name="checkmark-circle" size={18} color={colors.normal} />
              <Text style={styles.successText}>{success}</Text>
            </View>
          )}

          {/* General Information Card */}
          <Card style={styles.sectionCard} elevated>
            <Text style={styles.sectionTitle}>Thông tin thiết bị</Text>
            <Input
              label="Mã thiết bị (bất biến)"
              value={device.code}
              editable={false}
              leftIcon={
                <Ionicons
                  name="barcode-outline"
                  size={20}
                  color={colors.textMuted}
                />
              }
            />

            <Input
              label="Tên hiển thị"
              placeholder="VD: Tủ điện tổng"
              value={name}
              onChangeText={setName}
              leftIcon={
                <Ionicons
                  name="text-outline"
                  size={20}
                  color={colors.textSecondary}
                />
              }
            />

            <Input
              label="Vị trí lắp đặt"
              placeholder="VD: Phòng khách, Bếp"
              value={location}
              onChangeText={setLocation}
              leftIcon={
                <Ionicons
                  name="location-outline"
                  size={20}
                  color={colors.textSecondary}
                />
              }
            />
          </Card>

          {/* Rule-base Thresholds Card */}
          <Card style={styles.sectionCard} elevated>
            <View style={styles.thresholdHeader}>
              <View>
                <Text style={styles.sectionTitle}>Ngưỡng cảnh báo (Rule-base)</Text>
                <Text style={styles.thresholdSubtitle}>
                  Server sẽ kích hoạt còi buzzer và gửi cảnh báo khi thông số vượt ra ngoài khoảng này.
                </Text>
              </View>
            </View>

            {/* Voltage */}
            <Text style={styles.groupLabel}>1. Điện áp (Voltage - V)</Text>
            <View style={styles.rowInputs}>
              <View style={styles.halfInput}>
                <Input
                  label="Tối thiểu (Min V)"
                  placeholder="200"
                  keyboardType="numeric"
                  value={thresholds.min_voltage}
                  onChangeText={(v) => handleThresholdChange('min_voltage', v)}
                />
              </View>
              <View style={{ width: spacing.md }} />
              <View style={styles.halfInput}>
                <Input
                  label="Tối đa (Max V)"
                  placeholder="245"
                  keyboardType="numeric"
                  value={thresholds.max_voltage}
                  onChangeText={(v) => handleThresholdChange('max_voltage', v)}
                />
              </View>
            </View>

            {/* Current */}
            <Text style={styles.groupLabel}>2. Dòng điện (Current - A)</Text>
            <View style={styles.rowInputs}>
              <View style={styles.halfInput}>
                <Input
                  label="Tối thiểu (Min A)"
                  placeholder="0.5"
                  keyboardType="numeric"
                  value={thresholds.min_current}
                  onChangeText={(v) => handleThresholdChange('min_current', v)}
                />
              </View>
              <View style={{ width: spacing.md }} />
              <View style={styles.halfInput}>
                <Input
                  label="Tối đa (Max A)"
                  placeholder="25.0"
                  keyboardType="numeric"
                  value={thresholds.max_current}
                  onChangeText={(v) => handleThresholdChange('max_current', v)}
                />
              </View>
            </View>

            {/* Power */}
            <Text style={styles.groupLabel}>3. Công suất (Power - W)</Text>
            <View style={styles.rowInputs}>
              <View style={styles.halfInput}>
                <Input
                  label="Tối thiểu (Min W)"
                  placeholder="0"
                  keyboardType="numeric"
                  value={thresholds.min_power}
                  onChangeText={(v) => handleThresholdChange('min_power', v)}
                />
              </View>
              <View style={{ width: spacing.md }} />
              <View style={styles.halfInput}>
                <Input
                  label="Tối đa (Max W)"
                  placeholder="5000"
                  keyboardType="numeric"
                  value={thresholds.max_power}
                  onChangeText={(v) => handleThresholdChange('max_power', v)}
                />
              </View>
            </View>

            {/* Frequency */}
            <Text style={styles.groupLabel}>4. Tần số (Frequency - Hz)</Text>
            <View style={styles.rowInputs}>
              <View style={styles.halfInput}>
                <Input
                  label="Tối thiểu (Min Hz)"
                  placeholder="48.0"
                  keyboardType="numeric"
                  value={thresholds.min_frequency}
                  onChangeText={(v) => handleThresholdChange('min_frequency', v)}
                />
              </View>
              <View style={{ width: spacing.md }} />
              <View style={styles.halfInput}>
                <Input
                  label="Tối đa (Max Hz)"
                  placeholder="52.0"
                  keyboardType="numeric"
                  value={thresholds.max_frequency}
                  onChangeText={(v) => handleThresholdChange('max_frequency', v)}
                />
              </View>
            </View>

            {/* Power Factor */}
            <Text style={styles.groupLabel}>5. Hệ số công suất (PF: 0.0 - 1.0)</Text>
            <View style={styles.rowInputs}>
              <View style={styles.halfInput}>
                <Input
                  label="Tối thiểu (Min PF)"
                  placeholder="0.80"
                  keyboardType="numeric"
                  value={thresholds.min_power_factor}
                  onChangeText={(v) => handleThresholdChange('min_power_factor', v)}
                />
              </View>
              <View style={{ width: spacing.md }} />
              <View style={styles.halfInput}>
                <Input
                  label="Tối đa (Max PF)"
                  placeholder="1.0"
                  keyboardType="numeric"
                  value={thresholds.max_power_factor}
                  onChangeText={(v) => handleThresholdChange('max_power_factor', v)}
                />
              </View>
            </View>

            {/* Water Flow */}
            <Text style={styles.groupLabel}>6. Lưu lượng nước (L/phút)</Text>
            <View style={styles.rowInputs}>
              <View style={styles.halfInput}>
                <Input
                  label="Tối thiểu (Min L/p)"
                  placeholder="0"
                  keyboardType="numeric"
                  value={thresholds.min_water_flow}
                  onChangeText={(v) => handleThresholdChange('min_water_flow', v)}
                />
              </View>
              <View style={{ width: spacing.md }} />
              <View style={styles.halfInput}>
                <Input
                  label="Tối đa (Max L/p)"
                  placeholder="15.0"
                  keyboardType="numeric"
                  value={thresholds.max_water_flow}
                  onChangeText={(v) => handleThresholdChange('max_water_flow', v)}
                />
              </View>
            </View>

            <Button
              title="Lưu tất cả thay đổi"
              variant="primary"
              size="lg"
              loading={saving}
              onPress={handleSave}
              style={{ marginTop: spacing.md }}
            />
          </Card>

          {/* Danger Zone: Unassign Device */}
          <Card style={styles.dangerCard} variant="subtle">
            <Text style={styles.dangerTitle}>Khu vực nguy hiểm</Text>
            <Text style={styles.dangerSubtitle}>
              Gỡ thiết bị này khỏi danh sách quản lý của bạn. Sau khi gỡ, người dùng khác có thể gán thiết bị theo mã.
            </Text>
            <Button
              title="Gỡ thiết bị khỏi tài khoản"
              variant="danger"
              size="md"
              loading={deleting}
              onPress={handleDelete}
              icon={<Ionicons name="trash-outline" size={18} color="#FFFFFF" />}
            />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  aiHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySubtle,
    borderWidth: 1,
    borderColor: colors.borderHighlight,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  aiHeaderBtnText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
    marginLeft: 3,
  },
  quickLinks: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
  },
  quickLinkBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    marginRight: spacing.sm,
  },
  quickLinkWater: {
    marginRight: 0,
    marginLeft: spacing.sm,
  },
  quickLinkText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '700',
    marginLeft: spacing.xs,
  },
  liveCard: {
    backgroundColor: colors.surfaceSubtle,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  liveHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  liveTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  liveGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: spacing.xs,
  },
  liveItem: {
    flex: 1,
  },
  liveLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
  },
  liveVal: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '700',
    marginTop: 2,
  },
  liveFooter: {
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  liveFooterText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 10,
  },
  liveFooterTime: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
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
    marginBottom: spacing.xs,
  },
  thresholdHeader: {
    marginBottom: spacing.md,
  },
  thresholdSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  groupLabel: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '700',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  rowInputs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfInput: {
    flex: 1,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dangerSubtle,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.dangerText,
    marginLeft: spacing.sm,
    flex: 1,
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.normalSubtle,
    borderWidth: 1,
    borderColor: colors.normal,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  successText: {
    ...typography.bodySmall,
    color: colors.normalText,
    marginLeft: spacing.sm,
    flex: 1,
  },
  dangerCard: {
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.danger,
    padding: spacing.lg,
    marginBottom: spacing.xxl,
  },
  dangerTitle: {
    ...typography.bodyMedium,
    color: colors.danger,
    fontWeight: '700',
    marginBottom: 2,
  },
  dangerSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
});
