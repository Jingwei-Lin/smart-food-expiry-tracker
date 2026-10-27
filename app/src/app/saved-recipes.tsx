import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RecipeCard } from '@/components/recipe-card';
import { SavedStar } from '@/components/saved-star';
import { useInventory } from '@/context/inventory-context';
import { useToday } from '@/hooks/use-today';
import { goBackOr } from '@/utils/navigation';
import { findStockedIngredients, listRecipeCandidates } from '@/utils/recipe-ingredients';
import { findExpiredIngredients } from '@/utils/recipe-prompt';
import {
  loadSavedRecipes,
  saveRecipe,
  type SavedRecipe,
  unsaveRecipe,
} from '@/utils/recipe-storage';
import { describeSavedDate } from '@/utils/saved-recipes';

const COLORS = {
  background: '#FFFDF5',
  surface: '#FFFFFF',
  primary: '#1E2A16',
  secondary: '#55614D',
  border: '#E4E5D4',
  subtle: '#F2F3EA',
  gold: '#FFF4D1',
};

/** Whether a recipe's name or any of its ingredients contains what was typed. */
function matchesSearch(entry: SavedRecipe, search: string): boolean {
  const { title, usesIngredients, extraIngredients } = entry.recipe;

  return [title, ...usesIngredients, ...extraIngredients].some((text) =>
    text.toLowerCase().includes(search),
  );
}

const goBack = () => goBackOr('/recipes');

/**
 * The recipes the student starred. They are copies, so they stay here after
 * new ideas replace the suggestions, until the student removes them. A card
 * opens the recipe's own screen; its star removes it, with an Undo in case
 * that was a slip.
 */
export default function SavedRecipesScreen() {
  const insets = useSafeAreaInsets();
  const { activeItems } = useInventory();
  const today = useToday();

  /* undefined while reading. */
  const [saved, setSaved] = useState<SavedRecipe[] | undefined>(undefined);
  /* The recipe just removed, so it can be put back. */
  const [removed, setRemoved] = useState<SavedRecipe | null>(null);
  const [query, setQuery] = useState('');

  /* Read again on every visit: a star changed on a recipe's screen should show here. */
  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      void loadSavedRecipes().then((entries) => {
        if (isActive) {
          setSaved(entries);
        }
      });

      return () => {
        isActive = false;
      };
    }, []),
  );

  async function remove(entry: SavedRecipe) {
    try {
      setSaved(await unsaveRecipe(entry.id));
      setRemoved(entry);
    } catch {
      // Storage failed, so the card stays, showing what is really saved.
    }
  }

  async function undoRemove() {
    if (!removed) {
      return;
    }

    try {
      setSaved(await saveRecipe({ ...removed.recipe, id: removed.id }));
      setRemoved(null);
    } catch {
      // Leave the Undo bar up, so the student can try again.
    }
  }

  /* Today's dates, so a saved recipe warns about food that has expired since it was saved. */
  const candidates = listRecipeCandidates(activeItems, today);

  const search = query.trim().toLowerCase();
  /* Each keeps its place in the whole list, so its colour doesn't change while searching. */
  const shown = (saved ?? [])
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => matchesSearch(entry, search));

  return (
    <View style={styles.screen}>
      <ScrollView
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 110 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Back"
            accessibilityRole="button"
            hitSlop={6}
            onPress={goBack}
            style={({ pressed }) => [styles.backButton, pressed ? styles.pressed : null]}
          >
            <Ionicons color={COLORS.primary} name="chevron-back" size={24} />
          </Pressable>

          <Text accessibilityRole="header" style={styles.title}>
            Saved recipes
          </Text>
        </View>

        {saved === undefined ? (
          <ActivityIndicator color={COLORS.primary} size="large" style={styles.loading} />
        ) : saved.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <SavedStar size={30} />
            </View>
            <Text style={styles.emptyTitle}>Nothing saved yet</Text>
            <Text style={styles.emptyText}>
              Tap the star on a recipe idea to keep it. Saved recipes stay here until you remove
              them.
            </Text>
          </View>
        ) : (
          <>
            {/* Finds a recipe by its name or by any of its ingredients. */}
            <View style={styles.searchBox}>
              <Ionicons color={COLORS.secondary} name="search-outline" size={20} />

              <TextInput
                accessibilityLabel="Search saved recipes"
                autoCorrect={false}
                onChangeText={setQuery}
                placeholder="Search saved recipes"
                placeholderTextColor={COLORS.secondary}
                returnKeyType="search"
                style={styles.searchInput}
                value={query}
              />

              {query.length > 0 ? (
                <Pressable
                  accessibilityLabel="Clear search"
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => setQuery('')}
                >
                  <Ionicons color={COLORS.secondary} name="close-circle" size={18} />
                </Pressable>
              ) : null}
            </View>

            {shown.length === 0 ? (
              <Text style={styles.noMatches}>
                No saved recipes match &ldquo;{query.trim()}&rdquo;. Try a recipe name or an
                ingredient, such as spinach.
              </Text>
            ) : null}

            <View style={styles.cards}>
              {shown.map(({ entry, index }) => (
                <RecipeCard
                  key={entry.id}
                  expiredNames={findExpiredIngredients(
                    entry.recipe,
                    findStockedIngredients(entry.recipe.usesIngredients, candidates),
                  )}
                  index={index}
                  isSaved
                  note={describeSavedDate(entry.savedAt, today)}
                  onOpen={() =>
                    router.push({
                      pathname: '/recipe/[id]',
                      params: { id: entry.id, tint: String(index) },
                    })
                  }
                  onToggleSaved={() => void remove(entry)}
                  recipe={entry.recipe}
                />
              ))}
            </View>
          </>
        )}
      </ScrollView>

      {/* After removing one: a way to put it back. */}
      {removed ? (
        <View
          accessibilityLiveRegion="polite"
          style={[styles.undoBar, { bottom: insets.bottom + 16 }]}
        >
          <Text numberOfLines={2} style={styles.undoText}>
            Removed {removed.recipe.title}
          </Text>

          <Pressable
            accessibilityRole="button"
            onPress={() => void undoRemove()}
            style={({ pressed }) => [styles.undoButton, pressed ? styles.pressed : null]}
          >
            <Text style={styles.undoButtonText}>Undo</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingHorizontal: 20,
  },
  pressed: {
    opacity: 0.72,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 18,
  },
  backButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: COLORS.subtle,
  },
  title: {
    flex: 1,
    color: COLORS.primary,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 26,
    lineHeight: 32,
  },
  loading: {
    marginTop: 40,
  },
  cards: {
    gap: 12,
  },
  searchBox: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: COLORS.subtle,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    color: COLORS.primary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 16,
  },
  noMatches: {
    marginTop: 8,
    color: COLORS.secondary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
  },

  /* Nothing saved */
  empty: {
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 24,
    paddingVertical: 32,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
  },
  emptyIcon: {
    width: 66,
    height: 66,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 33,
    backgroundColor: COLORS.gold,
  },
  emptyTitle: {
    marginTop: 16,
    color: COLORS.primary,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 20,
  },
  emptyText: {
    marginTop: 8,
    color: COLORS.secondary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
  },

  /* Undo bar */
  undoBar: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingLeft: 18,
    paddingRight: 8,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
  },
  undoText: {
    flex: 1,
    color: COLORS.surface,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 15,
  },
  undoButton: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
  },
  undoButtonText: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 15,
  },
});
