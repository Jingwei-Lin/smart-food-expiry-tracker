import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useInventory } from '@/context/inventory-context';
import { describeExpiredInSaved } from '@/utils/expired-warnings';
import { loadSavedRecipes, SavedRecipe, unsaveRecipe } from '@/utils/recipe-storage';
import { describeSavedDate, StockStatus, stockStatus } from '@/utils/saved-recipes';

/* Ingredient chips say whether the food is still in the inventory. */
const CHIP_LOOK: Record<StockStatus, { background: string; color: string; suffix: string }> = {
  'in-stock': { background: '#e7f4e8', color: '#27652a', suffix: '' },
  expired: { background: '#fde7e5', color: '#9f2420', suffix: ' · expired' },
  'not-in-stock': { background: '#eef1ed', color: '#4f5a51', suffix: ' · not in stock' },
};

/**
 * Saved recipes screen.
 *
 * Every recipe the student starred, newest first. Each is a copy, so it stays
 * after new suggestions replace its card, and its ingredient chips are checked
 * against the inventory as it is now. One card is open at a time.
 */
export default function SavedRecipesScreen() {
  const { items, isLoading: isInventoryLoading } = useInventory();

  /* null while the saved list is being read. */
  const [saved, setSaved] = useState<SavedRecipe[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    void loadSavedRecipes().then((entries) => {
      if (isActive) {
        setSaved(entries);
      }
    });

    return () => {
      isActive = false;
    };
  }, []);

  /* The list only changes once the removal is saved. */
  async function remove(id: string) {
    try {
      setSaved(await unsaveRecipe(id));
      setOpenId(null);
    } catch {
      // Storage failed, so the recipe stays listed, which is what is really saved.
    }
  }

  if (saved === null || isInventoryLoading) {
    return (
      <View style={styles.centred}>
        <ActivityIndicator color="#2f7d32" size="large" />
      </View>
    );
  }

  const count = saved.length;

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <Text accessibilityLiveRegion="polite" style={styles.summary}>
        {count === 0
          ? 'Saved recipes stay here until you remove them.'
          : `${count} ${count === 1 ? 'recipe' : 'recipes'} saved. They stay here until you remove them, even when you ask for new ideas.`}
      </Text>

      {count === 0 ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <Ionicons color="#9a6a00" name="star-outline" size={32} />
          </View>

          <Text style={styles.emptyTitle}>Nothing saved yet</Text>
          <Text style={styles.emptyText}>
            Tap the star on a suggestion to keep it here. Saved recipes are not replaced when you
            ask for new ideas.
          </Text>
        </View>
      ) : null}

      <View style={styles.cards}>
        {saved.map((entry) => {
          const { recipe } = entry;
          const isOpen = entry.id === openId;
          const chips = recipe.usesIngredients.map((name) => ({
            name,
            status: stockStatus(name, items),
          }));
          const expiredNames = chips
            .filter((chip) => chip.status === 'expired')
            .map((chip) => chip.name);

          return (
            <View key={entry.id} style={styles.card}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: isOpen }}
                onPress={() => setOpenId(isOpen ? null : entry.id)}
                style={({ pressed }) => [styles.cardHeader, pressed ? styles.pressed : null]}
              >
                <View style={styles.cardHeading}>
                  <Text style={styles.title}>{recipe.title}</Text>

                  <View style={styles.metaRow}>
                    <Ionicons color="#59635b" name="time-outline" size={15} />
                    <Text style={styles.metaText}>
                      {`${recipe.minutes} min · ${describeSavedDate(entry.savedAt)}`}
                    </Text>
                  </View>

                  <View style={styles.chips}>
                    {chips.map((chip, index) => {
                      const look = CHIP_LOOK[chip.status];

                      return (
                        <Text
                          key={`${index}-${chip.name}`}
                          style={[
                            styles.chip,
                            { backgroundColor: look.background, color: look.color },
                          ]}
                        >
                          {`${chip.name}${look.suffix}`}
                        </Text>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.chevron}>
                  <Ionicons
                    color="#687269"
                    name={isOpen ? 'chevron-up' : 'chevron-down'}
                    size={20}
                  />
                </View>
              </Pressable>

              {isOpen ? (
                <View style={styles.details}>
                  {expiredNames.length > 0 ? (
                    <View style={styles.warning}>
                      <Ionicons color="#9f2420" name="warning-outline" size={19} />
                      <Text style={styles.warningText}>{describeExpiredInSaved(expiredNames)}</Text>
                    </View>
                  ) : null}

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

                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void remove(entry.id)}
                    style={({ pressed }) => [styles.removeButton, pressed ? styles.pressed : null]}
                  >
                    <Ionicons color="#9f2420" name="trash-outline" size={17} />
                    <Text style={styles.removeText}>Remove from saved</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f6f8f3',
  },
  centred: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f6f8f3',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 40,
  },
  summary: {
    marginBottom: 14,
    color: '#59635b',
    fontSize: 14,
    lineHeight: 20,
  },
  emptyCard: {
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#dce4da',
    borderRadius: 18,
    backgroundColor: '#ffffff',
    paddingHorizontal: 28,
    paddingVertical: 34,
  },
  emptyIcon: {
    width: 66,
    height: 66,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 33,
    backgroundColor: '#fff4d1',
  },
  emptyTitle: {
    marginTop: 16,
    color: '#172019',
    fontSize: 19,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyText: {
    marginTop: 8,
    color: '#687269',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  cards: {
    gap: 12,
  },
  card: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#dce4da',
    borderRadius: 18,
    backgroundColor: '#ffffff',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingTop: 16,
    paddingRight: 16,
    paddingBottom: 14,
    paddingLeft: 18,
  },
  cardHeading: {
    flex: 1,
    gap: 8,
  },
  title: {
    color: '#172019',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 23,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    color: '#59635b',
    fontSize: 13,
    fontWeight: '600',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: '600',
  },
  chevron: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  details: {
    gap: 14,
    paddingHorizontal: 18,
    paddingBottom: 16,
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
    gap: 4,
  },
  sectionTitle: {
    color: '#687269',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.9,
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
  removeButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 4,
  },
  removeText: {
    color: '#9f2420',
    fontSize: 14,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.72,
  },
});
