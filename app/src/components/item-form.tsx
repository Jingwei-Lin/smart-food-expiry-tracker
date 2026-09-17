import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { formatExpiryDateInput, parseExpiryDate } from '@/utils/expiry-date';

export type ItemFormValues = {
  name: string;
  quantity: string;
  expiryDate: string;
  notes: string;
};

type ItemFormErrors = {
  name?: string;
  expiryDate?: string;
  save?: string;
};

type ItemFormProps = {
  initialValues?: ItemFormValues;
  submitLabel: string;
  /** Explains why saving is impossible, e.g. storage has not loaded; also disables the button. */
  blockedReason?: string | null;
  /** The add screen stays mounted after saving, so it clears the fields afterwards. */
  clearOnSubmit?: boolean;
  /** Replaces the expiry hint, e.g. to say where a pre-filled date was estimated from. */
  expiryHelpText?: string;
  onSubmit: (values: ItemFormValues) => Promise<void>;
};

const emptyValues: ItemFormValues = {
  name: '',
  quantity: '',
  expiryDate: '',
  notes: '',
};

/**
 * The grocery item fields, shared by the add and edit screens.
 *
 * Owns its own validation and save error, and hands the trimmed values to the
 * screen, which decides what saving means and where to go afterwards.
 */
export function ItemForm({
  initialValues = emptyValues,
  submitLabel,
  blockedReason = null,
  clearOnSubmit = false,
  expiryHelpText,
  onSubmit,
}: ItemFormProps) {
  const [name, setName] = useState(initialValues.name);
  const [quantity, setQuantity] = useState(initialValues.quantity);
  const [expiryDate, setExpiryDate] = useState(initialValues.expiryDate);
  const [notes, setNotes] = useState(initialValues.notes);

  const [errors, setErrors] = useState<ItemFormErrors>({});
  const [isSaving, setIsSaving] = useState(false);

  const isSubmitDisabled = isSaving || blockedReason !== null;

  function clearFieldError(field?: keyof ItemFormErrors) {
    setErrors((currentErrors) => ({
      ...currentErrors,
      ...(field ? { [field]: undefined } : null),
      save: undefined,
    }));
  }

  function handleNameChange(value: string) {
    setName(value);
    clearFieldError('name');
  }

  function handleQuantityChange(value: string) {
    setQuantity(value);
    clearFieldError();
  }

  function handleExpiryDateChange(value: string) {
    setExpiryDate(formatExpiryDateInput(value));
    clearFieldError('expiryDate');
  }

  function handleNotesChange(value: string) {
    setNotes(value);
    clearFieldError();
  }

  function validateForm(): ItemFormErrors {
    const nextErrors: ItemFormErrors = {};

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

  async function handleSubmit() {
    const validationErrors = validateForm();

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setIsSaving(true);

    try {
      await onSubmit({
        name: name.trim(),
        quantity: quantity.trim() || '1 item',
        expiryDate: expiryDate.trim(),
        notes: notes.trim(),
      });

      if (clearOnSubmit) {
        setName('');
        setQuantity('');
        setExpiryDate('');
        setNotes('');
      }
    } catch {
      setErrors({
        save: 'The item could not be saved. Please try again.',
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
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
              {expiryHelpText ?? 'Type the digits printed on the package, for example 20260920.'}
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

      {blockedReason ? (
        <View style={styles.storageNotice}>
          <Ionicons name="hourglass-outline" size={19} color="#8b6b1f" />

          <Text style={styles.storageNoticeText}>{blockedReason}</Text>
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
        disabled={isSubmitDisabled}
        onPress={() => void handleSubmit()}
        style={({ pressed }) => [
          styles.submitButton,
          pressed ? styles.pressedButton : null,
          isSubmitDisabled ? styles.disabledButton : null,
        ]}
      >
        <Ionicons name="checkmark" size={21} color="#ffffff" />

        <Text style={styles.submitButtonText}>{isSaving ? 'Saving...' : submitLabel}</Text>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
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
