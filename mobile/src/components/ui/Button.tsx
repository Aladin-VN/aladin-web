import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  View,
  type TouchableOpacityProps,
  type GestureResponderEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '@/src/hooks/useTranslation';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<TouchableOpacityProps, 'style' | 'children'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  children: React.ReactNode;
  className?: string;
  onPress?: ((event: GestureResponderEvent) => void) | null;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-[#1B6B4A] active:bg-[#145A3D]',
  secondary:
    'bg-[#E8F5EE] active:bg-[#D0EBE0] text-[#1B6B4A]',
  outline:
    'bg-transparent border-2 border-[#1B6B4A] active:bg-[#E8F5EE] text-[#1B6B4A]',
  ghost:
    'bg-transparent active:bg-gray-100 text-[#1B6B4A]',
  danger:
    'bg-[#DC2626] active:bg-[#B91C1C]',
};

const sizeStyles: Record<ButtonSize, { container: string; text: string; iconSize: number }> = {
  sm: { container: 'px-3 py-1.5 rounded-lg', text: 'text-sm font-medium', iconSize: 14 },
  md: { container: 'px-4 py-2.5 rounded-lg', text: 'text-base font-semibold', iconSize: 18 },
  lg: { container: 'px-6 py-3.5 rounded-xl', text: 'text-lg font-semibold', iconSize: 20 },
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  fullWidth = false,
  children,
  className = '',
  onPress,
  ...rest
}: ButtonProps) {
  const { t } = useTranslation();
  const isDisabled = disabled || loading;

  const variantClass = variantStyles[variant];
  const sizeConfig = sizeStyles[size];
  const textColor =
    variant === 'primary' || variant === 'danger'
      ? 'text-white'
      : variant === 'outline' || variant === 'ghost'
        ? 'text-[#1B6B4A]'
        : 'text-[#1B6B4A]';

  return (
    <TouchableOpacity
      {...rest}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={isDisabled ? 1 : 0.8}
      className={`
        flex-row items-center justify-center gap-2
        ${variantClass}
        ${sizeConfig.container}
        ${isDisabled ? 'opacity-50' : ''}
        ${fullWidth ? 'w-full' : 'self-start'}
        ${className}
      `}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' || variant === 'danger' ? '#FFFFFF' : '#1B6B4A'}
        />
      ) : icon ? (
        <View className="items-center justify-center">{icon}</View>
      ) : null}

      <Text
        className={`
          ${textColor}
          ${sizeConfig.text}
          ${loading ? 'ml-1' : ''}
        `}
      >
        {children}
      </Text>
    </TouchableOpacity>
  );
}
