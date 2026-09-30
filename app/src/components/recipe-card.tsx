import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SavedStar } from '@/components/saved-star';
import { describeExpiredInRecipe } from '@/utils/expired-warnings';
import { Recipe } from '@/utils/recipe-prompt';

type RecipeCardProps = {
  recipe: Recipe;
  /** Ticked foods this recipe uses that are past their date, spelled as in the inventory. */
  expiredNames: string[];
  /** Whether the student has starred this recipe into their saved recipes. */
  isSaved: boolean;
  onToggleSaved: () => void;
};

/**
 * One suggested recipe, shown exactly as the model wrote it, plus the red
 * warning the app adds when it uses expired food, and a star to save it.
 */
export function RecipeCard({ recipe, expiredNames, isSaved, onToggleSaved }: RecipeCardProps) {
  const expiredKeys = new Set(expiredNames.map((name) => name.trim().toLowerCase()));

  return (
    <View style={[styles.card, isSaved ? styles.savedCard : null]}>
      <View style={styles.headingRow}>
        <View style={styles.heading}>
          <Text accessibilityRole="header" style={styles.title}>
            {recipe.title}
          </Text>

          <View style={styles.timeRow}>
            <Ionicons color="#59635b" name="time-outline" size={16} />
            <Text style={styles.timeText}>{recipe.minutes} min</Text>
          </View>
        </View>

        <Pressable
          accessibilityLabel={
            isSaved ? `Remove ${recipe.title} from saved recipes` : `Save ${recipe.title}`
          }
          accessibilityRole="button"
          accessibilityState={{ selected: isSaved }}
          onPress={onToggleSaved}
          style={({ pressed }) => [
            styles.starButton,
            isSaved ? styles.savedStarButton : null,
            pressed ? styles.pressed : null,
          ]}
        >
          {isSaved ? (
            <SavedStar size={24} />
          ) : (
            <Ionicons color="#4f5a51" name="star-outline" size={24} />
          )}
        </Pressable>
      </View>

      {expiredNames.length > 0 ? (
        <View style={styles.warning}>
          <Ionicons color="#9f2420" name="warning-outline" size={19} />
          <Text style={styles.warningText}>{describeExpiredInRecipe(expiredNames)}</Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>USES YOUR</Text>

        <View style={styles.chips}>
          {recipe.usesIngredients.map((name, index) => {
            const isExpired = expiredKeys.has(name.trim().toLowerCase());

            return (
              <Text
                key={`${index}-${name}`}
                style={[styles.chip, isExpired ? styles.expiredChip : null]}
              >
                {name}
              </Text>
            );
          })}
        </View>
      </View>

      {recipe.extraIngredients.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ALSO NEED</Text>
          <Text style={styles.bodyText}>{recipe.extraIngredients.join(', ')}</Text>
        </View>
      ) : null}

      <View style={styles.divider} />

      <View style={styles.steps}>
        {recipe.steps.map((step, index) => (
          <View key={`${index}-${step}`} style={styles.step}>
            <Text style={styles.stepNumber}>{index + 1}</Text>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 14,
    borderWidth: 1,
    borderColor: '#dce4da',
    borderRadius: 18,
    backgroundColor: '#ffffff',
    padding: 18,
  },
  savedCard: {
    borderColor: '#ecd48f',
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  heading: {
    flex: 1,
    gap: 6,
  },
  starButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -8,
    marginRight: -8,
    borderRadius: 22,
  },
  savedStarButton: {
    backgroundColor: '#fff4d1',
  },
  pressed: {
    opacity: 0.72,
  },
  title: {
    color: '#172019',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 25,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeText: {
    color: '#59635b',
    fontSize: 14,
    fontWeight: '600',
  },
  warning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 12,
    backgroundColor: '#fde7e5',
    padding: 12,
  },
  warningText: {
    flex: 1,
    color: '#8b2c25',
    fontSize: 13,
    lineHeight: 18,
  },
  section: {
    gap: 6,
  },
  sectionTitle: {
    color: '#687269',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.9,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    overflow: 'hidden',
    borderRadius: 999,
    backgroundColor: '#e7f4e8',
    paddingHorizontal: 10,
    paddingVertical: 5,
    color: '#27652a',
    fontSize: 13,
    fontWeight: '600',
  },
  expiredChip: {
    backgroundColor: '#fde7e5',
    color: '#9f2420',
  },
  bodyText: {
    color: '#263229',
    fontSize: 15,
    lineHeight: 21,
  },
  divider: {
    height: 1,
    backgroundColor: '#eef1ed',
  },
  steps: {
    gap: 12,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  stepNumber: {
    width: 24,
    height: 24,
    overflow: 'hidden',
    borderRadius: 12,
    backgroundColor: '#e7f4e8',
    color: '#27652a',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 24,
    textAlign: 'center',
  },
  stepText: {
    flex: 1,
    color: '#263229',
    fontSize: 15,
    lineHeight: 22,
  },
});
