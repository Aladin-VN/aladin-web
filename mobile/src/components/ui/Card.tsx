import React from 'react';
import { View, type ViewProps } from 'react-native';

type CardVariant = 'elevated' | 'outlined' | 'flat';

export interface CardProps extends ViewProps {
  variant?: CardVariant;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  className?: string;
  children: React.ReactNode;
}

const variantStyles: Record<CardVariant, string> = {
  elevated: 'bg-white rounded-xl shadow-sm',
  outlined: 'bg-white rounded-xl border border-gray-200',
  flat: 'bg-white rounded-xl',
};

const paddingStyles: Record<string, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

export function Card({
  variant = 'elevated',
  padding = 'md',
  className = '',
  children,
  ...rest
}: CardProps) {
  return (
    <View
      className={`${variantStyles[variant]} ${paddingStyles[padding]} ${className}`}
      {...rest}
    >
      {children}
    </View>
  );
}
