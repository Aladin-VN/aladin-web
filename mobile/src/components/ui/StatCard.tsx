import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons, FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from '@/src/hooks/useTranslation';

type StatColor = 'blue' | 'green' | 'amber' | 'red' | 'purple';
type TrendDirection = 'up' | 'down';

export interface StatCardProps {
  title: string;
  titleKey?: string;
  value: string | number;
  icon?: string;
  iconSet?: 'ionicons' | 'material' | 'fontawesome';
  trend?: { value: number; direction: TrendDirection };
  color?: StatColor;
  className?: string;
}

const colorStyles: Record<StatColor, { bg: string; text: string; iconBg: string }> = {
  blue: { bg: 'bg-blue-50', text: 'text-blue-700', iconBg: 'bg-blue-100' },
  green: { bg: 'bg-green-50', text: 'text-green-700', iconBg: 'bg-green-100' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-700', iconBg: 'bg-amber-100' },
  red: { bg: 'bg-red-50', text: 'text-red-700', iconBg: 'bg-red-100' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-700', iconBg: 'bg-purple-100' },
};

export function StatCard({
  title,
  titleKey,
  value,
  icon = 'stats-chart',
  iconSet = 'ionicons',
  trend,
  color = 'green',
  className = '',
}: StatCardProps) {
  const { t } = useTranslation();
  const displayTitle = titleKey ? t(titleKey) : title;
  const colors = colorStyles[color];

  const renderIcon = () => {
    const iconSize = 22;
    const iconColor =
      color === 'blue'
        ? '#2563EB'
        : color === 'green'
          ? '#15803D'
          : color === 'amber'
            ? '#D97706'
            : color === 'red'
              ? '#DC2626'
              : '#7C3AED';

    if (iconSet === 'material') {
      return <MaterialIcons name={icon as any} size={iconSize} color={iconColor} />;
    }
    if (iconSet === 'fontawesome') {
      return <FontAwesome5 name={icon as any} size={iconSize} color={iconColor} />;
    }
    return <Ionicons name={icon as any} size={iconSize} color={iconColor} />;
  };

  return (
    <View className={`bg-white rounded-xl p-4 shadow-sm ${className}`}>
      <View className="flex-row items-center gap-3">
        {/* Icon */}
        <View className={`h-11 w-11 items-center justify-center rounded-xl ${colors.iconBg}`}>
          {renderIcon()}
        </View>

        {/* Content */}
        <View className="flex-1">
          <Text className="text-xs font-medium text-gray-500">{displayTitle}</Text>
          <View className="mt-0.5 flex-row items-end gap-2">
            <Text className="text-xl font-bold text-gray-900">{value}</Text>

            {/* Trend indicator */}
            {trend ? (
              <View
                className={`mb-0.5 flex-row items-center gap-0.5 rounded-full px-1.5 py-0.5 ${
                  trend.direction === 'up' ? 'bg-green-50' : 'bg-red-50'
                }`}
              >
                <Ionicons
                  name={
                    trend.direction === 'up' ? 'trending-up' : 'trending-down'
                  }
                  size={12}
                  color={trend.direction === 'up' ? '#16A34A' : '#DC2626'}
                />
                <Text
                  className={`text-[10px] font-semibold ${
                    trend.direction === 'up' ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {trend.value > 0 ? '+' : ''}
                  {trend.value}%
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}
