import { StyleSheet, Text, View } from 'react-native';

const COLORS = {
  primary: '#1E2A16',
  secondary: '#55614D',
};

type ScreenHeaderProps = {
  subtitle: string;
  title: string;
};

export function ScreenHeader({ subtitle, title }: ScreenHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.headingRow}>
        <View style={styles.headingText}>
          <Text style={styles.subtitle}>{subtitle}</Text>
          <Text style={styles.title}>{title}</Text>
        </View>
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