import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { aiApi, devicesApi } from '../../src/api/endpoints';
import { Device } from '../../src/api/types';
import { Header } from '../../src/components';
import { colors, radii, spacing, typography } from '../../src/theme';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
}

const SAMPLE_PROMPTS = [
  {
    icon: 'flash',
    label: 'So sánh mức tiêu thụ điện tháng này với tháng trước',
  },
  {
    icon: 'water',
    label: 'Kiểm tra dấu hiệu rò rỉ nước ngầm hoặc bất thường',
  },
  {
    icon: 'bulb',
    label: 'Gợi ý giải pháp tiết kiệm điện và kiểm tra ngưỡng an toàn',
  },
];

export default function ChatAiScreen() {
  const { deviceId: initialDeviceId } = useLocalSearchParams<{
    deviceId?: string;
  }>();

  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'ai',
      text: 'Xin chào! Tôi là Trợ lý AI SmartWatt. Tôi có thể phân tích dữ liệu điện năng, lưu lượng nước, phát hiện rò rỉ và đề xuất giải pháp tối ưu cho gia đình bạn.',
      timestamp: new Date().toISOString(),
    },
  ]);

  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  useFocusEffect(
    useCallback(() => {
      devicesApi
        .list()
        .then((list) => {
          setDevices(list);
          if (list.length > 0) {
            setSelectedDevice((prev) => {
              if (initialDeviceId) {
                return list.find((d) => d.id === parseInt(initialDeviceId, 10)) || list[0];
              }
              return prev ? list.find((d) => d.id === prev.id) || list[0] : list[0];
            });
          }
        })
        .catch(() => {});
    }, [initialDeviceId])
  );

  const handleSend = async (promptToSend?: string) => {
    const text = promptToSend || inputText;
    if (!text.trim() || !selectedDevice || sending) return;

    const userMsg: Message = {
      id: String(Date.now()),
      sender: 'user',
      text: text.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setSending(true);

    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      const res = await aiApi.chat(selectedDevice.id, text.trim());
      const aiMsg: Message = {
        id: String(Date.now() + 1),
        sender: 'ai',
        text: res.answer,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      const errorMsg: Message = {
        id: String(Date.now() + 1),
        sender: 'ai',
        text: `Rất tiếc, đã có lỗi khi xử lý: ${err?.detail || err?.message || 'Không thể kết nối API'}. Vui lòng thử lại.`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setSending(false);
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <Header
        title="Trợ lý AI SmartWatt"
        subtitle={
          selectedDevice
            ? `Thiết bị: ${selectedDevice.name || selectedDevice.code}`
            : 'Đang tải thiết bị...'
        }
        showBack
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        style={styles.container}
      >
        {/* Device Context Switcher */}
        {devices.length > 1 && (
          <View style={styles.deviceRowWrapper}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.deviceRowContent}
            >
              {devices.map((dev) => {
                const isSel = selectedDevice?.id === dev.id;
                return (
                  <TouchableOpacity
                    key={dev.id}
                    style={[
                      styles.devicePill,
                      isSel && styles.devicePillActive,
                    ]}
                    onPress={() => setSelectedDevice(dev)}
                  >
                    <Ionicons
                      name="hardware-chip-outline"
                      size={13}
                      color={isSel ? colors.primary : colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.devicePillText,
                        isSel && styles.devicePillTextActive,
                      ]}
                    >
                      {dev.name || dev.code}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Message List */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.messageScroll}
          contentContainerStyle={styles.messageScrollContent}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() =>
            scrollViewRef.current?.scrollToEnd({ animated: true })
          }
        >
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';
            return (
              <View
                key={msg.id}
                style={[
                  styles.messageRow,
                  isUser ? styles.messageRowUser : styles.messageRowAi,
                ]}
              >
                {!isUser && (
                  <View style={styles.aiAvatar}>
                    <Ionicons name="sparkles" size={15} color={colors.primary} />
                  </View>
                )}

                <View
                  style={[
                    styles.bubble,
                    isUser ? styles.bubbleUser : styles.bubbleAi,
                  ]}
                >
                  <Text
                    style={[
                      styles.bubbleText,
                      isUser ? styles.bubbleTextUser : styles.bubbleTextAi,
                    ]}
                  >
                    {msg.text}
                  </Text>
                </View>
              </View>
            );
          })}

          {sending && (
            <View style={[styles.messageRow, styles.messageRowAi]}>
              <View style={styles.aiAvatar}>
                <Ionicons name="sparkles" size={15} color={colors.primary} />
              </View>
              <View style={[styles.bubble, styles.bubbleAi, styles.bubbleLoading]}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.loadingText}>AI đang phân tích dữ liệu...</Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Quick Suggestion List - 3 Vertical Items directly above input bar */}
        {messages.length <= 2 && (
          <View style={styles.quickPromptsSection}>
            <Text style={styles.quickPromptsTitle}>GỢI Ý CÂU HỎI</Text>
            <View style={styles.quickPromptsList}>
              {SAMPLE_PROMPTS.map((item, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.promptRow}
                  onPress={() => handleSend(item.label)}
                  disabled={sending || !selectedDevice}
                  activeOpacity={0.7}
                >
                  <View style={styles.promptRowLeft}>
                    <View style={styles.promptIconBox}>
                      <Ionicons
                        name={item.icon as any}
                        size={15}
                        color={colors.primary}
                      />
                    </View>
                    <Text style={styles.promptRowText} numberOfLines={2}>
                      {item.label}
                    </Text>
                  </View>
                  <Ionicons
                    name="arrow-forward"
                    size={14}
                    color={colors.textMuted}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Enlarged Input Bottom Bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="Hỏi AI về tiền điện, nước, rò rỉ..."
            placeholderTextColor={colors.textMuted}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
            onSubmitEditing={() => handleSend()}
          />

          <TouchableOpacity
            style={[
              styles.sendButton,
              (!inputText.trim() || sending || !selectedDevice) &&
                styles.sendButtonDisabled,
            ]}
            onPress={() => handleSend()}
            disabled={!inputText.trim() || sending || !selectedDevice}
          >
            <Ionicons
              name="send"
              size={19}
              color={
                !inputText.trim() || sending || !selectedDevice
                  ? colors.textMuted
                  : colors.textInverse
              }
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    justifyContent: 'space-between',
  },
  deviceRowWrapper: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.xs,
  },
  deviceRowContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 2,
  },
  devicePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
  },
  devicePillActive: {
    backgroundColor: colors.primarySubtle,
    borderColor: colors.primary,
  },
  devicePillText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '500',
    marginLeft: 4,
  },
  devicePillTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  messageScroll: {
    flex: 1,
  },
  messageScrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.sm,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  messageRowAi: {
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  aiAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primarySubtle,
    borderWidth: 1,
    borderColor: colors.borderHighlight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    marginTop: 2,
  },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.lg,
  },
  bubbleUser: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: radii.xs,
  },
  bubbleAi: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: radii.xs,
  },
  bubbleLoading: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
  bubbleText: {
    ...typography.bodyMedium,
    lineHeight: 22,
  },
  bubbleTextUser: {
    color: colors.textInverse,
    fontWeight: '500',
  },
  bubbleTextAi: {
    color: colors.textPrimary,
  },
  quickPromptsSection: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    backgroundColor: colors.backgroundSecondary,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  quickPromptsTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
    marginLeft: spacing.xs,
  },
  quickPromptsList: {
    gap: 6,
  },
  promptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
  },
  promptRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.sm,
  },
  promptIconBox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  promptRowText: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    flex: 1,
    fontWeight: '500',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    paddingHorizontal: spacing.lg,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    color: colors.textPrimary,
    fontSize: 15,
    lineHeight: 20,
    minHeight: 46,
    maxHeight: 110,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  sendButtonDisabled: {
    backgroundColor: colors.surfaceSubtle,
  },
});
