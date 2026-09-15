import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRealtime } from '../../src/realtime/RealtimeContext';
import { colors, typography } from '../../src/theme';

interface TabIconProps {
  name: React.ComponentProps<typeof Ionicons>['name'];
  focusedName: React.ComponentProps<typeof Ionicons>['name'];
  focused: boolean;
  color: any;
}

function TabIcon({ name, focusedName, focused, color }: TabIconProps) {
  return (
    <View style={[styles.iconWrapper, focused && styles.iconWrapperActive]}>
      <Ionicons
        name={focused ? focusedName : name}
        size={22}
        color={color}
      />
    </View>
  );
}

export default function AppLayout() {
  const insets = useSafeAreaInsets();
  const { recentAlerts } = useRealtime();
  const alertCount = recentAlerts.length;

  const bottomInset = Math.max(insets.bottom, Platform.OS === 'ios' ? 16 : 10);
  const tabHeight = (Platform.OS === 'ios' ? 56 : 60) + bottomInset;

  return (
    <Tabs
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: [
          styles.tabBar,
          {
            height: tabHeight,
            paddingBottom: bottomInset,
          },
        ],
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Trang chủ',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name="home-outline"
              focusedName="home"
              focused={focused}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="devices"
        options={{
          title: 'Thiết bị',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name="hardware-chip-outline"
              focusedName="hardware-chip"
              focused={focused}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: 'Phân tích',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name="stats-chart-outline"
              focusedName="stats-chart"
              focused={focused}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: 'Cảnh báo',
          tabBarBadge: alertCount > 0 ? (alertCount > 99 ? '99+' : alertCount) : undefined,
          tabBarBadgeStyle: styles.badge,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name="notifications-outline"
              focusedName="notifications"
              focused={focused}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Cá nhân',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name="person-outline"
              focusedName="person"
              focused={focused}
              color={color}
            />
          ),
        }}
      />

      {/* Hidden nested routes from tab bar */}
      <Tabs.Screen
        name="device/[id]"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="device/[id]/history"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="device/[id]/leak"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  tabItem: {
    paddingVertical: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapper: {
    width: 42,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  iconWrapperActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  badge: {
    backgroundColor: colors.danger,
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.surface,
    top: 4,
    right: -4,
  },
});
