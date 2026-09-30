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
        <ActivityIndicator color="#2f7d32" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>MODEL</Text>

        <View accessibilityRole="radiogroup" style={styles.card}>
          {PROVIDERS.map((option, index) => {
            const isSelected = option.id === selectedId;

            return (
              <View key={option.id}>
                {index > 0 ? <View style={styles.divider} /> : null}

                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSelected, disabled: isWorking }}
                  disabled={isWorking}
                  onPress={() => chooseProvider(option.id)}
                  style={({ pressed }) => [styles.providerRow, pressed ? styles.pressed : null]}
                >
                  <View style={[styles.radio, isSelected ? styles.radioSelected : null]}>
                    {isSelected ? <View style={styles.radioDot} /> : null}
                  </View>

                  <View style={styles.providerText}>
                    <Text style={styles.providerLabel}>{option.label}</Text>
                    <Text style={styles.providerCompany}>{option.company}</Text>
                  </View>

                  {hints[option.id] ? <Text style={styles.savedBadge}>Key saved</Text> : null}
                </Pressable>
              </View>
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
            <Ionicons color="#2f7d32" name="open-outline" size={15} />
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
          placeholderTextColor="#8a938c"
          secureTextEntry
          style={styles.input}
          value={keyInput}
        />

        <View style={styles.savedRow}>
          {savedHint ? <Ionicons color="#27652a" name="checkmark" size={15} /> : null}

          <Text style={savedHint ? styles.savedText : styles.helpText}>
            {savedHint ? `Saved key: ${savedHint}` : `No ${provider.company} key saved yet`}
          </Text>
        </View>

        <View style={styles.privacyCard}>
          <Ionicons color="#27652a" name="lock-closed-outline" size={18} />

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
            isPrimaryDisabled ? styles.disabledButton : null,
            pressed ? styles.pressed : null,
          ]}
        >
          {isWorking && trimmedKey ? <ActivityIndicator color="#ffffff" /> : null}
          <Text style={styles.primaryButtonText}>{primaryLabel}</Text>
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
    backgroundColor: '#f6f8f3',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f6f8f3',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 40,
  },
  sectionTitle: {
    marginBottom: 10,
    color: '#687269',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.9,
  },
  card: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#dce4da',
    borderRadius: 14,
    backgroundColor: '#ffffff',
  },
  divider: {
    height: 1,
    marginLeft: 52,
    backgroundColor: '#eef1ed',
  },
  providerRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
  },
  radio: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#aab6a9',
    borderRadius: 11,
  },
  radioSelected: {
    borderColor: '#2f7d32',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2f7d32',
  },
  providerText: {
    flex: 1,
    gap: 2,
  },
  providerLabel: {
    color: '#172019',
    fontSize: 17,
    fontWeight: '600',
  },
  providerCompany: {
    color: '#59635b',
    fontSize: 13,
  },
  savedBadge: {
    overflow: 'hidden',
    borderRadius: 999,
    backgroundColor: '#e7f4e8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    color: '#27652a',
    fontSize: 12,
    fontWeight: '700',
  },
  keyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
  },
  label: {
    flex: 1,
    color: '#263229',
    fontSize: 14,
    fontWeight: '700',
  },
  getKey: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  getKeyText: {
    color: '#2f7d32',
    fontSize: 14,
    fontWeight: '700',
  },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: '#cad4c9',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    color: '#172019',
    fontSize: 16,
  },
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  savedText: {
    color: '#27652a',
    fontSize: 12,
  },
  helpText: {
    color: '#59635b',
    fontSize: 12,
  },
  privacyCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 20,
    borderRadius: 12,
    backgroundColor: '#e7f4e8',
    padding: 12,
  },
  privacyText: {
    flex: 1,
    color: '#1f4f22',
    fontSize: 13,
    lineHeight: 18,
  },
  errorCard: {
    marginTop: 16,
    borderRadius: 12,
    backgroundColor: '#fde7e5',
    padding: 12,
  },
  errorText: {
    color: '#8b2c25',
    fontSize: 13,
    lineHeight: 18,
  },
  successCard: {
    marginTop: 16,
    borderRadius: 12,
    backgroundColor: '#e7f4e8',
    padding: 12,
  },
  successText: {
    color: '#1f4f22',
    fontSize: 13,
    lineHeight: 18,
  },
  primaryButton: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
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
  removeButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  removeButtonText: {
    color: '#9f2420',
    fontSize: 15,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.72,
  },
});
