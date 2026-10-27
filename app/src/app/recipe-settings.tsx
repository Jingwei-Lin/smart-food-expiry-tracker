import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { checkRecipeKey, KeyCheckResult } from '@/utils/recipe-client';
import {
  getRecipeCredentials,
  getSavedKeyHint,
  removeRecipeKey,
  saveRecipeCredentials,
  selectRecipeProvider,
} from '@/utils/recipe-credentials';
import { RECIPE_PROVIDERS, RecipeProvider, RecipeProviderId } from '@/utils/recipe-providers';

const PROVIDERS = Object.values(RECIPE_PROVIDERS);

/* The app's palette, as on the redesigned screens. */
const COLORS = {
  background: '#FFFDF5',
  primary: '#1E2A16',
  secondary: '#55614D',
  subtle: '#F2F3EA',
  surface: '#FFFFFF',
  border: '#E4E5D4',
  accent: '#A6D45A',
  accentSoft: '#F0F7DB',
  link: '#4E7A1F',
  divider: '#EEEFE5',
  error: '#8B2C25',
  errorSoft: '#FDE7E5',
};

/* Free, so a student who has never set anything up can start without paying. */
const DEFAULT_PROVIDER_ID: RecipeProviderId = 'gemini';

type KeyHints = Record<RecipeProviderId, string | null>;

const NO_KEY_HINTS = Object.fromEntries(PROVIDERS.map(({ id }) => [id, null])) as KeyHints;

type Notice = { tone: 'error' | 'success'; text: string };

function describeCheckFailure(
  result: Exclude<KeyCheckResult, 'valid'>,
  provider: RecipeProvider,
): string {
  switch (result) {
    case 'invalid-key':
      return `${provider.company} did not accept this key. Check that you copied all of it.`;
    case 'model-unavailable':
      return `This key works, but its ${provider.company} account cannot use ${provider.label}. Nothing was saved.`;
    case 'unavailable':
      return `Couldn't reach ${provider.company} to check the key. Check your connection and try again. Nothing was saved.`;
  }
}

/**
 * Recipe settings screen.
 *
 * The student picks one of the models and pastes a key for it. A key is
 * checked with the provider before it is stored, so the Recipes tab never
 * starts with a key that cannot work. Each provider keeps its own key, so
 * switching back to one saved earlier needs no pasting.
 */
export default function RecipeSettingsScreen() {
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(true);
  const [activeId, setActiveId] = useState<RecipeProviderId | null>(null);
  const [selectedId, setSelectedId] = useState<RecipeProviderId>(DEFAULT_PROVIDER_ID);
  const [hints, setHints] = useState<KeyHints>(NO_KEY_HINTS);
  const [keyInput, setKeyInput] = useState('');
  const [isWorking, setIsWorking] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadSavedKeys() {
      try {
        const [credentials, savedHints] = await Promise.all([
          getRecipeCredentials(),
          Promise.all(PROVIDERS.map(({ id }) => getSavedKeyHint(id))),
        ]);

        if (!isMounted) {
          return;
        }

        setActiveId(credentials?.provider.id ?? null);
        setSelectedId(credentials?.provider.id ?? DEFAULT_PROVIDER_ID);
        setHints(
          Object.fromEntries(PROVIDERS.map(({ id }, index) => [id, savedHints[index]])) as KeyHints,
        );
      } catch {
        if (isMounted) {
          setNotice({ tone: 'error', text: 'Your saved keys could not be read on this phone.' });
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadSavedKeys();

    return () => {
      isMounted = false;
    };
  }, []);

  const provider = RECIPE_PROVIDERS[selectedId];
  const trimmedKey = keyInput.trim();
  const savedHint = hints[selectedId];

  function chooseProvider(id: RecipeProviderId) {
    setSelectedId(id);
    setKeyInput('');
    setNotice(null);
  }

  async function saveKey() {
    setIsWorking(true);
    setNotice(null);

    const result = await checkRecipeKey(provider, trimmedKey);

    if (result !== 'valid') {
      setNotice({ tone: 'error', text: describeCheckFailure(result, provider) });
      setIsWorking(false);
      return;
    }

    try {
      await saveRecipeCredentials(selectedId, trimmedKey);
    } catch {
      setNotice({ tone: 'error', text: 'The key could not be saved on this phone. Try again.' });
      setIsWorking(false);
      return;
    }

    router.back();
  }

  async function switchToSavedKey() {
    setIsWorking(true);

    try {
      await selectRecipeProvider(selectedId);
    } catch {
      setNotice({ tone: 'error', text: 'Could not switch model. Try again.' });
      setIsWorking(false);
      return;
    }

    router.back();
  }

  async function removeKey() {
    setIsWorking(true);
    setNotice(null);

    try {
      const nowActiveId = await removeRecipeKey(selectedId);
      const removed = `${provider.company} key removed from this phone.`;

      setHints((current) => ({ ...current, [selectedId]: null }));
      setActiveId(nowActiveId);
      setNotice({
        tone: 'success',
        text:
          nowActiveId && nowActiveId !== activeId
            ? `${removed} Recipes now use ${RECIPE_PROVIDERS[nowActiveId].label}.`
            : removed,
      });
    } catch {
      setNotice({ tone: 'error', text: 'The key could not be removed. Try again.' });
    } finally {
      setIsWorking(false);
    }
  }

  /*
   * One main button whose job depends on what the student has done: check and
   * save a pasted key, switch to a model whose key is already saved, or
   * nothing yet.
   */
  let primaryLabel = 'Save and check';
  let primaryAction: (() => Promise<void>) | null = null;

  if (trimmedKey) {
    primaryLabel = isWorking ? 'Checking…' : 'Save and check';
    primaryAction = saveKey;
  } else if (savedHint && selectedId !== activeId) {
    primaryLabel = `Use ${provider.label}`;
    primaryAction = switchToSavedKey;
  } else if (savedHint) {
    primaryLabel = `Using ${provider.label}`;
  }

  const isPrimaryDisabled = primaryAction === null || isWorking;

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 40 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Its own header, like the other redesigned screens, in place of "‹ (tabs)". */}
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Back"
            accessibilityRole="button"
            hitSlop={6}
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backButton, pressed ? styles.pressed : null]}
          >
            <Ionicons color={COLORS.primary} name="chevron-back" size={24} />
          </Pressable>

          <Text accessibilityRole="header" style={styles.title}>
            Recipe settings
          </Text>
        </View>

        <Text style={styles.intro}>
          Choose the AI model that suggests recipes, and paste a key from that provider.
        </Text>

        <Text style={styles.sectionTitle}>MODEL</Text>

        {/* One card per model; the chosen one is tinted lime with a dark tick. */}
        <View accessibilityRole="radiogroup" style={styles.providers}>
          {PROVIDERS.map((option) => {
            const isSelected = option.id === selectedId;

            return (
              <Pressable
                key={option.id}
                accessibilityLabel={
                  hints[option.id]
                    ? `${option.label}, ${option.company}, key saved`
                    : `${option.label}, ${option.company}`
                }
                accessibilityRole="radio"
                accessibilityState={{ checked: isSelected, disabled: isWorking }}
                disabled={isWorking}
                onPress={() => chooseProvider(option.id)}
                style={({ pressed }) => [
                  styles.providerCard,
                  isSelected ? styles.providerCardSelected : null,
                  pressed ? styles.pressed : null,
                ]}
              >
                <View style={[styles.radio, isSelected ? styles.radioSelected : null]}>
                  {isSelected ? (
                    <Ionicons color={COLORS.surface} name="checkmark" size={16} />
                  ) : null}
                </View>

                <View style={styles.providerText}>
                  <Text style={styles.providerLabel}>{option.label}</Text>
                  <Text style={styles.providerCompany}>{option.company}</Text>
                </View>

                {hints[option.id] ? (
                  <View style={styles.savedBadge}>
                    <Ionicons color={COLORS.link} name="key-outline" size={13} />
                    <Text style={styles.savedBadgeText}>Key saved</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.keyHeader}>
          <Text style={styles.label}>{provider.company} API key</Text>

          <Pressable
            accessibilityRole="link"
            onPress={() => {
              Linking.openURL(provider.keysUrl).catch(() => {
                setNotice({
                  tone: 'error',
                  text: `Couldn't open the ${provider.company} key page. Visit ${provider.keysUrl} in a browser.`,
                });
              });
            }}
            style={({ pressed }) => [styles.getKey, pressed ? styles.pressed : null]}
          >
            <Text style={styles.getKeyText}>Get a key</Text>
            <Ionicons color={COLORS.link} name="open-outline" size={15} />
          </Pressable>
        </View>

        <TextInput
          accessibilityLabel={`${provider.company} API key`}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isWorking}
          onChangeText={(value) => {
            setKeyInput(value);
            setNotice(null);
          }}
          placeholder={
            savedHint ? 'Paste a new key to replace it' : `Paste your ${provider.company} key`
          }
          placeholderTextColor={COLORS.secondary}
          secureTextEntry
          style={styles.input}
          value={keyInput}
        />

        <View style={styles.savedRow}>
          {savedHint ? <Ionicons color={COLORS.link} name="checkmark-circle" size={16} /> : null}

          <Text style={savedHint ? styles.savedText : styles.helpText}>
            {savedHint ? `Saved key: ${savedHint}` : `No ${provider.company} key saved yet`}
          </Text>
        </View>

        <View style={styles.privacyCard}>
          <Ionicons color={COLORS.primary} name="lock-closed-outline" size={18} />

          <Text style={styles.privacyText}>
            Your key is stored only on this phone and is sent only to {provider.company}. Only the
            names and dates of the food you tick are sent. Requests are billed to your own account.
            {provider.privacyNote ? ` ${provider.privacyNote}` : ''}
          </Text>
        </View>

        {notice ? (
          <View
            accessibilityLiveRegion="polite"
            style={notice.tone === 'error' ? styles.errorCard : styles.successCard}
          >
            <Text style={notice.tone === 'error' ? styles.errorText : styles.successText}>
              {notice.text}
            </Text>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: isPrimaryDisabled, busy: isWorking }}
          disabled={isPrimaryDisabled}
          onPress={() => void primaryAction?.()}
          style={({ pressed }) => [
            styles.primaryButton,
            /* Grey while there is nothing to do; still lime while a key is being checked. */
            isPrimaryDisabled && !isWorking ? styles.primaryButtonIdle : null,
            pressed ? styles.pressed : null,
          ]}
        >
          {isWorking && trimmedKey ? <ActivityIndicator color={COLORS.primary} /> : null}
          <Text
            style={[
              styles.primaryButtonText,
              isPrimaryDisabled && !isWorking ? styles.primaryButtonTextIdle : null,
            ]}
          >
            {primaryLabel}
          </Text>
        </Pressable>

        {savedHint ? (
          <Pressable
            accessibilityRole="button"
            disabled={isWorking}
            onPress={() => void removeKey()}
            style={({ pressed }) => [styles.removeButton, pressed ? styles.pressed : null]}
          >
            <Text style={styles.removeButtonText}>Remove key</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  content: {
    paddingHorizontal: 20,
  },
  header: {
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
  title: {
    flex: 1,
    color: COLORS.primary,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 26,
    lineHeight: 32,
  },
  intro: {
    marginTop: 12,
    marginBottom: 22,
    color: COLORS.secondary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 15,
    lineHeight: 21,
  },
  sectionTitle: {
    marginBottom: 10,
    color: COLORS.secondary,
    fontFamily: 'Fredoka_500Medium',
    fontSize: 12,
    letterSpacing: 0.9,
  },
  providers: {
    gap: 10,
  },
  providerCard: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
  },
  providerCardSelected: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accentSoft,
  },
  /* A round tick box: empty, or dark with a white tick once chosen. */
  radio: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#D5D8C4',
    borderRadius: 13,
    backgroundColor: COLORS.surface,
  },
  radioSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  providerText: {
    flex: 1,
    gap: 2,
  },
  providerLabel: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 17,
  },
  providerCompany: {
    color: COLORS.secondary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 14,
  },
  savedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: COLORS.surface,
  },
  savedBadgeText: {
    color: COLORS.link,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 12,
  },
  keyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 26,
  },
  label: {
    flex: 1,
    color: COLORS.primary,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 16,
  },
  getKey: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  getKeyText: {
    color: COLORS.link,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 15,
  },
  input: {
    minHeight: 54,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 16,
    color: COLORS.primary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 16,
  },
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  savedText: {
    color: COLORS.link,
    fontFamily: 'Fredoka_500Medium',
    fontSize: 13,
  },
  helpText: {
    color: COLORS.secondary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 13,
  },
  privacyCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 20,
    borderRadius: 16,
    backgroundColor: COLORS.subtle,
    padding: 14,
  },
  privacyText: {
    flex: 1,
    color: COLORS.primary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 14,
    lineHeight: 20,
  },
  errorCard: {
    marginTop: 16,
    borderRadius: 16,
    backgroundColor: COLORS.errorSoft,
    padding: 14,
  },
  errorText: {
    color: COLORS.error,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 14,
    lineHeight: 19,
  },
  successCard: {
    marginTop: 16,
    borderRadius: 16,
    backgroundColor: COLORS.accentSoft,
    padding: 14,
  },
  successText: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 14,
    lineHeight: 19,
  },
  primaryButton: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 24,
    borderRadius: 18,
    backgroundColor: COLORS.accent,
    paddingHorizontal: 18,
  },
  primaryButtonIdle: {
    backgroundColor: COLORS.divider,
  },
  primaryButtonText: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 17,
  },
  primaryButtonTextIdle: {
    color: COLORS.secondary,
  },
  removeButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  removeButtonText: {
    color: COLORS.error,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 15,
  },
  pressed: {
    opacity: 0.72,
  },
});
