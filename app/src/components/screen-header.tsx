import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

const COLORS = {
  primary: '#1E2A16',
  secondary: '#55614D',
};

type ScreenHeaderProps = {
  subtitle: ReactNode;
  title: string;
  /** Optional spacing tweaks for one page, e.g. a smaller gap below. */
  style?: StyleProp<ViewStyle>;
  /** Optional button on the right of the title, e.g. the Recipes tab's "Saved". */
  right?: ReactNode;
};

export function ScreenHeader({ subtitle, title, style, right }: ScreenHeaderProps) {
  return (
    <View style={[styles.header, style]}>
      <View style={styles.headingRow}>
        <View style={styles.headingText}>
          {typeof subtitle === 'string' ? (
            <Text style={styles.subtitle}>{subtitle}</Text>
          ) : (
            subtitle
          )}

          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
        </View>

        {right}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 24,
  },
  headingRow: {
    minHeight: 100,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headingText: {
    flex: 1,
  },
  subtitle: {
    marginBottom: 6,
    color: COLORS.secondary,
    fontFamily: 'Fredoka_500Medium',
    fontSize: 18,
  },
  title: {
    marginTop: 4,
    color: COLORS.primary,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 26,
    lineHeight: 34,
  },
});
