import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DishArt } from '@/components/dish-art';
import { SavedStar } from '@/components/saved-star';
import { describeExpiredInRecipe } from '@/utils/expired-warnings';
import { Recipe } from '@/utils/recipe-prompt';

const COLORS = {
  surface: '#FFFFFF',
  primary: '#1E2A16',
  secondary: '#55614D',
  border: '#E4E5D4',
  savedBorder: '#ECD48F',
  error: '#8B2C25',
  errorSoft: '#FDE7E5',
};

/* The picture tiles take turns through these, as in the design: tile colour, then bowl colour. */
const TILE_LOOKS = [
  { tint: '#F0F7DB', bowl: '#F2C97D' },
  { tint: '#FBEFF2', bowl: '#F2D2A2' },
  { tint: '#FFF0D5', bowl: '#FCE7A6' },
];

type RecipeCardProps = {
  recipe: Recipe;
  /** Ticked foods this recipe uses that are past their date, spelled as in the inventory. */
  expiredNames: string[];
  /** Whether the student has starred this recipe into their saved recipes. */
  isSaved: boolean;
  onToggleSaved: () => void;
  /** Where the card sits in the list, which picks its tile colour. */
  index?: number;
  /** Opens the recipe's steps. Without it the card can't be tapped. */
  onOpen?: () => void;
  /** Shown after the time, e.g. "Saved today" on the Saved recipes screen. */
  note?: string;
};

/**
 * One suggested recipe as a compact card: a picture tile, the title and time,
 * the food it uses and what else it needs, and a star to save it. The steps
 * are on the recipe's own screen. The app's red warning shows here too when
 * the recipe uses expired food, so it is seen before the recipe is opened.
 */
export function RecipeCard({
  recipe,
  expiredNames,
  isSaved,
  onToggleSaved,
  index = 0,
  onOpen,
  note,
}: RecipeCardProps) {
  const look = TILE_LOOKS[index % TILE_LOOKS.length];

  return (
    <View style={[styles.card, isSaved ? styles.savedCard : null]}>
      {/*
       * The picture and text are the tap target, and the star is a separate
       * button beside them, so screen readers can reach both.
       */}
      <Pressable
        accessibilityHint={onOpen ? 'Opens the steps' : undefined}
        accessibilityRole={onOpen ? 'button' : undefined}
        accessible={Boolean(onOpen)}
        disabled={!onOpen}
        onPress={onOpen}
        style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
      >
        <View style={[styles.tile, { backgroundColor: look.tint }]}>
          {/* The details screen's bowl, shrunk to fit the tile. */}
          <View style={styles.tileArt}>
            <DishArt bowlColor={look.bowl} />
          </View>
        </View>

        <View style={styles.text}>
          <Text accessibilityRole="header" style={styles.title}>
            {recipe.title}
          </Text>

          <Text style={styles.meta}>
            {note ? `${recipe.minutes} min · ${note}` : `${recipe.minutes} min`}
          </Text>

          <Text style={styles.uses}>
            <Text style={styles.usesLabel}>Uses </Text>
            {recipe.usesIngredients.join(', ')}
          </Text>

          {recipe.extraIngredients.length > 0 ? (
            <Text style={styles.needs}>Also needs {recipe.extraIngredients.join(', ')}</Text>
          ) : null}
        </View>
      </Pressable>

      {/* Its own button, so saving never opens the recipe. */}
      <Pressable
        accessibilityLabel={
          isSaved ? `Remove ${recipe.title} from saved recipes` : `Save ${recipe.title}`
        }
        accessibilityRole="button"
        accessibilityState={{ selected: isSaved }}
        hitSlop={4}
        onPress={onToggleSaved}
        style={({ pressed }) => [styles.starButton, pressed ? styles.pressed : null]}
      >
        {isSaved ? (
          <SavedStar size={24} />
        ) : (
          <Ionicons color={COLORS.primary} name="star-outline" size={24} />
        )}
      </Pressable>

      {expiredNames.length > 0 ? (
        <View style={styles.warning}>
          <Ionicons color={COLORS.error} name="warning-outline" size={19} />
          <Text style={styles.warningText}>{describeExpiredInRecipe(expiredNames)}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    padding: 14,
  },
  savedCard: {
    borderColor: COLORS.savedBorder,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  tile: {
    overflow: 'hidden',
    width: 84,
    height: 84,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  tileArt: {
    transform: [{ scale: 0.46 }],
  },
  /* Room on the right for the star. */
  text: {
    flex: 1,
    gap: 4,
    paddingRight: 30,
  },
  title: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 17,
    lineHeight: 22,
  },
  meta: {
    color: COLORS.secondary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 14,
  },
  uses: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 14,
    lineHeight: 19,
  },
  usesLabel: {
    fontFamily: 'Fredoka_600SemiBold',
  },
  needs: {
    color: COLORS.secondary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 14,
    lineHeight: 19,
  },
  starButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  warning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 14,
    backgroundColor: COLORS.errorSoft,
    padding: 12,
  },
  warningText: {
    flex: 1,
    color: COLORS.error,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 13,
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.72,
  },
});
