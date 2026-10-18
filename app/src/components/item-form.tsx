import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  formatExpiryDateInput,
  formatWeekdayDate,
  parseExpiryDate,
  toExpiryDateString,
} from '@/utils/expiry-date';

export type ItemFormValues = {
  name: string;
  quantity: string;
  expiryDate: string;
  reminderDaysBefore: number;
  notes: string;
};

type ItemFormErrors = {
  name?: string;
  expiryDate?: string;
  reminderDaysBefore?: string;
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
  reminderDaysBefore: 1,
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
  const [reminderDaysBefore, setReminderDaysBefore] = useState(
    String(initialValues.reminderDaysBefore),
  );
  const [notes, setNotes] = useState(initialValues.notes);
  /* iOS shows its calendar inside the form; Android opens a dialog instead. */
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const [errors, setErrors] = useState<ItemFormErrors>({});
  const [isSaving, setIsSaving] = useState(false);

  const isSubmitDisabled = isSaving || blockedReason !== null;
  /* The calendar picker has no web version, so the web build keeps the typed field. */
  const typesTheDate = Platform.OS === 'web';

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

  const pickedDate = parseExpiryDate(expiryDate);

  /* Only called with a picked day; closing the calendar without one changes nothing. */
  function handleDatePicked(_event: unknown, date: Date) {
    setExpiryDate(toExpiryDateString(date));
    clearFieldError('expiryDate');
  }

  /*
   * Opens on the date already chosen, such as a scan's estimate or the date
   * being edited, or on today. There is no earliest date, so food that has
   * already expired can still be logged.
   */
  function openCalendar() {
    /* The ScrollView keeps the keyboard up for a handled tap, and it would cover the calendar. */
    Keyboard.dismiss();

    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        mode: 'date',
        value: pickedDate ?? new Date(),
        onValueChange: handleDatePicked,
      });
    } else {
      /*
       * iOS shows today as already selected, and tapping the selected day sends
       * no change, so today is chosen here or it could never be picked.
       */
      if (!isCalendarOpen && !pickedDate) {
        setExpiryDate(toExpiryDateString(new Date()));
        clearFieldError('expiryDate');
      }

      setIsCalendarOpen(!isCalendarOpen);
    }
  }

  function handleReminderDaysChange(value: string) {
    setReminderDaysBefore(value);
    clearFieldError('reminderDaysBefore');
  }

  function handleNotesChange(value: string) {
    setNotes(value);
    clearFieldError();
  }

  function validateForm(): ItemFormErrors {
    const nextErrors: ItemFormErrors = {};

    const trimmedName = name.trim();
    const trimmedExpiryDate = expiryDate.trim();
    const parsedReminderDays = Number(reminderDaysBefore);

    if (!trimmedName) {
      nextErrors.name = 'Enter a name for this item.';
    }

    if (!trimmedExpiryDate) {
      nextErrors.expiryDate = 'Choose an expiry date.';
    } else if (!parseExpiryDate(trimmedExpiryDate)) {
      // Only a typed date on web can be malformed; the calendar always gives a real one.
      nextErrors.expiryDate = 'Use a valid date in YYYY-MM-DD format.';
    }

    if (!Number.isInteger(parsedReminderDays) || parsedReminderDays < 1 || parsedReminderDays > 7) {
      nextErrors.reminderDaysBefore = 'Choose a whole number from 1 to 7.';
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
    /* Closed while saving, so a day tapped now can't show without being saved. */
    setIsCalendarOpen(false);
    setIsSaving(true);

    try {
      await onSubmit({
        name: name.trim(),
        quantity: quantity.trim() || '1 item',
        expiryDate: expiryDate.trim(),
        reminderDaysBefore: Number(reminderDaysBefore),
        notes: notes.trim(),
      });

      if (clearOnSubmit) {
        setName('');
        setQuantity('');
        setExpiryDate('');
        setIsCalendarOpen(false);
        setReminderDaysBefore('1');
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

          {typesTheDate ? (
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
          ) : (
            <Pressable
              accessibilityLabel={`Expiry date, ${pickedDate ? formatWeekdayDate(pickedDate) : 'not chosen'}`}
              accessibilityRole="button"
              disabled={isSaving}
              onPress={openCalendar}
              style={({ pressed }) => [
                styles.input,
                styles.dateButton,
                errors.expiryDate ? styles.inputError : null,
                pressed ? styles.pressedButton : null,
              ]}
            >
              <Text style={pickedDate ? styles.dateText : styles.datePlaceholder}>
                {pickedDate ? formatWeekdayDate(pickedDate) : 'Choose a date'}
              </Text>

              <Ionicons name="calendar-outline" size={20} color="#2f7d32" />
            </Pressable>
          )}

          {isCalendarOpen ? (
            <View style={styles.calendar}>
              <DateTimePicker
                accentColor="#2f7d32"
                display="inline"
                mode="date"
                onValueChange={handleDatePicked}
                value={pickedDate ?? new Date()}
              />

              <Pressable
                accessibilityRole="button"
                onPress={() => setIsCalendarOpen(false)}
                style={({ pressed }) => [
                  styles.calendarDone,
                  pressed ? styles.pressedButton : null,
                ]}
              >
                <Text style={styles.calendarDoneText}>Done</Text>
              </Pressable>
            </View>
          ) : null}

          {errors.expiryDate ? (
            <Text style={styles.errorText}>{errors.expiryDate}</Text>
          ) : (
            <Text style={styles.helpText}>
              {expiryHelpText ??
                (typesTheDate
                  ? 'Type the digits printed on the package, for example 20260920.'
                  : 'Pick the date printed on the package.')}
            </Text>
          )}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Remind me before expiry *</Text>

          <View style={styles.reminderInputRow}>
            <TextInput
              accessibilityLabel="Number of days before expiry to send a reminder"
              editable={!isSaving}
              inputMode="numeric"
              maxLength={1}
              onChangeText={handleReminderDaysChange}
              placeholder="1"
              placeholderTextColor="#8a938c"
              style={[
                styles.input,
                styles.reminderInput,
                errors.reminderDaysBefore ? styles.inputError : null,
              ]}
              value={reminderDaysBefore}
            />

            <Text style={styles.reminderUnit}>day(s) before</Text>
          </View>

          {errors.reminderDaysBefore ? (
            <Text style={styles.errorText}>{errors.reminderDaysBefore}</Text>
          ) : (
            <Text style={styles.helpText}>
              Choose 1 to 7 days. You will also be reminded on the expiry day.
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
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateText: {
    color: '#172019',
    fontSize: 16,
  },
  datePlaceholder: {
    color: '#8a938c',
    fontSize: 16,
  },
  calendar: {
    borderWidth: 1,
    borderColor: '#cad4c9',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    padding: 8,
  },
  calendarDone: {
    alignSelf: 'flex-end',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  calendarDoneText: {
    color: '#2f7d32',
    fontSize: 16,
    fontWeight: '700',
  },
  reminderInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  reminderInput: {
    width: 72,
    textAlign: 'center',
  },
  reminderUnit: {
    color: '#3c463e',
    fontSize: 15,
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
