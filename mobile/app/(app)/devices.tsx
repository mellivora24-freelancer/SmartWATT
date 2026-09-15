import React, { useCallback, useEffect, useState } from 'react';
import {
  Modal,
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
import { devicesApi } from '../../src/api/endpoints';
import { Device } from '../../src/api/types';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Header,
  Input,
  LoadingState,
} from '../../src/components';
import { useRealtime } from '../../src/realtime/RealtimeContext';
import { colors, radii, spacing, typography } from '../../src/theme';
import {
  formatCurrent,
  formatDateTime,
  formatPower,
  formatVoltage,
  formatWaterFlow,
} from '../../src/utils/format';

export default function DevicesScreen() {
  const router = useRouter();
  const { latestTelemetry } = useRealtime();

  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Add Device Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const loadDevices = useCallback(async () => {
    try {
      const data = await devicesApi.list();
      setDevices(data);
    } catch {
      // Handled
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  const onRefresh = () => {
    setRefreshing(true);
    loadDevices();
  };

  const handleAddDevice = async () => {
    if (!code.trim()) {
      setAddError('Vui lòng nhập mã thiết bị (device code)');
      return;
    }

    try {
      setAddError(null);
      setAddLoading(true);
      await devicesApi.create({
        code: code.trim(),
        name: name.trim() || undefined,
        location: location.trim() || undefined,
      });
      setModalVisible(false);
      setCode('');
      setName('');
      setLocation('');
      loadDevices();
    } catch (err: any) {
      setAddError(err?.detail || err?.message || 'Không thể thêm thiết bị');
    } finally {
      setAddLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Thiết bị của bạn"
        subtitle={`${devices.length} thiết bị đang quản lý`}
        rightAction={
          <Button
            title="Thêm mới"
            variant="primary"
            size="sm"
            icon={<Ionicons name="add" size={16} color={colors.textInverse} />}
            onPress={() => {
              setAddError(null);
              setModalVisible(true);
            }}
          />
        }
      />

      {loading && !refreshing ? (
        <LoadingState message="Đang nạp danh sách thiết bị..." />
      ) : devices.length === 0 ? (
        <View style={styles.emptyContainer}>
          <EmptyState
            icon="hardware-chip-outline"
            title="Chưa gán thiết bị nào"
            description="Nhấn nút Thêm mới ở trên để gán mã thiết bị SmartWatt vào tài khoản của bạn."
            actionTitle="Thêm thiết bị ngay"
            onAction={() => setModalVisible(true)}
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
          {devices.map((device) => {
            const telemetry =
              latestTelemetry[device.id] || device.latest_telemetry;
            const isOnline = telemetry?.timestamp
              ? Date.now() - new Date(telemetry.timestamp).getTime() < 60000
              : false;

            return (
              <Card
                key={device.id}
                style={styles.deviceCard}
                elevated
              >
                <View style={styles.deviceHeader}>
                  <View style={styles.deviceTitleGroup}>
                    <View style={styles.iconBox}>
                      <Ionicons
                        name="hardware-chip"
                        size={20}
                        color={colors.primary}
                      />
                    </View>
                    <View>
                      <Text style={styles.deviceName}>
                        {device.name || device.code}
                      </Text>
                      <Text style={styles.deviceCode}>
                        Mã: <Text style={styles.codeHighlight}>{device.code}</Text>
                        {device.location ? ` • ${device.location}` : ''}
                      </Text>
                    </View>
                  </View>

                  <Badge
                    label={
                      isOnline
                        ? 'Đang hoạt động'
                        : telemetry
                        ? 'Ngoại tuyến'
                        : 'Chưa có dữ liệu'
                    }
                    variant={isOnline ? 'normal' : telemetry ? 'danger' : 'default'}
                    size="sm"
                  />
                </View>

                {telemetry ? (
                  <View style={styles.telemetryPreview}>
                    <View style={styles.previewCol}>
                      <Text style={styles.previewLabel}>Công suất</Text>
                      <Text style={styles.previewValue}>
                        {formatPower(telemetry.power)}
                      </Text>
                    </View>

                    <View style={styles.previewDivider} />

                    <View style={styles.previewCol}>
                      <Text style={styles.previewLabel}>Điện áp / Dòng</Text>
                      <Text style={styles.previewValue}>
                        {formatVoltage(telemetry.voltage)} •{' '}
                        {formatCurrent(telemetry.current)}
                      </Text>
                    </View>

                    <View style={styles.previewDivider} />

                    <View style={styles.previewCol}>
                      <Text style={styles.previewLabel}>Lưu lượng nước</Text>
                      <Text style={styles.previewValue}>
                        {formatWaterFlow(telemetry.water_flow_lpm)}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.noTelemetryBox}>
                    <Text style={styles.noTelemetryText}>
                      Chưa nhận được gói tin telemetry nào từ thiết bị này.
                    </Text>
                  </View>
                )}

                {telemetry?.timestamp && (
                  <Text style={styles.updatedTime}>
                    Đo lúc: {formatDateTime(telemetry.timestamp)}
                  </Text>
                )}

                {/* Actions Row */}
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() =>
                      router.push({
                        pathname: '/device/[id]/history',
                        params: { id: device.id },
                      })
                    }
                  >
                    <Ionicons
                      name="stats-chart-outline"
                      size={16}
                      color={colors.primary}
                    />
                    <Text style={styles.actionBtnText}>Lịch sử</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() =>
                      router.push({
                        pathname: '/device/[id]/leak',
                        params: { id: device.id },
                      })
                    }
                  >
                    <Ionicons
                      name="water-outline"
                      size={16}
                      color={colors.water}
                    />
                    <Text style={[styles.actionBtnText, { color: colors.water }]}>
                      Rò rỉ nước
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, styles.settingsBtn]}
                    onPress={() =>
                      router.push({
                        pathname: '/device/[id]',
                        params: { id: device.id },
                      })
                    }
                  >
                    <Ionicons
                      name="settings-outline"
                      size={16}
                      color={colors.textPrimary}
                    />
                    <Text
                      style={[
                        styles.actionBtnText,
                        { color: colors.textPrimary },
                      ]}
                    >
                      Cài đặt & Ngưỡng
                    </Text>
                  </TouchableOpacity>
                </View>
              </Card>
            );
          })}
        </ScrollView>
      )}

      {/* Add Device Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Card style={styles.modalCard} elevated>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Thêm thiết bị mới</Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Nhập mã định danh (Code) được ghi trên thiết bị SmartWatt hoặc cấu hình qua Web Portal ESP32.
            </Text>

            {addError && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={18} color={colors.danger} />
                <Text style={styles.errorText}>{addError}</Text>
              </View>
            )}

            <Input
              label="Mã thiết bị (bắt buộc)"
              placeholder="SW-001"
              autoCapitalize="characters"
              value={code}
              onChangeText={(text) => {
                setCode(text);
                if (addError) setAddError(null);
              }}
              leftIcon={
                <Ionicons
                  name="barcode-outline"
                  size={20}
                  color={colors.textSecondary}
                />
              }
            />

            <Input
              label="Tên gợi nhớ"
              placeholder="Tủ điện tổng tầng 1"
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
              placeholder="Phòng khách / Nhà bếp"
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

            <View style={styles.modalButtons}>
              <Button
                title="Hủy"
                variant="secondary"
                onPress={() => setModalVisible(false)}
                style={styles.modalCancelBtn}
              />
              <Button
                title="Gán thiết bị"
                variant="primary"
                loading={addLoading}
                onPress={handleAddDevice}
                style={styles.modalSubmitBtn}
              />
            </View>
          </Card>
        </View>
      </Modal>
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  deviceCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  deviceHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  deviceTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  deviceName: {
    ...typography.bodyLarge,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  deviceCode: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  codeHighlight: {
    color: colors.primary,
    fontWeight: '600',
  },
  telemetryPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radii.md,
    padding: spacing.md,
    marginVertical: spacing.xs,
  },
  previewCol: {
    flex: 1,
  },
  previewLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
    marginBottom: 2,
  },
  previewValue: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  previewDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.border,
    marginHorizontal: spacing.sm,
  },
  noTelemetryBox: {
    backgroundColor: colors.surfaceSubtle,
    padding: spacing.md,
    borderRadius: radii.md,
    marginVertical: spacing.xs,
  },
  noTelemetryText: {
    ...typography.caption,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  updatedTime: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
    marginTop: spacing.xs,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    marginLeft: spacing.sm,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceSubtle,
  },
  actionBtnText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
    marginLeft: 4,
  },
  settingsBtn: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(3, 7, 18, 0.8)',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modalCard: {
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderColor: colors.borderLight,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  modalSubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dangerSubtle,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.dangerText,
    marginLeft: spacing.sm,
    flex: 1,
  },
  modalButtons: {
    flexDirection: 'row',
    marginTop: spacing.md,
  },
  modalCancelBtn: {
    flex: 1,
    marginRight: spacing.sm,
  },
  modalSubmitBtn: {
    flex: 2,
  },
});
