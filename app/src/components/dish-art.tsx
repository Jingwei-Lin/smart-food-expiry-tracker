import { StyleSheet, View } from 'react-native';

const INK = '#1E2A16';
const HERB = '#4E7A1F';

type DishArtProps = {
  /** The bowl's colour. The design uses a warm yellow. */
  bowlColor?: string;
};

/**
 * The bowl drawing from the Recipe details design, built from plain shapes
 * so the app needs no SVG library: two wisps of steam, a scoop of food with
 * herbs on top, and a round-bottomed bowl, all with the app's ink outline.
 * It is decoration only, so screen readers skip it.
 */
export function DishArt({ bowlColor = '#F2C97D' }: DishArtProps) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.art}
    >
      {/* Steam */}
      <View style={styles.steamRow}>
        <View style={[styles.steam, styles.steamLeft]} />
        <View style={[styles.steam, styles.steamRight]} />
      </View>

      {/* Food heaped above the rim, with two herb leaves */}
      <View style={styles.food}>
        <View style={[styles.scoop, styles.scoopSide]} />
        <View style={[styles.scoop, styles.scoopMiddle]} />
        <View style={[styles.scoop, styles.scoopSide]} />
        <View style={[styles.herb, styles.herbLeft]} />
        <View style={[styles.herb, styles.herbRight]} />
      </View>

      {/* Bowl */}
      <View style={[styles.bowl, { backgroundColor: bowlColor }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  art: {
    alignItems: 'center',
    width: 132,
  },
  steamRow: {
    flexDirection: 'row',
    gap: 18,
    marginBottom: -2,
  },
  steam: {
    width: 10,
    height: 26,
    borderLeftWidth: 4,
    borderColor: INK,
    borderRadius: 10,
  },
  steamLeft: {
    transform: [{ rotate: '-12deg' }],
  },
  steamRight: {
    transform: [{ rotate: '12deg' }],
  },
  food: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: -14,
    zIndex: 0,
  },
  scoop: {
    borderWidth: 4,
    borderColor: INK,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
  scoopSide: {
    width: 38,
    height: 30,
    marginHorizontal: -6,
  },
  scoopMiddle: {
    width: 46,
    height: 40,
    zIndex: 1,
  },
  herb: {
    position: 'absolute',
    top: 12,
    width: 16,
    height: 6,
    borderTopWidth: 4,
    borderColor: HERB,
    borderRadius: 8,
    zIndex: 2,
  },
  herbLeft: {
    left: 14,
    transform: [{ rotate: '-18deg' }],
  },
  herbRight: {
    right: 18,
    transform: [{ rotate: '14deg' }],
  },
  bowl: {
    width: 128,
    height: 64,
    borderWidth: 4,
    borderColor: INK,
    borderBottomLeftRadius: 64,
    borderBottomRightRadius: 64,
    zIndex: 3,
  },
});
