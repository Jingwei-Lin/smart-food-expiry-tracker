import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
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
import { SavedStar } from '@/components/saved-star';
import { ScreenHeader } from '@/components/screen-header';
import { useInventory } from '@/context/inventory-context';
import { useToday } from '@/hooks/use-today';
import { EAT_SOON_DAYS } from '@/utils/expiry-date';
import { fetchRecipeSuggestions, RecipeSuggestionResult } from '@/utils/recipe-client';
import { getRecipeCredentials, RecipeCredentials } from '@/utils/recipe-credentials';
import {
  defaultRecipeSelection,
  findRecipeIngredients,
  listRecipeCandidates,
  RecipeIngredient,
  toRecipeIngredients,
} from '@/utils/recipe-ingredients';
import {
  buildAvoidTitles,
  findExpiredIngredients,
  rememberShownTitles,
} from '@/utils/recipe-prompt';
import {
  loadRecipeSnapshot,
  loadSavedRecipes,
  RecipeScreenSnapshot,
  SavedRecipe,
  saveRecipe,
  saveRecipeSnapshot,
  SuggestedRecipe,
  toSuggestedRecipes,
  unsaveRecipe,
} from '@/utils/recipe-storage';

type IconName = ComponentProps<typeof Ionicons>['name'];

/* The app's palette, as on the other redesigned tabs. */
const COLORS = {
  background: '#FFFDF5',
  surface: '#FFFFFF',
  primary: '#1E2A16',
  secondary: '#55614D',
  border: '#E4E5D4',
  subtle: '#F2F3EA',
  divider: '#EEEFE5',
  accent: '#A6D45A',
  accentSoft: '#F0F7DB',
  link: '#4E7A1F',
  error: '#8B2C25',
  errorSoft: '#FDE7E5',
  pinkSoft: '#F9D3DD',
};

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

/* What the set-up card promises about the key and the data sent. */
const SETUP_FACTS: { icon: IconName; text: string }[] = [
  { icon: 'lock-closed-outline', text: 'Your key stays on this phone.' },
  { icon: 'list-outline', text: 'Only the names and dates of the food you tick are sent.' },
  { icon: 'card-outline', text: 'Any charges go to your provider account.' },
];

/* The parser keeps at most two recipes, and Matilda often returns only one. */
function describeResults(count: number): string {
  return count === 1 ? 'One idea for the food you ticked.' : 'Two ideas for the food you ticked.';
}

/** "Using up" chips: dark for today, pink for the next few days, light red once expired. */
function usingUpChip(daysLeft: number): { background: string; color: string } {
  if (daysLeft < 0) {
    return { background: COLORS.errorSoft, color: COLORS.error };
  }

  if (daysLeft === 0) {
    return { background: COLORS.primary, color: COLORS.surface };
  }

  if (daysLeft <= 3) {
    return { background: COLORS.pinkSoft, color: COLORS.primary };
  }

  return { background: COLORS.subtle, color: COLORS.primary };
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

  /* Set by "Find recipes" on an item's screen: the one item to tick. */
  const { select } = useLocalSearchParams<{ select?: string }>();

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

  /* The starred recipes, newest first. */
  const [savedRecipes, setSavedRecipes] = useState<SavedRecipe[]>([]);

  /* Every title shown this session: "Suggest different recipes" asks the model to avoid them. */
  const shownTitles = useRef<string[]>([]);

  /* What the last request asked for, so Try again repeats it exactly. */
  const lastAsk = useRef<{ ingredients: RecipeIngredient[]; avoidTitles: string[] } | null>(null);

  /* ---- Checklist rows and ticks ---- */

  /* Food that expired overnight must be warned about, and stop being ticked by default. */
  const today = useToday();
  const candidates = useMemo(() => listRecipeCandidates(activeItems, today), [activeItems, today]);

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

      /* Recipes removed on the Saved recipes screen lose their star here too. */
      void loadSavedRecipes().then((entries) => {
        if (isActive) {
          setSavedRecipes(entries);
        }
      });

      return () => {
        isActive = false;
      };
    }, []),
  );

  /* Bring back the saved recipes, and the last suggestions and ticks, without asking the provider again. */
  useEffect(() => {
    let isActive = true;

    void Promise.all([loadRecipeSnapshot(), loadSavedRecipes()]).then(([snapshot, saved]) => {
      if (!isActive) {
        return;
      }

      setSavedRecipes(saved);

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

  /*
   * "Find recipes" on an item's screen opens this tab with just that item
   * ticked. It is applied while rendering, React's pattern for state that
   * follows a changing param, and only once any saved ticks have been
   * restored, so they cannot overwrite it.
   */
  const [appliedSelect, setAppliedSelect] = useState<string | null>(null);

  if (isSnapshotRead && (select ?? null) !== appliedSelect) {
    setAppliedSelect(select ?? null);

    if (select) {
      setChosenIds([select]);
      setIsChecklistOpen(true);

      if (request.status === 'error') {
        setRequest({ status: 'idle' });
      }
    }
  }

  /* Save that tick, and clear the param so later visits keep the student's own ticks. */
  useEffect(() => {
    if (appliedSelect) {
      void saveRecipeSnapshot({ selectedIds: [appliedSelect], lastResult: lastResult.current });
      router.setParams({ select: undefined });
    }
  }, [appliedSelect]);

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

  /* Every request avoids what was shown this session and what is already saved. */
  function currentAvoidTitles(): string[] {
    return buildAvoidTitles(
      shownTitles.current,
      savedRecipes.map((entry) => entry.recipe.title),
    );
  }

  function suggestForTickedFood() {
    void requestRecipes(toRecipeIngredients(candidates, selectedIds), currentAvoidTitles());
  }

  /* New ideas for the same food as the recipes on screen. */
  function suggestDifferentRecipes(ingredients: RecipeIngredient[]) {
    void requestRecipes(ingredients, currentAvoidTitles());
  }

  /* The star fills or empties only once the change is saved. */
  async function toggleSaved(recipe: SuggestedRecipe) {
    const isSaved = savedRecipes.some((entry) => entry.id === recipe.id);

    try {
      setSavedRecipes(isSaved ? await unsaveRecipe(recipe.id) : await saveRecipe(recipe));
    } catch {
      // Storage failed, so the star keeps showing what is really saved.
    }
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

  let subtitle = 'Tick the food you want to cook with.';

  if (credentials === null) {
    subtitle = 'Ideas for the food you already have.';
  } else if (request.status === 'done' && !isChecklistOpen) {
    subtitle = describeResults(request.recipes.length);
  } else if (chosenIds === null && selectedIds.length > 0) {
    /* Nothing changed yet, so the ticks are the eat-soon defaults. */
    subtitle = `Food expiring within ${EAT_SOON_DAYS} days is ticked for you.`;
  }

  /* Saved recipes need neither a key nor any food, so this is on every state of the tab. */
  const savedLabel =
    savedRecipes.length === 0 ? 'Nothing saved yet' : `${savedRecipes.length} saved`;
  const savedButton = (
    <Pressable
      accessibilityLabel={`Saved recipes, ${savedLabel}`}
      accessibilityRole="button"
      onPress={() => router.push('/saved-recipes')}
      style={({ pressed }) => [styles.savedButton, pressed ? styles.pressed : null]}
    >
      <SavedStar size={18} />
      <Text style={styles.savedButtonText}>
        {savedRecipes.length === 0 ? 'Saved' : `Saved · ${savedRecipes.length}`}
      </Text>
    </Pressable>
  );

  const header = (
    <View>
      <ScreenHeader
        right={savedButton}
        style={styles.screenHeader}
        subtitle="Recipes"
        title="What can I cook?"
      />

      <Text style={styles.subtitle}>{subtitle}</Text>

      {/* Settings stay closed while a request runs, so the key cannot change under it. */}
      {credentials ? (
        <Pressable
          accessibilityLabel={`Recipe settings, using ${credentials.provider.label}`}
          accessibilityRole="button"
          accessibilityState={{ disabled: isLoading }}
          disabled={isLoading}
          onPress={openSettings}
          style={({ pressed }) => [
            styles.modelRow,
            isLoading ? styles.disabledButton : null,
            pressed ? styles.pressed : null,
          ]}
        >
          <Ionicons color={COLORS.primary} name="sparkles-outline" size={18} />

          <Text style={styles.modelText}>
            Using <Text style={styles.modelName}>{credentials.provider.label}</Text>
          </Text>

          {/* Looks like a button, but the whole row is the one tap target. */}
          <View style={styles.modelChange}>
            <Text style={styles.modelChangeText}>Change</Text>
          </View>
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
        <ActivityIndicator color={COLORS.primary} size="large" />
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
            <Ionicons color={COLORS.link} name="key-outline" size={32} />
          </View>

          <Text style={styles.infoTitle}>Set up recipe suggestions</Text>
          <Text style={styles.infoText}>
            Recipes come from an AI model using your own API key. Choose Gemini Flash (free),
            Matilda, GPT-5.4 mini or DeepSeek Flash, then paste a key from that provider.
          </Text>

          <View style={styles.setupFacts}>
            {SETUP_FACTS.map((fact) => (
              <View key={fact.text} style={styles.setupFact}>
                <Ionicons color={COLORS.link} name={fact.icon} size={18} />
                <Text style={styles.setupFactText}>{fact.text}</Text>
              </View>
            ))}
          </View>

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
            <Ionicons color={COLORS.link} name="basket-outline" size={34} />
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

  /* ---- Results: the suggestions get the screen to themselves, with a way back to the food ---- */

  if (request.status === 'done' && askedFor && !isChecklistOpen) {
    const count = request.recipes.length;

    return (
      <ScrollView
        contentContainerStyle={contentStyle}
        showsVerticalScrollIndicator={false}
        style={styles.screen}
      >
        <View style={styles.resultsHeader}>
          <Pressable
            accessibilityLabel="Change the food to cook with"
            accessibilityRole="button"
            hitSlop={6}
            onPress={() => setIsChecklistOpen(true)}
            style={({ pressed }) => [styles.backButton, pressed ? styles.pressed : null]}
          >
            <Ionicons color={COLORS.primary} name="chevron-back" size={24} />
          </Pressable>

          <Text accessibilityRole="header" style={styles.resultsHeading}>
            {count === 1 ? 'One idea for tonight' : `${count} ideas for tonight`}
          </Text>
        </View>

        {/* The food these ideas use up, coloured by how soon it goes off. */}
        <View style={styles.usingUp}>
          <Text style={styles.usingUpLabel}>Using up</Text>

          {askedFor.map((ingredient) => {
            const chip = usingUpChip(ingredient.daysLeft);

            return (
              <View
                key={ingredient.name}
                style={[styles.usingUpChip, { backgroundColor: chip.background }]}
              >
                {ingredient.daysLeft < 0 ? (
                  <Ionicons color={COLORS.error} name="warning-outline" size={13} />
                ) : null}
                <Text style={[styles.usingUpChipText, { color: chip.color }]}>
                  {ingredient.daysLeft < 0 ? `${ingredient.name} · expired` : ingredient.name}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Each card has the app's own red warning if the recipe uses expired food. */}
        <View style={styles.cards}>
          {request.recipes.map((recipe, index) => (
            <RecipeCard
              key={recipe.id}
              index={index}
              onOpen={() =>
                router.push({
                  pathname: '/recipe/[id]',
                  params: { id: recipe.id, tint: String(index) },
                })
              }
              expiredNames={findExpiredIngredients(recipe, askedFor)}
              isSaved={savedRecipes.some((entry) => entry.id === recipe.id)}
              onToggleSaved={() => void toggleSaved(recipe)}
              recipe={recipe}
            />
          ))}
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => suggestDifferentRecipes(askedFor)}
          style={({ pressed }) => [styles.differentButton, pressed ? styles.pressed : null]}
        >
          <Text style={styles.differentButtonText}>More ideas</Text>
        </Pressable>

        <Text style={styles.hintText}>New ideas replace the ones you haven&apos;t saved.</Text>

        <Text style={[styles.footnote, styles.resultsFootnote]}>
          AI-generated. Check ingredients for allergies before cooking.
        </Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={contentStyle}
      showsVerticalScrollIndicator={false}
      style={styles.screen}
    >
      {header}

      {/* After an error: the food asked for folds into "cooking with" chips. */}
      {askedFor && !isChecklistOpen ? (
        <View>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>COOKING WITH</Text>

            <Pressable
              accessibilityLabel="Change the food to cook with"
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
                  {isExpired ? (
                    <Ionicons color={COLORS.error} name="warning-outline" size={14} />
                  ) : null}
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
              styles.suggestButton,
              tickedCount === 0 ? styles.suggestButtonEmpty : null,
              pressed ? styles.pressed : null,
            ]}
          >
            {/* The count is above the list ("3 of 10 ticked"), so the button just says what it does. */}
            {isLoading ? <ActivityIndicator color={COLORS.primary} /> : null}
            <Text
              style={[
                styles.suggestButtonText,
                tickedCount === 0 ? styles.suggestButtonTextEmpty : null,
              ]}
            >
              {isLoading
                ? 'Finding recipes…'
                : tickedCount === 0
                  ? 'Tick at least one food'
                  : 'Suggest recipes'}
            </Text>
          </Pressable>

          {/* Came back to change the food: the last ideas are one tap away, without asking again. */}
          {request.status === 'done' ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setIsChecklistOpen(false)}
              style={({ pressed }) => [styles.backToIdeas, pressed ? styles.pressed : null]}
            >
              <Text style={styles.backToIdeasText}>
                Back to the last {request.recipes.length === 1 ? 'idea' : 'ideas'}
              </Text>
              <Ionicons color={COLORS.primary} name="chevron-forward" size={16} />
            </Pressable>
          ) : null}
        </View>
      )}

      {/* A failed request: what went wrong and what to do next. */}
      {failure ? (
        <View accessibilityLiveRegion="polite" style={styles.infoCard}>
          <View style={[styles.infoIcon, styles.errorIcon]}>
            <Ionicons color={COLORS.error} name={failure.icon} size={32} />
          </View>

          <Text style={styles.infoTitle}>{failure.title}</Text>
          <Text style={styles.infoText}>{failure.text}</Text>

          <Pressable
            accessibilityRole="button"
            onPress={failure.action === 'retry' ? tryAgain : openSettings}
            style={({ pressed }) => [styles.outlineButton, pressed ? styles.pressed : null]}
          >
            {failure.action === 'retry' ? (
              <Ionicons color={COLORS.link} name="refresh-outline" size={17} />
            ) : null}
            <Text style={styles.outlineButtonText}>
              {failure.action === 'retry' ? 'Try again' : 'Update key'}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centred: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    paddingHorizontal: 32,
  },
  noticeText: {
    color: COLORS.secondary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  content: {
    paddingHorizontal: 20,
  },
  screenHeader: {
    marginBottom: 0,
  },
  subtitle: {
    color: COLORS.secondary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 15,
    lineHeight: 21,
  },
  savedButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 14,
  },
  savedButtonText: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 15,
  },
  modelRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
    borderRadius: 16,
    backgroundColor: COLORS.subtle,
    paddingLeft: 16,
    paddingRight: 8,
  },
  modelText: {
    flex: 1,
    color: COLORS.primary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 15,
  },
  modelName: {
    fontFamily: 'Fredoka_600SemiBold',
  },
  modelChange: {
    minHeight: 40,
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 14,
  },
  modelChangeText: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 14,
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
    color: COLORS.secondary,
    fontFamily: 'Fredoka_500Medium',
    fontSize: 12,
    letterSpacing: 0.9,
  },
  textButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingLeft: 10,
  },
  textButtonText: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 14,
  },
  chipCard: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    padding: 14,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  expiredChip: {
    backgroundColor: COLORS.errorSoft,
  },
  chipText: {
    color: COLORS.surface,
    fontFamily: 'Fredoka_500Medium',
    fontSize: 14,
  },
  expiredChipText: {
    color: COLORS.error,
  },
  primaryButton: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
    alignSelf: 'stretch',
    borderRadius: 18,
    backgroundColor: COLORS.accent,
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 17,
  },
  disabledButton: {
    opacity: 0.55,
  },
  suggestButton: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 20,
    borderRadius: 18,
    backgroundColor: COLORS.accent,
    paddingHorizontal: 18,
  },
  /* Nothing ticked: grey, so it doesn't look like it can be pressed. */
  suggestButtonEmpty: {
    backgroundColor: COLORS.divider,
  },
  suggestButtonText: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 17,
  },
  suggestButtonTextEmpty: {
    color: COLORS.secondary,
  },
  outlineButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 22,
  },
  outlineButtonText: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 15,
  },
  differentButton: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
  },
  differentButtonText: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 16,
  },
  backToIdeas: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 8,
  },
  backToIdeasText: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 15,
  },
  hintText: {
    marginTop: 10,
    color: COLORS.secondary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  infoCard: {
    alignItems: 'center',
    marginTop: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  infoIcon: {
    width: 66,
    height: 66,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 33,
    backgroundColor: COLORS.accentSoft,
  },
  errorIcon: {
    backgroundColor: COLORS.errorSoft,
  },
  infoTitle: {
    marginTop: 16,
    color: COLORS.primary,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 20,
    textAlign: 'center',
  },
  infoText: {
    marginTop: 8,
    color: COLORS.secondary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
  },
  setupFacts: {
    alignSelf: 'stretch',
    gap: 10,
    marginTop: 20,
    borderRadius: 16,
    backgroundColor: COLORS.subtle,
    padding: 14,
  },
  setupFact: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  setupFactText: {
    flex: 1,
    color: COLORS.primary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 14,
    lineHeight: 19,
  },
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  backButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: COLORS.subtle,
  },
  resultsHeading: {
    flex: 1,
    color: COLORS.primary,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 26,
    lineHeight: 32,
  },
  usingUp: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    marginBottom: 14,
  },
  usingUpLabel: {
    marginRight: 2,
    color: COLORS.secondary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 15,
  },
  usingUpChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  usingUpChipText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 14,
  },
  cards: {
    gap: 12,
  },
  footnote: {
    color: COLORS.secondary,
    fontFamily: 'Fredoka_400Regular',
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
