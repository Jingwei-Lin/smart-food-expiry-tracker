import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

type PlaceholderScreenProps = {
  title: string;
  /** Short label shown above the description, e.g. "Coming soon". */
  status: string;
  description: string;
  children?: ReactNode;
};

/**
 * Shared layout for screens whose functionality is still being built.
 *
 * Shows the screen's name, a short status label and a plain description of what
 * the screen will do, so an unfinished screen reads as deliberate rather than
 * broken. Remove this component once every screen using it is implemented.
 */
export function PlaceholderScreen({
  title,
  status,
  description,
  children,
}: PlaceholderScreenProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.status}>{status}</Text>
      <Text style={styles.description}>{description}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
  },
  status: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2f7d32',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  description: {
    fontSize: 15,
    color: '#555',
    textAlign: 'center',
    lineHeight: 21,
  },
});
