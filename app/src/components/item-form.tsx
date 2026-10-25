import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, {
  DateTimePickerAndroid,
} from '@react-native-community/datetimepicker';
import { ReactNode, useState } from 'react';
import {
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  formatExpiryDateInput,
  formatWeekdayDate,
  parseExpiryDate,
  toExpiryDateString,
} from '@/utils/expiry-date';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { FoodCategory } from '@/types/food-item';

export type StorageLocation = 'fridge' | 'freezer' | 'pantry';

export type ItemFormValues = {
  name: string;
  quantity: string;
  expiryDate: string;
  reminderDaysBefore: number;
  notes: string;
  storageLocation?: StorageLocation;
  category?: FoodCategory;
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
  blockedReason?: string | null;
  clearOnSubmit?: boolean;
  expiryHelpText?: string;
  topContent?: ReactNode;
  bottomContent?: ReactNode;
  onCategoryChange?: (category: FoodCategory) => void;
  onSubmit: (values: ItemFormValues) => Promise<void>;
};

const emptyValues: ItemFormValues = {
  name: '',
  quantity: '',
  expiryDate: '',
  reminderDaysBefore: 1,
  notes: '',
  storageLocation: 'fridge',
};

const FOOD_CATEGORIES: FoodCategory[] = [
  'Veg',
  'Fruit',
  'Dairy',
  'Meat',
  'Bread',
  'Seafood',
  'Others',
];

const STORAGE_OPTIONS: {
  label: string;
  value: StorageLocation;
}[] = [
  { label: 'Fridge', value: 'fridge' },
  { label: 'Freezer', value: 'freezer' },
  { label: 'Pantry', value: 'pantry' },
];

const COLORS = {
  primary: '#1E2A16',
  secondary: '#55614D',
  background: '#FFFDF5',
  surface: '#FFFFFF',
  border: '#E4E5D4',
  divider: '#EEEFE5',
  accent: '#A6D45A',
  accentSoft: '#F0F7DB',
  pink: '#FBEFF2',
  pinkText: '#D82D69',
  error: '#9F2420',
  warning: '#8B6B1F',
  warningSoft: '#FFF0D5',
  errorSoft: '#FDE7E5',
};

export function ItemForm({
  initialValues = emptyValues,
  submitLabel,
  blockedReason = null,
  clearOnSubmit = false,
  expiryHelpText,
  topContent,
  bottomContent,
  onCategoryChange,
  onSubmit,
}: ItemFormProps) {
  const [name, setName] = useState(initialValues.name);
  const [quantity, setQuantity] = useState(initialValues.quantity);
  const [expiryDate, setExpiryDate] = useState(initialValues.expiryDate);
  const [reminderDaysBefore, setReminderDaysBefore] = useState(
    initialValues.reminderDaysBefore,
  );
  const [notes, setNotes] = useState(initialValues.notes);
  const [storageLocation, setStorageLocation] =
    useState<StorageLocation>(initialValues.storageLocation ?? 'fridge');
  const [selectedCategory, setSelectedCategory] = useState<FoodCategory>(
    initialValues.category ?? 'Others',
  );
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [errors, setErrors] = useState<ItemFormErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const insets = useSafeAreaInsets();

  // Keep your existing state and code below this line.

  const isSubmitDisabled = isSaving || blockedReason !== null;
  const typesTheDate = Platform.OS === 'web';
  const pickedDate = parseExpiryDate(expiryDate);

  function clearFieldError(field?: keyof ItemFormErrors) {
    setErrors((current) => ({
      ...current,
      ...(field ? { [field]: undefined } : {}),
      save: undefined,
    }));
  }

  function handleDatePicked(_event: unknown, date: Date) {
    setExpiryDate(toExpiryDateString(date));
    clearFieldError('expiryDate');
  }

  function openCalendar() {
    Keyboard.dismiss();

    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        mode: 'date',
        value: pickedDate ?? new Date(),
        onValueChange: handleDatePicked,
      });
      return;
    }

    if (!isCalendarOpen && !pickedDate) {
      setExpiryDate(toExpiryDateString(new Date()));
      clearFieldError('expiryDate');
    }

    setIsCalendarOpen((open) => !open);
  }

  function validateForm(): ItemFormErrors {
    const next: ItemFormErrors = {};
    const trimmedName = name.trim();
    const trimmedDate = expiryDate.trim();

    if (!trimmedName) next.name = 'Enter a name for this item.';

    if (!trimmedDate) {
      next.expiryDate = 'Choose an expiry date.';
    } else if (!parseExpiryDate(trimmedDate)) {
      next.expiryDate = 'Use a valid date in YYYY-MM-DD format.';
    }

    if (
      !Number.isInteger(reminderDaysBefore) ||
      reminderDaysBefore < 1 ||
      reminderDaysBefore > 7
    ) {
      next.reminderDaysBefore = 'Choose a reminder from 1 to 7 days.';
    }

    return next;
  }

  async function handleSubmit() {
    Keyboard.dismiss();

    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setIsCalendarOpen(false);
    setIsSaving(true);

    try {
      await onSubmit({
        name: name.trim(),
        quantity: quantity.trim() || '1 item',
        expiryDate: expiryDate.trim(),
        reminderDaysBefore,
        notes: notes.trim(),
        storageLocation,
        category: selectedCategory,
      });

      if (clearOnSubmit) {
        setName('');
        setQuantity('');
        setExpiryDate('');
        setReminderDaysBefore(1);
        setNotes('');
        setStorageLocation('fridge');
        setSelectedCategory('Others');
        setIsCalendarOpen(false);
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
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          topContent ? styles.contentWithTopContent : null,
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {topContent}
        {bottomContent}
        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>Name *</Text>
            <TextInput
              accessibilityLabel="Item name"
              autoCapitalize="words"
              editable={!isSaving}
              onChangeText={(value) => {
                setName(value);
                clearFieldError('name');
              }}
              placeholder="e.g. Baby spinach"
              placeholderTextColor="#7B8574"
              style={[styles.input, errors.name && styles.inputError]}
              value={name}
            />
            {errors.name ? (
              <Text style={styles.errorText}>{errors.name}</Text>
            ) : null}
          </View>

            <View style={styles.field}>
              <Text style={styles.label}>What kind of food?</Text>
              <Text style={styles.helpText}>
                Choose a category to help identify your food.
              </Text>
              <View style={styles.categoryOptions}>
                {FOOD_CATEGORIES.map((category) => {
                  const selected = selectedCategory === category;
                  return (
                    <Pressable
                      key={category}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      disabled={isSaving}
                      onPress={() => {
                        setSelectedCategory(category);
                        onCategoryChange?.(category);
                      }}
                      style={({ pressed }) => [
                        styles.categoryPill,
                        selected && styles.categoryPillSelected,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.categoryText,
                          selected && styles.categoryTextSelected,
                        ]}
                      >
                        {category}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          <View style={styles.twoColumns}>
            <View style={[styles.field, styles.column]}>
              <Text style={styles.label}>Quantity</Text>
              <TextInput
                accessibilityLabel="Quantity"
                editable={!isSaving}
                onChangeText={setQuantity}
                placeholder="e.g. 1 bag"
                placeholderTextColor="#7B8574"
                style={styles.input}
                value={quantity}
              />
            </View>

            <View style={[styles.field, styles.column]}>
              <Text style={styles.label}>Expiry date *</Text>
              {typesTheDate ? (
                <TextInput
                  accessibilityLabel="Expiry date in year month day format"
                  autoCapitalize="none"
                  editable={!isSaving}
                  inputMode="numeric"
                  maxLength={10}
                  onChangeText={(value) => {
                    setExpiryDate(formatExpiryDateInput(value));
                    clearFieldError('expiryDate');
                  }}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#7B8574"
                  style={[styles.input, errors.expiryDate && styles.inputError]}
                  value={expiryDate}
                />
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Expiry date, ${pickedDate ? formatWeekdayDate(pickedDate) : 'not chosen'}`}
                  disabled={isSaving}
                  onPress={openCalendar}
                  style={({ pressed }) => [
                    styles.input,
                    styles.dateButton,
                    errors.expiryDate && styles.inputError,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={pickedDate ? styles.dateText : styles.placeholder}
                  >
                    {pickedDate
                      ? formatWeekdayDate(pickedDate)
                      : 'Choose a date'}
                  </Text>
                  <Ionicons
                    name="calendar-outline"
                    size={19}
                    color={COLORS.primary}
                  />
                </Pressable>
              )}
            </View>
          </View>

          {isCalendarOpen ? (
            <View style={styles.calendar}>
              <DateTimePicker
                accentColor={COLORS.primary}
                display="inline"
                mode="date"
                onValueChange={handleDatePicked}
                value={pickedDate ?? new Date()}
              />
              <Pressable
                accessibilityRole="button"
                onPress={() => setIsCalendarOpen(false)}
                style={styles.calendarDone}
              >
                <Text style={styles.calendarDoneText}>Done</Text>
              </Pressable>
            </View>
          ) : null}

          {errors.expiryDate ? (
            <Text style={styles.errorText}>{errors.expiryDate}</Text>
          ) : expiryHelpText ? (
            <Text style={styles.helpText}>{expiryHelpText}</Text>
          ) : selectedCategory ? (
            <Text style={styles.helpText}>
              Check the package for its use-by date. Food type: {selectedCategory}.
            </Text>
          ) : (
            <Text style={styles.helpText}>
              Check the date printed on the package.
            </Text>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>Keep it in</Text>
            <View style={styles.storageOptions}>
              {STORAGE_OPTIONS.map((option) => {
                const selected = storageLocation === option.value;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    accessibilityLabel={option.label}
                    disabled={isSaving}
                    onPress={() => setStorageLocation(option.value)}
                    style={({ pressed }) => [
                      styles.storageOption,
                      selected && styles.storageOptionSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.storageOptionText,
                        selected && styles.storageOptionTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.reminderCard}>
            <View style={styles.reminderTop}>
              <View style={styles.reminderDescription}>
                <Text style={styles.reminderTitle}>Expiry reminder</Text>
                <Text style={styles.helpText}>
                  {reminderDaysBefore} {reminderDaysBefore === 1 ? 'day' : 'days'} before
                </Text>
              </View>

              <View style={styles.stepper}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Decrease reminder days"
                  disabled={isSaving || reminderDaysBefore <= 1}
                  onPress={() => {
                    setReminderDaysBefore((days) => Math.max(1, days - 1));
                    clearFieldError('reminderDaysBefore');
                  }}
                  style={({ pressed }) => [
                    styles.stepperButton,
                    (isSaving || reminderDaysBefore <= 1) && styles.stepperDisabled,
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons name="remove" size={21} color={COLORS.primary} />
                </Pressable>

                <Text style={styles.stepperValue}>{reminderDaysBefore}</Text>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Increase reminder days"
                  disabled={isSaving || reminderDaysBefore >= 7}
                  onPress={() => {
                    setReminderDaysBefore((days) => Math.min(7, days + 1));
                    clearFieldError('reminderDaysBefore');
                  }}
                  style={({ pressed }) => [
                    styles.stepperButton,
                    (isSaving || reminderDaysBefore >= 7) && styles.stepperDisabled,
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons name="add" size={21} color={COLORS.primary} />
                </Pressable>
              </View>
            </View>

            <View style={styles.reminderPreview}>
              <Ionicons
                name="notifications-outline"
                size={19}
                color={COLORS.primary}
              />
              <Text style={styles.reminderPreviewText}>
                You’ll get a reminder {reminderDaysBefore}{' '}
                {reminderDaysBefore === 1 ? 'day' : 'days'} before expiry.
              </Text>
            </View>
          </View>

          {errors.reminderDaysBefore ? (
            <Text style={styles.errorText}>{errors.reminderDaysBefore}</Text>
          ) : null}

          <View style={styles.field}>
            <Text style={styles.label}>Notes (optional)</Text>
            <TextInput
              accessibilityLabel="Notes"
              editable={!isSaving}
              multiline
              onChangeText={setNotes}
              placeholder="e.g. Opened on Monday"
              placeholderTextColor="#7B8574"
              style={[styles.input, styles.notesInput]}
              textAlignVertical="top"
              value={notes}
            />
          </View>

          {blockedReason ? (
            <View style={styles.notice}>
              <Ionicons name="hourglass-outline" size={19} color={COLORS.warning} />
              <Text style={styles.noticeText}>{blockedReason}</Text>
            </View>
          ) : null}

          {errors.save ? (
            <View style={styles.saveError}>
              <Ionicons name="warning-outline" size={19} color={COLORS.error} />
              <Text style={styles.errorText}>{errors.save}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View style={[
        styles.footer,
        { paddingBottom: Math.max(insets.bottom, 12) },]}
      >
        <Pressable
          accessibilityRole="button"
          disabled={isSubmitDisabled}
          onPress={() => void handleSubmit()}
          style={({ pressed }) => [
            styles.submitButton,
            pressed && styles.pressed,
            isSubmitDisabled && styles.disabledButton,
          ]}
        >
          <Text style={styles.submitButtonText}>
            {isSaving ? 'Saving...' : submitLabel}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  contentWithTopContent: {
    paddingTop: 0,
  },
  form: {
    gap: 18,
    marginTop: 22,
  },
  field: {
    gap: 7,
  },
  label: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_500Medium',
    fontSize: 15,
  },
  input: {
    minHeight: 54,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 17,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 16,
    color: COLORS.primary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 16,
  },
  inputError: {
    borderColor: COLORS.error,
  },
  placeholder: {
    color: '#7B8574',
    fontFamily: 'Fredoka_400Regular',
    fontSize: 15,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  dateText: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 15,
  },
  twoColumns: {
    flexDirection: 'row',
    gap: 12,
  },
  column: {
    flex: 1,
    minWidth: 0,
  },
  categoryOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 3,
  },
  categoryPill: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 24,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 16,
  },
  categoryPillSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  categoryText: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 14,
  },
  categoryTextSelected: {
    color: COLORS.surface,
    fontFamily: 'Fredoka_500Medium',
  },
  storageOptions: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 17,
    backgroundColor: '#F1F3E8',
    padding: 4,
  },
  storageOption: {
    flex: 1,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    paddingHorizontal: 3,
  },
  storageOptionSelected: {
    backgroundColor: COLORS.surface,
    shadowColor: '#1E2A16',
    shadowOpacity: 0.09,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  storageOptionText: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 14,
  },
  storageOptionTextSelected: {
    fontFamily: 'Fredoka_600SemiBold',
  },
  reminderCard: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
  },
  reminderTop: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  reminderDescription: {
    flex: 1,
    gap: 4,
  },
  reminderTitle: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_500Medium',
    fontSize: 17,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepperButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 24,
    backgroundColor: COLORS.surface,
  },
  stepperDisabled: {
    opacity: 0.4,
  },
  stepperValue: {
    minWidth: 20,
    color: COLORS.primary,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 19,
    textAlign: 'center',
  },
  reminderPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    backgroundColor: '#F5F6ED',
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  reminderPreviewText: {
    flex: 1,
    color: COLORS.secondary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 13,
    lineHeight: 19,
  },
  helpText: {
    color: COLORS.secondary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 13,
    lineHeight: 19,
  },
  errorText: {
    color: COLORS.error,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 12,
    lineHeight: 17,
  },
  calendar: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    padding: 8,
  },
  calendarDone: {
    alignSelf: 'flex-end',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  calendarDoneText: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 15,
  },
  notesInput: {
    minHeight: 88,
    paddingTop: 14,
    paddingBottom: 14,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 14,
    backgroundColor: COLORS.warningSoft,
    padding: 12,
  },
  noticeText: {
    flex: 1,
    color: COLORS.warning,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 13,
    lineHeight: 18,
  },
  saveError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    backgroundColor: COLORS.errorSoft,
    padding: 12,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 14,
  },
  submitButton: {
    minHeight: 62,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: COLORS.accent,
    paddingHorizontal: 18,
  },
  submitButtonText: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 17,
  },
  pressed: {
    opacity: 0.75,
  },
  disabledButton: {
    opacity: 0.55,
  },
});