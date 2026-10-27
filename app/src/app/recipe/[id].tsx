import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DishArt } from '@/components/dish-art';
import { SavedStar } from '@/components/saved-star';
import { useInventory } from '@/context/inventory-context';
import { useToday } from '@/hooks/use-today';
import { describeExpiredInRecipe, joinNames } from '@/utils/expired-warnings';
import { goBackOr } from '@/utils/navigation';
import {
  findStockedIngredients,
  findUsedItemIds,
  listRecipeCandidates,
} from '@/utils/recipe-ingredients';
import { findExpiredIngredients, type Recipe } from '@/utils/recipe-prompt';
import {
  loadRecipeSnapshot,
  loadSavedRecipes,
  saveRecipe,
  type SavedRecipe,
  unsaveRecipe,
} from '@/utils/recipe-storage';

const COLORS = {
  background: '#FFFDF5',
  surface: '#FFFFFF',
  primary: '#1E2A16',
  secondary: '#55614D',
  border: '#E4E5D4',
  divider: '#EEEFE5',
  accent: '#A6D45A',
  accentSoft: '#F0F7DB',
  error: '#8B2C25',
  errorSoft: '#FDE7E5',
  link: '#4E7A1F',
};

/* The same tints as the cards, so the top of the screen matches the card that was tapped. */
const HERO_TINTS = ['#DDEFB8', '#FBE1E8', '#FFE9BF'];

type DetailParams = {
  /** The recipe's id, from the suggestions or the saved recipes. */
  id: string;
  /** The card's place in the list, which picks the colour. */
  tint?: string;
};

/**
 * undefined while reading, null when the recipe can't be found. `tickedIds`
 * are the items ticked for the suggestions it came from; a recipe opened from
 * the saved list has none.
 */
type Loaded = { recipe: Recipe; saved: SavedRecipe[]; tickedIds: string[] } | null | undefined;

/*
 * "From your fridge" chips are dark, with two exceptions so
 * nothing is missed: food past its date is light red with a warning icon, and
 * food no longer in the fridge (often the case for a recipe saved a while
 * ago) is just outlined and says so.
 */
function fridgeChip(daysLeft: number): {
  background: string;
  border: string;
  color: string;
  label: (name: string) => string;
} {
  if (!Number.isFinite(daysLeft)) {
    return {
      background: COLORS.surface,
      border: COLORS.border,
      color: COLORS.secondary,
      label: (name) => `${name} · not in stock`,
    };
  }

  return daysLeft < 0
    ? {
        background: COLORS.errorSoft,
        border: COLORS.errorSoft,
        color: COLORS.error,
        label: (name) => `${name} · expired`,
      }
    : {
        background: COLORS.primary,
        border: COLORS.primary,
        color: COLORS.surface,
        label: (name) => name,
      };
}

/* What each button records, in the words the confirmation uses. */
const OUTCOME_WORDS: Record<'eaten' | 'discarded', string> = {
  eaten: 'eaten',
  discarded: 'thrown out',
};

const goBack = () => goBackOr('/recipes');

/**
 * One recipe with its steps. It is looked up by id in the last suggestions,
 * then in the saved recipes, so a saved recipe still opens after new
 * suggestions have replaced its card.
 */
export default function RecipeDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id, tint } = useLocalSearchParams<DetailParams>();
  const { activeItems, resolveItem } = useInventory();
  const today = useToday();
  const [loaded, setLoaded] = useState<Loaded>(undefined);
  /* The outcome being saved, so only the pressed button says "Saving…". */
  const [markingStatus, setMarkingStatus] = useState<'eaten' | 'discarded' | null>(null);
  const isMarking = markingStatus !== null;
  const [markError, setMarkError] = useState<string | null>(null);
  /* What was just marked, for the confirmation; null until then. */
  const [marked, setMarked] = useState<{ names: string[]; status: 'eaten' | 'discarded' } | null>(
    null,
  );

  useEffect(() => {
    let isActive = true;

    void Promise.all([loadRecipeSnapshot(), loadSavedRecipes()]).then(([snapshot, saved]) => {
      if (!isActive) {
        return;
      }

      const suggested = snapshot?.lastResult?.recipes.find((recipe) => recipe.id === id);
      const recipe = suggested ?? saved.find((entry) => entry.id === id)?.recipe;
      const tickedIds = suggested ? (snapshot?.lastResult?.forIds ?? []) : [];

      setLoaded(recipe ? { recipe, saved, tickedIds } : null);
    });

    return () => {
      isActive = false;
    };
  }, [id]);

  if (loaded === undefined) {
    return (
      <View style={[styles.screen, styles.centred]}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  if (loaded === null) {
    return (
      <View style={[styles.screen, styles.centred, { paddingTop: insets.top }]}>
        <Text style={styles.missingTitle}>This recipe isn&apos;t here any more</Text>
        <Text style={styles.missingText}>New ideas may have replaced it. Save one to keep it.</Text>

        <Pressable
          accessibilityRole="button"
          onPress={goBack}
          style={({ pressed }) => [styles.missingButton, pressed ? styles.pressed : null]}
        >
          <Text style={styles.missingButtonText}>Back to recipes</Text>
        </Pressable>
      </View>
    );
  }

  const { recipe, saved, tickedIds } = loaded;
  const isSaved = saved.some((entry) => entry.id === id);

  /* Today's dates, so food that has expired since the recipe was suggested is flagged. */
  const candidates = listRecipeCandidates(activeItems, today);
  const fridge = findStockedIngredients(recipe.usesIngredients, candidates, tickedIds);
  const expiredNames = findExpiredIngredients(recipe, fridge);
  const heroTint = HERO_TINTS[Number(tint ?? 0) % HERO_TINTS.length] ?? HERO_TINTS[0];
  const usedItems = findUsedItemIds(recipe.usesIngredients, candidates, tickedIds).flatMap(
    (usedId) => activeItems.filter((item) => item.id === usedId),
  );
  const usedNames = joinNames(usedItems.map((item) => item.name));

  /**
   * Records the recipe's food as eaten or thrown out, which takes it out of
   * the inventory and counts it in the weekly summary.
   */
  async function markUsedFood(status: 'eaten' | 'discarded') {
    if (usedItems.length === 0 || isMarking) {
      return;
    }

    setMarkingStatus(status);
    setMarkError(null);

    try {
      // One at a time, since each save writes the whole inventory.
      for (const item of usedItems) {
        await resolveItem(item.id, status);
      }

      setMarked({ names: usedItems.map((item) => item.name), status });
    } catch {
      setMarkError("Some food couldn't be updated. Please try again.");
    } finally {
      setMarkingStatus(null);
    }
  }

  /* The star fills or empties only once the change is saved, as on the cards. */
  async function toggleSaved() {
    try {
      const next = isSaved ? await unsaveRecipe(id) : await saveRecipe({ ...recipe, id });

      setLoaded({ recipe, saved: next, tickedIds });
    } catch {
      // Storage failed, so the star keeps showing what is really saved.
    }
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 150 }}
        showsVerticalScrollIndicator={false}
      >
        {/* A rounded card with the bowl drawing, tinted like the card that was tapped */}
        <View style={[styles.hero, { backgroundColor: heroTint, marginTop: insets.top + 12 }]}>
          <Pressable
            accessibilityLabel="Back"
            accessibilityRole="button"
            hitSlop={8}
            onPress={goBack}
            style={({ pressed }) => [styles.roundButton, pressed ? styles.pressed : null]}
          >
            <Ionicons color={COLORS.primary} name="chevron-back" size={24} />
          </Pressable>

          <DishArt />
        </View>

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <View style={styles.titleText}>
              <Text accessibilityRole="header" style={styles.title}>
                {recipe.title}
              </Text>
              <Text style={styles.meta}>{recipe.minutes} min</Text>
            </View>

            <Pressable
              accessibilityLabel={
                isSaved ? `Remove ${recipe.title} from saved recipes` : `Save ${recipe.title}`
              }
              accessibilityRole="button"
              accessibilityState={{ selected: isSaved }}
              hitSlop={4}
              onPress={() => void toggleSaved()}
              style={({ pressed }) => [styles.starButton, pressed ? styles.pressed : null]}
            >
              {isSaved ? (
                <SavedStar size={26} />
              ) : (
                <Ionicons color={COLORS.primary} name="star-outline" size={26} />
              )}
            </Pressable>
          </View>

          {expiredNames.length > 0 ? (
            <View accessibilityLiveRegion="polite" style={styles.warning}>
              <Ionicons color={COLORS.error} name="warning-outline" size={19} />
              <Text style={styles.warningText}>{describeExpiredInRecipe(expiredNames)}</Text>
            </View>
          ) : null}

          <Text style={styles.sectionTitle}>FROM YOUR FRIDGE</Text>
          <View style={styles.chips}>
            {fridge.map((ingredient, index) => {
              const chip = fridgeChip(ingredient.daysLeft);

              return (
                <View
                  key={`${index}-${ingredient.name}`}
                  style={[
                    styles.chip,
                    { backgroundColor: chip.background, borderColor: chip.border },
                  ]}
                >
                  {ingredient.daysLeft < 0 ? (
                    <Ionicons color={COLORS.error} name="warning-outline" size={14} />
                  ) : null}
                  <Text style={[styles.chipText, { color: chip.color }]}>
                    {chip.label(ingredient.name)}
                  </Text>
                </View>
              );
            })}
          </View>

          {recipe.extraIngredients.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>YOU&apos;LL ALSO NEED</Text>
              <View style={styles.chips}>
                {recipe.extraIngredients.map((name, index) => (
                  <View key={`${index}-${name}`} style={[styles.chip, styles.extraChip]}>
                    <Text style={styles.chipText}>{name}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          <Text style={styles.sectionTitle}>METHOD</Text>
          <View style={styles.steps}>
            {recipe.steps.map((step, index) => (
              <View key={`${index}-${step}`} style={styles.step}>
                <View style={[styles.stepNumber, index === 0 ? styles.stepNumberFirst : null]}>
                  <Text
                    style={[styles.stepNumberText, index === 0 ? styles.stepNumberTextFirst : null]}
                  >
                    {index + 1}
                  </Text>
                </View>
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.footnote}>
            AI-generated. Check ingredients for allergies, and cook meat and eggs through.
          </Text>
        </View>
      </ScrollView>

      {/* Fixed to the bottom: what happened to the food, or a note once it's done */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        {marked ? (
          <View style={styles.done}>
            <Ionicons color={COLORS.link} name="checkmark-circle" size={26} />
            <Text style={styles.doneText}>
              {joinNames(marked.names)} {marked.names.length === 1 ? 'is' : 'are'} marked as{' '}
              {OUTCOME_WORDS[marked.status]}.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={goBack}
              style={({ pressed }) => [styles.doneButton, pressed ? styles.pressed : null]}
            >
              <Text style={styles.doneButtonText}>Done</Text>
            </Pressable>
          </View>
        ) : usedItems.length === 0 ? (
          <Text style={styles.barNote}>None of this recipe&apos;s food is in your fridge now.</Text>
        ) : (
          <>
            {/* The note above the buttons only appears if saving fails. */}
            {markError ? <Text style={styles.barError}>{markError}</Text> : null}

            <View style={styles.barButtons}>
              <Pressable
                accessibilityLabel={`Mark ${usedNames} as thrown out`}
                accessibilityRole="button"
                accessibilityState={{ disabled: isMarking, busy: markingStatus === 'discarded' }}
                disabled={isMarking}
                onPress={() => void markUsedFood('discarded')}
                style={({ pressed }) => [styles.wastedButton, pressed ? styles.pressed : null]}
              >
                <Text style={styles.wastedText}>
                  {markingStatus === 'discarded' ? 'Saving…' : 'Mark as wasted'}
                </Text>
              </Pressable>

              <Pressable
                accessibilityLabel={`Mark ${usedNames} as eaten`}
                accessibilityRole="button"
                accessibilityState={{ disabled: isMarking, busy: markingStatus === 'eaten' }}
                disabled={isMarking}
                onPress={() => void markUsedFood('eaten')}
                style={({ pressed }) => [styles.consumedButton, pressed ? styles.pressed : null]}
              >
                <Text style={styles.consumedText}>
                  {markingStatus === 'eaten' ? 'Saving…' : 'Mark as consumed'}
                </Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centred: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  pressed: {
    opacity: 0.72,
  },

  /* Top of the screen */
  hero: {
    height: 230,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    borderRadius: 28,
  },
  roundButton: {
    position: 'absolute',
    top: 14,
    left: 14,
    alignItems: 'center',
    justifyContent: 'center',
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
  },

  /* Title, ingredients and steps */
  body: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  titleText: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 26,
    lineHeight: 32,
  },
  meta: {
    color: COLORS.secondary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 15,
  },
  starButton: {
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
    marginTop: 16,
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
  sectionTitle: {
    marginTop: 22,
    marginBottom: 10,
    color: COLORS.secondary,
    fontFamily: 'Fredoka_500Medium',
    fontSize: 12,
    letterSpacing: 0.9,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  extraChip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  chipText: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_500Medium',
    fontSize: 15,
  },
  steps: {
    gap: 14,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  stepNumber: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: COLORS.accentSoft,
  },
  stepNumberFirst: {
    backgroundColor: COLORS.primary,
  },
  stepNumberText: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 14,
  },
  stepNumberTextFirst: {
    color: COLORS.surface,
  },
  stepText: {
    flex: 1,
    paddingTop: 3,
    color: COLORS.primary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 16,
    lineHeight: 23,
  },
  footnote: {
    marginTop: 24,
    color: COLORS.secondary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 12,
    lineHeight: 17,
  },

  /* Bottom bar */
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: 10,
    paddingTop: 12,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    backgroundColor: COLORS.background,
  },
  barNote: {
    color: COLORS.secondary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 13,
    textAlign: 'center',
  },
  barError: {
    color: COLORS.error,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 14,
    textAlign: 'center',
  },
  barButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  wastedButton: {
    flex: 1,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
  },
  wastedText: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 16,
  },
  consumedButton: {
    flex: 1,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: COLORS.accent,
  },
  consumedText: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 16,
  },
  done: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 54,
  },
  doneText: {
    flex: 1,
    color: COLORS.primary,
    fontFamily: 'Fredoka_500Medium',
    fontSize: 15,
    lineHeight: 20,
  },
  doneButton: {
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: COLORS.primary,
  },
  doneButtonText: {
    color: COLORS.surface,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 15,
  },

  /* Shown when the recipe can't be found */
  missingTitle: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 20,
    textAlign: 'center',
  },
  missingText: {
    marginTop: 8,
    color: COLORS.secondary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 15,
    textAlign: 'center',
  },
  missingButton: {
    justifyContent: 'center',
    minHeight: 48,
    marginTop: 24,
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: COLORS.accent,
  },
  missingButtonText: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 15,
  },
});
