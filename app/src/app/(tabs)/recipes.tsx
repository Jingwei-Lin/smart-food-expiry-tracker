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
  findRecipeIngredients,
  listRecipeCandidates,
  RecipeIngredient,
  toRecipeIngredients,
} from '@/utils/recipe-ingredients';
import { findExpiredIngredients, rememberShownTitles } from '@/utils/recipe-prompt';
import {
  loadRecipeSnapshot,
  RecipeScreenSnapshot,
  saveRecipeSnapshot,
  SuggestedRecipe,
  toSuggestedRecipes,
} from '@/utils/recipe-storage';

type IconName = ComponentProps<typeof Ionicons>['name'];

type FailedOutcome = Exclude<RecipeSuggestionResult['outcome'], 'ok'>;

/*
 * A request goes idle → loading → done or error. Results keep the names of the
 * food they were for; the dates are read from the inventory each time they are
 * shown, so a result restored the next day is still right about expired food.
 */
type RequestState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; recipes: SuggestedRecipe[]; forNames: string[] }
  | { status: 'error'; outcome: FailedOutcome; forNames: string[] };

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
        text: `Add credit on ${company}'s website, or switch to another model in recipe settings.`,
        action: 'settings',
      };
    case 'busy':
      return {
        icon: 'hourglass-outline',
        title: `${company} is busy right now`,
        text: 'Too many requests are reaching it at once. Wait a moment and try again. The food you ticked is kept.',
        action: 'retry',
      };
    case 'request-refused':
      return {
        icon: 'alert-circle-outline',
        title: `${company} couldn't process the request`,
        text: 'It answered, but turned the request down. Try again, and if it keeps happening, check the model in recipe settings.',
        action: 'retry',
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

/* The parser keeps at most two recipes, and Matilda often returns only one. */
function describeResults(count: number): string {
  return count === 1 ? 'One idea for the food you ticked.' : 'Two ideas for the food you ticked.';
}

/** Whether two reads of the saved key name the same model and the same key. */
function isSameCredentials(
  first: RecipeCredentials | null,
  second: RecipeCredentials | null,
): boolean {
  return first?.provider.id === second?.provider.id && first?.apiKey === second?.apiKey;
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

  /* The last key read on focus. A ref, because the focus callback is created only once. */
  const lastReadCredentials = useRef<RecipeCredentials | null | undefined>(undefined);

  /*
   * null until the student changes a tick or saved ticks are restored, so the
   * eat-soon defaults apply until then.
   */
  const [chosenIds, setChosenIds] = useState<string[] | null>(null);
  const [request, setRequest] = useState<RequestState>({ status: 'idle' });
  const [isChecklistOpen, setIsChecklistOpen] = useState(true);
  const pendingRequest = useRef<AbortController | null>(null);

  /* false until the saved suggestions and ticks have been read, so nothing can be tapped before. */
  const [isSnapshotRead, setIsSnapshotRead] = useState(false);

  /* The last successful result, saved with the ticks so it comes back after a restart. */
  const lastResult = useRef<RecipeScreenSnapshot['lastResult']>(null);

  /* Every title shown this session: "Suggest different recipes" asks the model to avoid them. */
  const shownTitles = useRef<string[]>([]);

  /* What the last request asked for, so Try again repeats it exactly. */
  const lastAsk = useRef<{ ingredients: RecipeIngredient[]; avoidTitles: string[] } | null>(null);

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
        .catch(() => null)
        .then((saved) => {
          if (!isActive) {
            return;
          }

          const previous = lastReadCredentials.current;
          lastReadCredentials.current = saved;
          setCredentials(saved);

          /*
           * The student changed the model or key in settings, so an error
           * about the old one no longer applies (and would now name the wrong
           * provider). Recipes already on screen are still good, so they stay.
           */
          if (previous !== undefined && !isSameCredentials(previous, saved)) {
            setRequest((current) => (current.status === 'error' ? { status: 'idle' } : current));
          }
        });

      return () => {
        isActive = false;
      };
    }, []),
  );

  /* Bring back the last suggestions and ticks once, without asking the provider again. */
  useEffect(() => {
    let isActive = true;

    void loadRecipeSnapshot().then((snapshot) => {
      if (!isActive) {
        return;
      }

      if (snapshot) {
        setChosenIds(snapshot.selectedIds);

        if (snapshot.lastResult) {
          const { recipes } = snapshot.lastResult;

          lastResult.current = snapshot.lastResult;
          shownTitles.current = rememberShownTitles(
            [],
            recipes.map((recipe) => recipe.title),
          );
          setRequest({ status: 'done', ...snapshot.lastResult });
          setIsChecklistOpen(false);
        }
      }

      setIsSnapshotRead(true);
    });

    return () => {
      isActive = false;
    };
  }, []);

  /* A request still running when the screen goes away is cancelled, not billed for nothing. */
  useEffect(() => () => pendingRequest.current?.abort(), []);

  /* ---- Actions ---- */

  /* Sends food to the provider and shows whatever comes back. */
  async function requestRecipes(ingredients: RecipeIngredient[], avoidTitles: string[]) {
    if (!credentials || ingredients.length === 0) {
      return;
    }

    lastAsk.current = { ingredients, avoidTitles };

    /* Only one request at a time: a new tap cancels the one still running. */
    pendingRequest.current?.abort();
    const controller = new AbortController();
    pendingRequest.current = controller;
    setRequest({ status: 'loading' });

    const result = await fetchRecipeSuggestions(credentials, ingredients, {
      avoidTitles,
      signal: controller.signal,
    });

    /* The screen left, or a newer request replaced this one: its answer no longer matters. */
    if (controller.signal.aborted) {
      return;
    }

    pendingRequest.current = null;

    const forNames = ingredients.map((ingredient) => ingredient.name);

    if (result.outcome === 'ok') {
      const recipes = toSuggestedRecipes(result.recipes);

      shownTitles.current = rememberShownTitles(
        shownTitles.current,
        recipes.map((recipe) => recipe.title),
      );
      lastResult.current = { recipes, forNames };
      setRequest({ status: 'done', recipes, forNames });
      setIsChecklistOpen(false);
      void saveRecipeSnapshot({ selectedIds, lastResult: lastResult.current });
    } else {
      /* Errors are not saved: after a restart the last good result, or the checklist, shows. */
      setRequest({ status: 'error', outcome: result.outcome, forNames });
      setIsChecklistOpen(false);
    }
  }

  /* Every change to the ticks is saved, so they come back after a restart. */
  function changeTicks(ids: string[]) {
    setChosenIds(ids);
    void saveRecipeSnapshot({ selectedIds: ids, lastResult: lastResult.current });
  }

  function suggestForTickedFood() {
    void requestRecipes(toRecipeIngredients(candidates, selectedIds), []);
  }

  /* New ideas for the same food as the recipes on screen, without repeating any shown so far. */
  function suggestDifferentRecipes(ingredients: RecipeIngredient[]) {
    void requestRecipes(ingredients, shownTitles.current);
  }

  /* A retry repeats what failed, so a failed "different" request stays different. */
  function tryAgain() {
    if (lastAsk.current) {
      void requestRecipes(lastAsk.current.ingredients, lastAsk.current.avoidTitles);
    }
  }

  function openSettings() {
    router.push('/recipe-settings');
  }

  /* ---- Header: title, subtitle, and the model pill that opens settings ---- */

  const isLoading = request.status === 'loading';

  const header = (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <Text accessibilityRole="header" style={styles.title}>
          Recipes
        </Text>
        <Text style={styles.subtitle}>
          {request.status === 'done' && !isChecklistOpen
            ? describeResults(request.recipes.length)
            : 'Tick the food you want to cook with.'}
        </Text>
      </View>

      {/* Settings stay closed while a request runs, so the key cannot change under it. */}
      {credentials ? (
        <Pressable
          accessibilityLabel={`Recipe settings, using ${credentials.provider.label}`}
          accessibilityRole="button"
          accessibilityState={{ disabled: isLoading }}
          disabled={isLoading}
          onPress={openSettings}
          style={({ pressed }) => [
            styles.modelPill,
            isLoading ? styles.disabledButton : null,
            pressed ? styles.pressed : null,
          ]}
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

  /* Still reading the inventory, the key or the saved suggestions. */
  if (isInventoryLoading || credentials === undefined || !isSnapshotRead) {
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
            Recipes come from an AI model using your own API key. Choose Gemini Flash (free),
            Matilda, GPT-5.4 mini or DeepSeek Flash, then paste a key from that provider. Your key
            stays on this phone, and any charges go to your provider account.
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

  const tickedCount = selectedIds.length;

  /* The food a finished or failed request was for, shown as chips in place of the checklist. */
  const askedFor =
    request.status === 'done' || request.status === 'error'
      ? findRecipeIngredients(request.forNames, candidates)
      : null;
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

      {/* After results or an error: the food asked for folds into "cooking with" chips. */}
      {askedFor && !isChecklistOpen ? (
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
            {askedFor.map((ingredient) => {
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
            onChange={changeTicks}
            selectedIds={selectedIds}
          />

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: isLoading || tickedCount === 0, busy: isLoading }}
            disabled={isLoading || tickedCount === 0}
            onPress={suggestForTickedFood}
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
            onPress={failure.action === 'retry' ? tryAgain : openSettings}
            style={({ pressed }) => [styles.outlineButton, pressed ? styles.pressed : null]}
          >
            {failure.action === 'retry' ? (
              <Ionicons color="#2f7d32" name="refresh-outline" size={17} />
            ) : null}
            <Text style={styles.outlineButtonText}>
              {failure.action === 'retry' ? 'Try again' : 'Update key'}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* The suggested recipes, each with the app's own red warning if it uses expired food. */}
      {request.status === 'done' && askedFor ? (
        <View style={styles.results}>
          <Text style={[styles.sectionTitle, styles.resultsTitle]}>SUGGESTIONS</Text>

          <View style={styles.cards}>
            {request.recipes.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                expiredNames={findExpiredIngredients(recipe, askedFor)}
                recipe={recipe}
              />
            ))}
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() => suggestDifferentRecipes(askedFor)}
            style={({ pressed }) => [styles.differentButton, pressed ? styles.pressed : null]}
          >
            <Ionicons color="#2f7d32" name="refresh-outline" size={19} />
            <Text style={styles.differentButtonText}>Suggest different recipes</Text>
          </Pressable>

          <Text style={styles.hintText}>New ideas replace these ones.</Text>

          <Text style={[styles.footnote, styles.resultsFootnote]}>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
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
  differentButton: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 18,
    borderWidth: 1,
    borderColor: '#2f7d32',
    borderRadius: 14,
    backgroundColor: '#ffffff',
  },
  differentButtonText: {
    color: '#2f7d32',
    fontSize: 15,
    fontWeight: '700',
  },
  hintText: {
    marginTop: 10,
    color: '#59635b',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
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
    marginTop: 26,
  },
  resultsTitle: {
    marginBottom: 10,
  },
  cards: {
    gap: 16,
  },
  footnote: {
    color: '#687269',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  resultsFootnote: {
    marginTop: 14,
  },
  pressed: {
    opacity: 0.72,
  },
});
