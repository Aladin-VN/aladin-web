import React from 'react';
import { View, Text, type ViewProps } from 'react-native';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';
type BadgeSize = 'sm' | 'md';

export interface BadgeProps extends ViewProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  customColor?: string;
  customTextColor?: string;
  customBgColor?: string;
  className?: string;
  children: React.ReactNode;
}

const variantStyles: Record<BadgeVariant, { bg: string; text: string }> = {
  success: { bg: 'bg-green-100', text: 'text-green-700' },
  warning: { bg: 'bg-amber-100', text: 'text-amber-700' },
  danger: { bg: 'bg-red-100', text: 'text-red-700' },
  info: { bg: 'bg-blue-100', text: 'text-blue-700' },
  neutral: { bg: 'bg-gray-100', text: 'text-gray-700' },
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-[11px]',
  md: 'px-3 py-1 text-xs',
};

export function Badge({
  variant = 'neutral',
  size = 'sm',
  customColor,
  customTextColor,
  customBgColor,
  className = '',
  children,
  ...rest
}: BadgeProps) {
  // Custom color overrides take priority
  if (customBgColor || customTextColor) {
    return (
      <View
        className={`self-start rounded-full ${sizeStyles[size]} ${className}`}
        style={{
          backgroundColor: customBgColor || undefined,
        }}
        {...rest}
      >
        <Text
          className={`font-medium ${sizeStyles[size]}`}
          style={{
            color: customTextColor || customColor || '#374151',
          }}
        >
          {children}
        </Text>
      </View>
    );
  }

  const styles = variantStyles[variant];

  return (
    <View
      className={`self-start rounded-full ${styles.bg} ${className}`}
      {...rest}
    >
      <Text className={`font-medium ${styles.text} ${sizeStyles[size]}`}>
        {children}
      </Text>
    </View>
  );
}
