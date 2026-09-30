import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SavedStar } from '@/components/saved-star';

type SavedRecipesBoxProps = {
  count: number;
  onPress: () => void;
};

/**
 * The way into the saved recipes, shown under the Recipes header on every
 * state of the tab. Saved recipes need no key and no inventory, so the box is
 * there even when suggestions are not.
 */
export function SavedRecipesBox({ count, onPress }: SavedRecipesBoxProps) {
  const subtitle = count === 0 ? 'Nothing saved yet' : `${count} saved`;

  return (
    <Pressable
      accessibilityLabel={`Saved recipes, ${subtitle}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.box, pressed ? styles.pressed : null]}
    >
      <View style={styles.starCircle}>
        <SavedStar size={20} />
      </View>

      <View style={styles.text}>
        <Text style={styles.title}>Saved recipes</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

      <Ionicons color="#687269" name="chevron-forward" size={18} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#dce4da',
    borderRadius: 14,
    backgroundColor: '#ffffff',
    paddingLeft: 12,
    paddingRight: 14,
  },
  starCircle: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: '#fff4d1',
  },
  text: {
    flex: 1,
    gap: 1,
  },
  title: {
    color: '#172019',
    fontSize: 16,
    fontWeight: '600',
  },
  subtitle: {
    color: '#59635b',
    fontSize: 13,
  },
  pressed: {
    opacity: 0.72,
  },
});
