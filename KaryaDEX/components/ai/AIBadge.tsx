/**
 * KaryaDEX — AI Persona & Generated Badge Component (Phase 12)
 *
 * Vector-only, theme-consistent indicator showing:
 * - "AI-Generated" indicator
 * - Banku (Plate-armored Heavy Lifter / Amber)
 * - Shanky (Speedster Logic / Emerald)
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { AIPersonaId } from '@/services/ai';
import { BANKU_PERSONA, SHANKY_PERSONA } from '@/services/ai';

interface AIBadgeProps {
  persona?: AIPersonaId;
  label?: string;
  size?: 'small' | 'medium';
  showModelTag?: string;
}

export const AIBadge: React.FC<AIBadgeProps> = ({
  persona = 'shanky',
  label,
  size = 'small',
  showModelTag,
}) => {
  const isBanku = persona === 'banku';
  const meta = isBanku ? BANKU_PERSONA : SHANKY_PERSONA;

  const bgStyle = isBanku ? styles.bankuBg : styles.shankyBg;
  const borderStyle = isBanku ? styles.bankuBorder : styles.shankyBorder;
  const textColor = isBanku ? '#F59E0B' : '#00E5FF';

  return (
    <View style={[styles.container, bgStyle, borderStyle, size === 'small' ? styles.smallPad : styles.mediumPad]}>
      <Ionicons
        name={isBanku ? 'shield-checkmark' : 'flash'}
        size={size === 'small' ? 12 : 14}
        color={textColor}
        style={styles.icon}
      />
      <Text style={[styles.badgeText, { color: textColor }]}>
        {label || meta.name.toUpperCase()}
      </Text>
      {showModelTag ? (
        <View style={styles.modelTag}>
          <Text style={styles.modelText}>{showModelTag}</Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  smallPad: {
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  mediumPad: {
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  bankuBg: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
  },
  bankuBorder: {
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  shankyBg: {
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
  },
  shankyBorder: {
    borderColor: 'rgba(0, 229, 255, 0.3)',
  },
  icon: {
    marginRight: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  modelTag: {
    marginLeft: 6,
    paddingHorizontal: 4,
    paddingVertical: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
  },
  modelText: {
    fontSize: 9,
    color: '#94A3B8',
    fontWeight: '600',
  },
});
