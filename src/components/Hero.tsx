import React from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, type } from '@/lib/theme';

/**
 * Full-bleed backdrop with a bottom fade into the page, like the header
 * Wholphin shows above its home rows and on detail pages.
 */
export function Hero({
  backdrop,
  logo,
  title,
  meta,
  overview,
  height,
  children,
}: {
  backdrop?: string;
  logo?: string;
  title: string;
  meta?: string;
  overview?: string;
  height?: number;
  children?: React.ReactNode;
}) {
  const { width, height: winH } = useWindowDimensions();
  const h = height ?? Math.min(Math.max((width * 9) / 16 + 140, 380), winH * 0.72);
  return (
    <View style={{ height: h, width }}>
      {backdrop && <Image source={backdrop} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />}
      <LinearGradient
        colors={['rgba(14,15,20,0.35)', 'rgba(14,15,20,0.1)', 'rgba(14,15,20,0.85)', colors.background]}
        locations={[0, 0.3, 0.75, 1]}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(14,15,20,0.7)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.8, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.content}>
        {logo ? (
          <Image source={logo} style={styles.logo} contentFit="contain" contentPosition="left" />
        ) : (
          <Text style={type.hero} numberOfLines={2}>
            {title}
          </Text>
        )}
        {meta ? <Text style={styles.meta}>{meta}</Text> : null}
        {overview ? (
          <Text style={styles.overview} numberOfLines={3}>
            {overview}
          </Text>
        ) : null}
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: spacing.lg, gap: spacing.sm },
  logo: { width: '70%', height: 80 },
  meta: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  overview: { color: colors.text, fontSize: 14, lineHeight: 20, opacity: 0.9 },
});
