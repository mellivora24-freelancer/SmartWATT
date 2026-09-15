import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableOpacityProps,
  View,
} from 'react-native';
import { colors, radii, spacing, typography } from '../theme';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export function Button({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  rightIcon,
  style,
  ...props
}: ButtonProps) {
  let bg = colors.primary;
  let border = colors.primary;
  let textCol = colors.textInverse;

  if (variant === 'secondary') {
    bg = colors.surfaceElevated;
    border = colors.borderLight;
    textCol = colors.textPrimary;
  } else if (variant === 'outline') {
    bg = 'transparent';
    border = colors.borderLight;
    textCol = colors.textPrimary;
  } else if (variant === 'danger') {
    bg = colors.danger;
    border = colors.danger;
    textCol = '#FFFFFF';
  } else if (variant === 'ghost') {
    bg = 'transparent';
    border = 'transparent';
    textCol = colors.primary;
  }

  const height = size === 'sm' ? 36 : size === 'lg' ? 52 : 44;
  const paddingH = size === 'sm' ? spacing.md : size === 'lg' ? spacing.xl : spacing.lg;
  const fontSize = size === 'sm' ? 13 : size === 'lg' ? 16 : 14;

  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      disabled={isDisabled}
      style={[
        styles.button,
        {
          backgroundColor: isDisabled ? colors.surfaceSubtle : bg,
          borderColor: isDisabled ? colors.border : border,
          height,
          paddingHorizontal: paddingH,
          opacity: isDisabled ? 0.6 : 1,
        },
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textCol} />
      ) : (
        <View style={styles.content}>
          {icon && <View style={styles.iconLeft}>{icon}</View>}
          <Text
            style={[
              styles.text,
              {
                color: isDisabled ? colors.textMuted : textCol,
                fontSize,
              },
            ]}
          >
            {title}
          </Text>
          {rightIcon && <View style={styles.iconRight}>{rightIcon}</View>}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLeft: {
    marginRight: spacing.sm,
  },
  iconRight: {
    marginLeft: spacing.sm,
  },
  text: {
    ...typography.bodyMedium,
    fontWeight: '600',
    textAlign: 'center',
  },
});
