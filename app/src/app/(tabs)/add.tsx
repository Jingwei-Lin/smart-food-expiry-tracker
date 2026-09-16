import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useInventory } from '@/context/inventory-context';
import { formatExpiryDateInput, parseExpiryDate } from '@/utils/expiry-date';

type FormErrors = {
  name?: string;
  expiryDate?: string;
  save?: string;
};

/**
 * Add / Scan screen.
 *
 * The entry point for putting a new grocery item into the inventory, either by
 * scanning its barcode and letting the product details fill in automatically,
 * or by typing the item in by hand.
 */
export default function AddItemScreen() {
  const { addItem, isStorageReady, storageError } = useInventory();

  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [notes, setNotes] = useState('');

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSaving, setIsSaving] = useState(false);

  function handleNameChange(value: string) {
    setName(value);

    setErrors((currentErrors) => ({
      ...currentErrors,
      name: undefined,
      save: undefined,
    }));
  }

  function handleQuantityChange(value: string) {
    setQuantity(value);

    setErrors((currentErrors) => ({
      ...currentErrors,
      save: undefined,
    }));
  }

  function handleExpiryDateChange(value: string) {
    setExpiryDate(formatExpiryDateInput(value));

    setErrors((currentErrors) => ({
      ...currentErrors,
      expiryDate: undefined,
      save: undefined,
    }));
  }

  function handleNotesChange(value: string) {
    setNotes(value);

    setErrors((currentErrors) => ({
      ...currentErrors,
      save: undefined,
    }));
  }

  function validateForm(): FormErrors {
    const nextErrors: FormErrors = {};

    const trimmedName = name.trim();
    const trimmedExpiryDate = expiryDate.trim();

    if (!trimmedName) {
      nextErrors.name = 'Enter a name for this item.';
    }

    if (!trimmedExpiryDate) {
      nextErrors.expiryDate = 'Enter an expiry date.';
    } else if (!parseExpiryDate(trimmedExpiryDate)) {
      nextErrors.expiryDate = 'Use a valid date in YYYY-MM-DD format.';
    }

    return nextErrors;
  }

  const isSaveDisabled = isSaving || !isStorageReady;

  async function handleSubmit() {
    const validationErrors = validateForm();

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setIsSaving(true);

    try {
      await addItem({
        name: name.trim(),
        quantity: quantity.trim() || '1 item',
        expiryDate: expiryDate.trim(),
        notes: notes.trim(),
      });

      setName('');
      setQuantity('');
      setExpiryDate('');
      setNotes('');

      /*
       * Return to the inventory tab after saving.
       * The next feature commit will display the saved items there.
       */
      router.replace('/');
    } catch {
      setErrors({
        save: 'The item could not be saved. Please try again.',
      });
    } finally {
      setIsSaving(false);
    }
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
        <Text style={styles.eyebrow}>MANUAL ENTRY</Text>
        <Text style={styles.title}>Add grocery item</Text>

        <Text style={styles.subtitle}>
          Add loose produce or an item without scanning its barcode.
        </Text>

        <View style={styles.informationCard}>
          <Ionicons name="information-circle-outline" size={22} color="#2f7d32" />

          <Text style={styles.informationText}>
            Required fields are marked with an asterisk. You can add quantity and notes if they
            are useful.
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>Item name *</Text>

            <TextInput
              accessibilityLabel="Item name"
              autoCapitalize="words"
              editable={!isSaving}
              onChangeText={handleNameChange}
              placeholder="e.g. Natural yoghurt"
              placeholderTextColor="#8a938c"
              style={[styles.input, errors.name ? styles.inputError : null]}
              value={name}
            />

            {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Quantity</Text>

            <TextInput
              accessibilityLabel="Quantity"
              editable={!isSaving}
              onChangeText={handleQuantityChange}
              placeholder="e.g. 1 tub or 500 g"
              placeholderTextColor="#8a938c"
              style={styles.input}
              value={quantity}
            />

            <Text style={styles.helpText}>If left empty, the quantity will be one item.</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Expiry date *</Text>

            <TextInput
              accessibilityLabel="Expiry date in year month day format"
              autoCapitalize="none"
              editable={!isSaving}
              inputMode="numeric"
              maxLength={10}
              onChangeText={handleExpiryDateChange}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#8a938c"
              style={[styles.input, errors.expiryDate ? styles.inputError : null]}
              value={expiryDate}
            />

            {errors.expiryDate ? (
              <Text style={styles.errorText}>{errors.expiryDate}</Text>
            ) : (
              <Text style={styles.helpText}>
                Type the digits printed on the package, for example 20260920.
              </Text>
            )}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Notes</Text>

            <TextInput
              accessibilityLabel="Notes"
              editable={!isSaving}
              multiline
              onChangeText={handleNotesChange}
              placeholder="e.g. Opened on Monday"
              placeholderTextColor="#8a938c"
              style={[styles.input, styles.notesInput]}
              textAlignVertical="top"
              value={notes}
            />
          </View>
        </View>

        {!isStorageReady ? (
          <View style={styles.storageNotice}>
            <Ionicons name="hourglass-outline" size={19} color="#8b6b1f" />

            <Text style={styles.storageNoticeText}>
              {storageError ?? 'Loading your saved inventory. Saving will be enabled in a moment.'}
            </Text>
          </View>
        ) : null}

        {errors.save ? (
          <View style={styles.saveError}>
            <Ionicons name="warning-outline" size={19} color="#8b2c25" />
            <Text style={styles.saveErrorText}>{errors.save}</Text>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          disabled={isSaveDisabled}
          onPress={() => void handleSubmit()}
          style={({ pressed }) => [
            styles.submitButton,
            pressed ? styles.pressedButton : null,
            isSaveDisabled ? styles.disabledButton : null,
          ]}
        >
          <Ionicons name="checkmark" size={21} color="#ffffff" />

          <Text style={styles.submitButtonText}>{isSaving ? 'Saving...' : 'Save item'}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f6f8f3',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },
  eyebrow: {
    color: '#2f7d32',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  title: {
    marginTop: 6,
    color: '#172019',
    fontSize: 32,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 7,
    color: '#59635b',
    fontSize: 15,
    lineHeight: 22,
  },
  informationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 22,
    borderRadius: 14,
    backgroundColor: '#e7f4e8',
    padding: 14,
  },
  informationText: {
    flex: 1,
    color: '#426747',
    fontSize: 13,
    lineHeight: 19,
  },
  form: {
    gap: 20,
    marginTop: 26,
  },
  field: {
    gap: 7,
  },
  label: {
    color: '#263229',
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
  inputError: {
    borderColor: '#b83c33',
  },
  notesInput: {
    minHeight: 96,
    paddingTop: 14,
    paddingBottom: 14,
  },
  errorText: {
    color: '#9f2420',
    fontSize: 12,
  },
  helpText: {
    color: '#718075',
    fontSize: 12,
  },
  storageNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 20,
    borderRadius: 12,
    backgroundColor: '#fff0d5',
    padding: 12,
  },
  storageNoticeText: {
    flex: 1,
    color: '#8b6b1f',
    fontSize: 13,
    lineHeight: 18,
  },
  saveError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
    borderRadius: 12,
    backgroundColor: '#fde7e5',
    padding: 12,
  },
  saveErrorText: {
    flex: 1,
    color: '#8b2c25',
    fontSize: 13,
  },
  submitButton: {
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
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  pressedButton: {
    opacity: 0.72,
  },
  disabledButton: {
    opacity: 0.55,
  },
});