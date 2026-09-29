import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

/**
 * The gold star that marks a saved recipe. Plain yellow is too faint on
 * white, and Ionicons has no filled star with a different outline, so a
 * darker outline is drawn over a filled star.
 */
export function SavedStar({ size }: { size: number }) {
  return (
    <View>
      <Ionicons color="#f6b90b" name="star" size={size} />
      <Ionicons color="#9a6a00" name="star-outline" size={size} style={styles.outline} />
    </View>
  );
}

const styles = StyleSheet.create({
  outline: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});
