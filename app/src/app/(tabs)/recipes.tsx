import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { ComponentProps, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RecipeCard } from '@/components/recipe-card';
import { RecipeChecklist } from '@/components/recipe-checklist';
import { useInventory } from '@/context/inventory-context';
import { fetchRecipeSuggestions, RecipeSuggestionResult } from '@/utils/recipe-client';
import { getRecipeCredentials, RecipeCredentials } from '@/utils/recipe-credentials';
import {
  defaultRecipeSelection,
  listRecipeCandidates,
  RecipeIngredient,
  toRecipeIngredients,
} from '@/utils/recipe-ingredients';
import { findExpiredIngredients, Recipe } from '@/utils/recipe-prompt';

type IconName = ComponentProps<typeof Ionicons>['name'];

type FailedOutcome = Exclude<RecipeSuggestionResult['outcome'], 'ok'>;

/* A request goes idle → loading → done or error. */
type RequestState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; recipes: Recipe[]; ingredients: RecipeIngredient[] }
  | { status: 'error'; outcome: FailedOutcome };

type ErrorCopy = {
  icon: IconName;
  title: string;
  text: string;
  action: 'retry' | 'settings';
};

/* Error card wording. Key problems send the student to settings, since retrying cannot fix them. */
function describeFailure(outcome: FailedOutcome, company: string): ErrorCopy {
  switch (outcome) {
    case 'rejected':
      return {
        icon: 'key-outline',
        title: 'Your API key was rejected',
        text: `${company} no longer accepts the saved key. Update it in recipe settings.`,
        action: 'settings',
      };
    case 'out-of-credit':
      return {
        icon: 'card-outline',
        title: `Your ${company} account is out of credit`,
        text: `Add credit on ${company}'s website, or switch to the other model in recipe settings.`,
        action: 'settings',
      };
    case 'unavailable':
      return {
        icon: 'cloud-offline-outline',
        title: `Couldn't reach ${company}`,
        text: 'Check your connection and try again. The food you ticked is kept.',
        action: 'retry',
      };
    case 'bad-response':
      return {
        icon: 'help-circle-outline',
        title: "Couldn't read the suggestions",
        text: `${company} answered, but not with recipes the app could use. Try again.`,
        action: 'retry',
      };
  }
}

/**
 * Recipes tab.
 *
 * The student ticks the food they want to cook with and asks for ideas. A
 * request is only made when they tap the button, because it is billed to their
 * own API key. Once results arrive the checklist folds into a "cooking with"
 * row so the recipes are what fills the screen.
 */
export default function RecipesScreen() {
  /* ---- State ---- */

  const { activeItems, isLoading: isInventoryLoading } = useInventory();

  /* This screen has no header of its own and sits above the floating tab bar. */
  const insets = useSafeAreaInsets();

  /* undefined while the key is being read; null when there is none. */
  const [credentials, setCredentials] = useState<RecipeCredentials | null | undefined>(undefined);

  /* null until the student changes a tick, so the eat-soon defaults apply until then. */
  const [chosenIds, setChosenIds] = useState<string[] | null>(null);
  const [request, setRequest] = useState<RequestState>({ status: 'idle' });
  const [isChecklistOpen, setIsChecklistOpen] = useState(true);
  const pendingRequest = useRef<AbortController | null>(null);

  /* ---- Checklist rows and ticks ---- */

  const candidates = useMemo(() => listRecipeCandidates(activeItems), [activeItems]);

  /* Ticks for food that has since been eaten or deleted simply drop out. */
  const selectedIds =
    chosenIds === null
      ? defaultRecipeSelection(candidates)
      : chosenIds.filter((id) => candidates.some((candidate) => candidate.id === id));

  /* ---- Effects ---- */

  /* Read the key every time the tab comes into view, so a change made in settings shows at once. */
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === 'web') {
        return undefined;
      }

      let isActive = true;

      getRecipeCredentials()
        .then((saved) => {
          if (isActive) {
            setCredentials(saved);
          }
        })
        .catch(() => {
          if (isActive) {
            setCredentials(null);
          }
        });

      return () => {
        isActive = false;
      };
    }, []),
  );

  /* A request still running when the screen goes away is cancelled, not billed for nothing. */
  useEffect(() => () => pendingRequest.current?.abort(), []);

  /* ---- Actions ---- */

  /* Sends the ticked food to the provider and shows whatever comes back. */
  async function suggestRecipes() {
    const ingredients = toRecipeIngredients(candidates, selectedIds);

    if (!credentials || ingredients.length === 0) {
      return;
    }

    /* Only one request at a time: a new tap cancels the one still running. */
    pendingRequest.current?.abort();
    const controller = new AbortController();
    pendingRequest.current = controller;
    setRequest({ status: 'loading' });

    const result = await fetchRecipeSuggestions(credentials, ingredients, {
      signal: controller.signal,
    });

    /* The screen left, or a newer request replaced this one: its answer no longer matters. */
    if (controller.signal.aborted) {
      return;
    }

    pendingRequest.current = null;

    if (result.outcome === 'ok') {
      setRequest({ status: 'done', recipes: result.recipes, ingredients });
      setIsChecklistOpen(false);
    } else {
      setRequest({ status: 'error', outcome: result.outcome });
    }
  }

  function openSettings() {
    router.push('/recipe-settings');
  }

  /* ---- Header: title, subtitle, and the model pill that opens settings ---- */

  const header = (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <Text accessibilityRole="header" style={styles.title}>
          Recipes
        </Text>
        <Text style={styles.subtitle}>
          {request.status === 'done' && !isChecklistOpen
            ? 'Ideas for the food you ticked.'
            : 'Tick the food you want to cook with.'}
        </Text>
      </View>

      {credentials ? (
        <Pressable
          accessibilityLabel={`Recipe settings, using ${credentials.provider.label}`}
          accessibilityRole="button"
          onPress={openSettings}
          style={({ pressed }) => [styles.modelPill, pressed ? styles.pressed : null]}
        >
          <Text style={styles.modelPillText}>{credentials.provider.label}</Text>
          <Ionicons color="#263229" name="options-outline" size={18} />
        </Pressable>
      ) : null}
    </View>
  );

  /* ---- Screens that replace the whole tab ---- */

  /* Web: there is no secure storage for the key. */
  if (Platform.OS === 'web') {
    return (
      <View style={[styles.centred, { paddingTop: insets.top }]}>
        <Text style={styles.noticeText}>Recipe suggestions are available in the mobile app.</Text>
      </View>
    );
  }

  /* Still reading the inventory or the key. */
  if (isInventoryLoading || credentials === undefined) {
    return (
      <View style={styles.centred}>
        <ActivityIndicator color="#2f7d32" size="large" />
      </View>
    );
  }

  const contentStyle = [
    styles.content,
    { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 124 },
  ];

  /* No key saved: the set-up card. */
  if (credentials === null) {
    return (
      <ScrollView contentContainerStyle={contentStyle} style={styles.screen}>
        {header}

        <View style={styles.infoCard}>
          <View style={styles.infoIcon}>
            <Ionicons color="#2f7d32" name="key-outline" size={32} />
          </View>

          <Text style={styles.infoTitle}>Set up recipe suggestions</Text>
          <Text style={styles.infoText}>
            Recipes come from an AI model using your own API key. Choose GPT-5.4 mini or DeepSeek
            Flash, then paste a key from that provider. Your key stays on this phone, and requests
            are billed to your provider account.
          </Text>

          <Pressable
            accessibilityRole="button"
            onPress={openSettings}
            style={({ pressed }) => [styles.primaryButton, pressed ? styles.pressed : null]}
          >
            <Text style={styles.primaryButtonText}>Set up</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  /* Empty inventory: nothing to tick, so no request can be made. */
  if (candidates.length === 0) {
    return (
      <ScrollView contentContainerStyle={contentStyle} style={styles.screen}>
        {header}

        <View style={styles.infoCard}>
          <View style={styles.infoIcon}>
            <Ionicons color="#2f7d32" name="basket-outline" size={34} />
          </View>

          <Text style={styles.infoTitle}>Nothing to cook with yet</Text>
          <Text style={styles.infoText}>
            Add food to your inventory and it will show up here to pick from.
          </Text>

          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/scan')}
            style={({ pressed }) => [styles.outlineButton, pressed ? styles.pressed : null]}
          >
            <Text style={styles.outlineButtonText}>Scan an item</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  /* ---- Main screen ---- */

  const isLoading = request.status === 'loading';
  const tickedCount = selectedIds.length;
  const failure =
    request.status === 'error'
      ? describeFailure(request.outcome, credentials.provider.company)
      : null;

  return (
    <ScrollView
      contentContainerStyle={contentStyle}
      showsVerticalScrollIndicator={false}
      style={styles.screen}
    >
      {header}

      {/* After results: the ticked food folds into "cooking with" chips. */}
      {request.status === 'done' && !isChecklistOpen ? (
        <View>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>COOKING WITH</Text>

            <Pressable
              accessibilityRole="button"
              onPress={() => setIsChecklistOpen(true)}
              style={({ pressed }) => [styles.textButton, pressed ? styles.pressed : null]}
            >
              <Text style={styles.textButtonText}>Change</Text>
            </Pressable>
          </View>

          <View style={styles.chipCard}>
            {request.ingredients.map((ingredient) => {
              const isExpired = ingredient.daysLeft < 0;

              return (
                <View
                  key={ingredient.name}
                  style={[styles.chip, isExpired ? styles.expiredChip : null]}
                >
                  {isExpired ? <Ionicons color="#9f2420" name="warning-outline" size={14} /> : null}
                  <Text style={[styles.chipText, isExpired ? styles.expiredChipText : null]}>
                    {isExpired ? `${ingredient.name} · expired` : ingredient.name}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      ) : (
        /* Otherwise: the checklist and the Suggest button. */
        <View style={styles.checklist}>
          <RecipeChecklist
            candidates={candidates}
            disabled={isLoading}
            onChange={setChosenIds}
            selectedIds={selectedIds}
          />

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: isLoading || tickedCount === 0, busy: isLoading }}
            disabled={isLoading || tickedCount === 0}
            onPress={() => void suggestRecipes()}
            style={({ pressed }) => [
              styles.primaryButton,
              isLoading || tickedCount === 0 ? styles.disabledButton : null,
              pressed ? styles.pressed : null,
            ]}
          >
            {isLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Ionicons color="#ffffff" name="restaurant-outline" size={20} />
            )}
            <Text style={styles.primaryButtonText}>
              {isLoading
                ? 'Finding recipes…'
                : tickedCount === 0
                  ? 'Tick at least one food'
                  : `Suggest recipes (${tickedCount})`}
            </Text>
          </Pressable>
        </View>
      )}

      {/* A failed request: what went wrong and what to do next. */}
      {failure ? (
        <View accessibilityLiveRegion="polite" style={styles.infoCard}>
          <View style={[styles.infoIcon, styles.errorIcon]}>
            <Ionicons color="#9f2420" name={failure.icon} size={32} />
          </View>

          <Text style={styles.infoTitle}>{failure.title}</Text>
          <Text style={styles.infoText}>{failure.text}</Text>

          <Pressable
            accessibilityRole="button"
            onPress={failure.action === 'retry' ? () => void suggestRecipes() : openSettings}
            style={({ pressed }) => [styles.outlineButton, pressed ? styles.pressed : null]}
          >
            <Text style={styles.outlineButtonText}>
              {failure.action === 'retry' ? 'Try again' : 'Update key'}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* The suggested recipes, each with the app's own red warning if it uses expired food. */}
      {request.status === 'done' ? (
        <View style={styles.results}>
          <Text style={styles.sectionTitle}>SUGGESTIONS</Text>

          {request.recipes.map((recipe, index) => (
            <RecipeCard
              key={`${index}-${recipe.title}`}
              expiredNames={findExpiredIngredients(recipe, request.ingredients)}
              recipe={recipe}
            />
          ))}

          <Text style={styles.footnote}>
            AI-generated. Check ingredients for allergies before cooking.
          </Text>
        </View>
      ) : null}
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
    paddingHorizontal: 32,
  },
  noticeText: {
    color: '#59635b',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  content: {
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  headerText: {
    flex: 1,
    gap: 5,
  },
  title: {
    color: '#172019',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  subtitle: {
    color: '#59635b',
    fontSize: 15,
    lineHeight: 22,
  },
  modelPill: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
    borderWidth: 1,
    borderColor: '#dce4da',
    borderRadius: 999,
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
  },
  modelPillText: {
    color: '#263229',
    fontSize: 13,
    fontWeight: '700',
  },
  checklist: {
    marginTop: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 6,
  },
  sectionTitle: {
    flex: 1,
    color: '#687269',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.9,
  },
  textButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingLeft: 10,
  },
  textButtonText: {
    color: '#2f7d32',
    fontSize: 14,
    fontWeight: '700',
  },
  chipCard: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    borderWidth: 1,
    borderColor: '#dce4da',
    borderRadius: 14,
    backgroundColor: '#ffffff',
    padding: 14,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    backgroundColor: '#e7f4e8',
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  expiredChip: {
    backgroundColor: '#fde7e5',
  },
  chipText: {
    color: '#27652a',
    fontSize: 14,
    fontWeight: '600',
  },
  expiredChipText: {
    color: '#9f2420',
  },
  primaryButton: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    alignSelf: 'stretch',
    borderRadius: 14,
    backgroundColor: '#2f7d32',
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.55,
  },
  outlineButton: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#2f7d32',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    paddingHorizontal: 22,
  },
  outlineButtonText: {
    color: '#2f7d32',
    fontSize: 14,
    fontWeight: '700',
  },
  infoCard: {
    alignItems: 'center',
    marginTop: 22,
    borderWidth: 1,
    borderColor: '#dce4da',
    borderRadius: 18,
    backgroundColor: '#ffffff',
    paddingHorizontal: 26,
    paddingVertical: 30,
  },
  infoIcon: {
    width: 66,
    height: 66,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 33,
    backgroundColor: '#e7f4e8',
  },
  errorIcon: {
    backgroundColor: '#fde7e5',
  },
  infoTitle: {
    marginTop: 16,
    color: '#172019',
    fontSize: 19,
    fontWeight: '700',
    textAlign: 'center',
  },
  infoText: {
    marginTop: 8,
    color: '#59635b',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  results: {
    gap: 16,
    marginTop: 26,
  },
  footnote: {
    color: '#687269',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.72,
  },
});
