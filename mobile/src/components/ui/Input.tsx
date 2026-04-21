import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  type TextInputProps,
  TouchableOpacity,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

type KeyboardType = TextInputProps['keyboardType'];
type AutoCapitalize = TextInputProps['autoCapitalize'];

export interface InputProps extends Omit<TextInputProps, 'keyboardType' | 'autoCapitalize'> {
  label?: string;
  placeholder?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardType;
  autoCapitalize?: AutoCapitalize;
  phoneInput?: boolean;
  className?: string;
}

export function Input({
  label,
  placeholder,
  error,
  leftIcon,
  rightIcon,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  phoneInput = false,
  className = '',
  editable = true,
  ...rest
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const borderColor = error
    ? 'border-red-500'
    : isFocused
      ? 'border-[#1B6B4A]'
      : 'border-gray-300';

  const handleFocus = (e: any) => {
    setIsFocused(true);
    rest.onFocus?.(e);
  };

  const handleBlur = (e: any) => {
    setIsFocused(false);
    rest.onBlur?.(e);
  };

  return (
    <View className={`mb-4 ${className}`}>
      {/* Label */}
      {label ? (
        <Text className="mb-1.5 text-sm font-medium text-gray-700">{label}</Text>
      ) : null}

      {/* Input container */}
      <View
        className={`
          flex-row items-center rounded-lg border px-3 py-2.5
          ${borderColor}
          ${!editable ? 'bg-gray-100' : 'bg-white'}
        `}
      >
        {/* Phone VN flag */}
        {phoneInput ? (
          <View className="mr-2 flex-row items-center">
            <View className="flex h-5 w-8 items-center justify-center overflow-hidden rounded-sm bg-white">
              <MaterialIcons name="flag" size={16} color="#DC2626" />
            </View>
            <Text className="ml-1 text-sm font-medium text-gray-600">+84</Text>
          </View>
        ) : null}

        {/* Left icon */}
        {leftIcon && !phoneInput ? (
          <View className="mr-2">{leftIcon}</View>
        ) : null}

        {/* Text input */}
        <TextInput
          ref={inputRef}
          {...rest}
          editable={editable}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          secureTextEntry={secureTextEntry && !showPassword}
          keyboardType={phoneInput ? 'phone-pad' : keyboardType}
          autoCapitalize={phoneInput ? 'none' : autoCapitalize}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className="flex-1 text-base text-gray-900"
          style={{ paddingVertical: 0, marginVertical: 0 }}
        />

        {/* Password toggle */}
        {secureTextEntry ? (
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            className="ml-2 p-1"
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color="#9CA3AF"
            />
          </TouchableOpacity>
        ) : null}

        {/* Right icon */}
        {rightIcon && !secureTextEntry ? (
          <View className="ml-2">{rightIcon}</View>
        ) : null}
      </View>

      {/* Error message */}
      {error ? (
        <View className="mt-1.5 flex-row items-center gap-1">
          <Ionicons name="alert-circle" size={14} color="#EF4444" />
          <Text className="text-xs text-red-500">{error}</Text>
        </View>
      ) : null}
    </View>
  );
}
