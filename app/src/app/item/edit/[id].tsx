import { useLocalSearchParams } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ItemForm, ItemFormValues } from '@/components/item-form';
import { useInventory } from '@/context/inventory-context';
import { returnToInventory } from '@/utils/navigation';

const COLORS = {
  background: '#FFFDF5',
  surface: '#FFFFFF',
  primary: '#1E2A16',
  secondary: '#55614D',
  border: '#E4E5D4',
  accent: '#A6D45A',
};

export default function EditItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    items,
    isLoading,
    isStorageReady,
    storageError,
    updateItem,
  } = useInventory();

  const headerHeight = useHeaderHeight();
  const item = items.find((candidate) => candidate.id === id);

  async function handleSubmit(values: ItemFormValues) {
    await updateItem(id, values);
    returnToInventory();
  }

  if (isLoading) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.centeredText}>Loading item...</Text>
      </View>
    );
  }

  if (!item) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.title}>Item not found</Text>
        <Text style={styles.centeredText}>
          This item may have been removed, so there is nothing to edit.
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior="padding"
      keyboardVerticalOffset={headerHeight}
      style={styles.screen}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heading}>
          <Text style={styles.eyebrow}>YOUR INVENTORY</Text>

          <Text style={styles.title}>Edit item</Text>

          <Text style={styles.subtitle}>
            Update the details for {item.name}.
          </Text>
        </View>

        <ItemForm
          blockedReason={
            isStorageReady
              ? null
              : storageError ??
                'Loading your saved inventory. Saving will be enabled in a moment.'
          }
          initialValues={{
            name: item.name,
            quantity: item.quantity,
            expiryDate: item.expiryDate,
            reminderDaysBefore: item.reminderDaysBefore,
            notes: item.notes,
            storageLocation: item.storageLocation,
          }}
          onSubmit={handleSubmit}
          submitLabel="Save changes"
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centeredContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: COLORS.background,
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  heading: {
    gap: 6,
    paddingBottom: 4,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
  },
  eyebrow: {
    color: COLORS.secondary,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 13,
    letterSpacing: 1.2,
  },
  title: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 26,
    lineHeight: 34,
  },
  subtitle: {
    marginTop: 2,
    color: COLORS.secondary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 15,
    lineHeight: 22,
  },
  centeredText: {
    color: COLORS.secondary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
});