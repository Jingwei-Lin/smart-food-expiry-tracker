import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { parseExpiryDate } from '@/utils/expiry-date';

type FormErrors = {
  name?: string;
  expiryDate?: string;
};

export default function AddItemScreen() {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});

  function handleNameChange(value: string) {
    setName(value);

    if (errors.name) {
      setErrors((currentErrors) => ({
        ...currentErrors,
        name: undefined,
      }));
    }
  }

  function handleExpiryDateChange(value: string) {
    setExpiryDate(value);

    if (errors.expiryDate) {
      setErrors((currentErrors) => ({
        ...currentErrors,
        expiryDate: undefined,
      }));
    }
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

  function handleSubmit() {
    const validationErrors = validateForm();

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});

    const trimmedName = name.trim();
    const displayedQuantity = quantity.trim() || '1 item';

    Alert.alert(
      'Item details are valid',
      `${trimmedName}, ${displayedQuantity}, expiring ${expiryDate.trim()} is ready to be saved.`,
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
              onChangeText={setQuantity}
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
              <Text style={styles.helpText}>Enter the date printed on the package.</Text>
            )}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Notes</Text>

            <TextInput
              accessibilityLabel="Notes"
              multiline
              onChangeText={setNotes}
              placeholder="e.g. Opened on Monday"
              placeholderTextColor="#8a938c"
              style={[styles.input, styles.notesInput]}
              textAlignVertical="top"
              value={notes}
            />
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={handleSubmit}
          style={({ pressed }) => [
            styles.submitButton,
            pressed ? styles.pressedButton : null,
          ]}
        >
          <Ionicons name="checkmark-circle-outline" size={21} color="#ffffff" />
          <Text style={styles.submitButtonText}>Validate item</Text>
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
  submitButton: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 26,
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
});