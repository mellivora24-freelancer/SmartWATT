import React from 'react';
import { StyleSheet, Text, View, ViewProps } from 'react-native';
import { colors, radii, spacing, typography } from '../theme';

export type BadgeVariant =
  | 'normal'
  | 'warning'
  | 'danger'
  | 'info'
  | 'primary'
  | 'default';

interface BadgeProps extends ViewProps {
  label: string;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
}

export function Badge({
  label,
  variant = 'default',
  size = 'md',
  icon,
  style,
  ...props
}: BadgeProps) {
  let bg = colors.surfaceSubtle;
  let textCol = colors.textSecondary;
  let borderCol = colors.border;

  switch (variant) {
    case 'normal':
      bg = colors.normalSubtle;
      textCol = colors.normal;
      borderCol = colors.normal;
      break;
    case 'warning':
      bg = colors.warningSubtle;
      textCol = colors.warning;
      borderCol = colors.warning;
      break;
    case 'danger':
      bg = colors.dangerSubtle;
      textCol = colors.danger;
      borderCol = colors.danger;
      break;
    case 'info':
      bg = colors.infoSubtle;
      textCol = colors.info;
      borderCol = colors.info;
      break;
    case 'primary':
      bg = colors.primarySubtle;
      textCol = colors.primary;
      borderCol = colors.primary;
      break;
  }

  const isSmall = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: bg,
          borderColor: borderCol,
          paddingHorizontal: isSmall ? spacing.xs + 2 : spacing.sm + 2,
          paddingVertical: isSmall ? 2 : spacing.xs,
        },
        style,
      ]}
      {...props}
    >
      {icon && <View style={styles.icon}>{icon}</View>}
      <Text
        style={[
          styles.text,
          {
            color: textCol,
            fontSize: isSmall ? 10 : 12,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: radii.full,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  icon: {
    marginRight: 4,
  },
  text: {
    ...typography.caption,
    fontWeight: '600',
  },
});
