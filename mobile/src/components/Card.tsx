import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import { colors, radii, shadows, spacing } from '../theme';

interface CardProps extends ViewProps {
  elevated?: boolean;
  active?: boolean;
  variant?: 'default' | 'elevated' | 'subtle' | 'outline';
  noPadding?: boolean;
}

export function Card({
  children,
  style,
  elevated = false,
  active = false,
  variant = 'default',
  noPadding = false,
  ...props
}: CardProps) {
  let bg = colors.surface;
  let border = colors.border;

  if (variant === 'elevated' || elevated) {
    bg = colors.surfaceElevated;
    border = colors.borderLight;
  } else if (variant === 'subtle') {
    bg = colors.surfaceSubtle;
    border = colors.border;
  } else if (variant === 'outline') {
    bg = 'transparent';
    border = colors.border;
  }

  if (active) {
    border = colors.borderHighlight;
  }

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: bg,
          borderColor: border,
          padding: noPadding ? 0 : spacing.lg,
        },
        elevated ? shadows.md : null,
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
});
