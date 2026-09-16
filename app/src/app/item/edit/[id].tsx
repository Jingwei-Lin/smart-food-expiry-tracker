import { useLocalSearchParams } from 'expo-router';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ItemForm, ItemFormValues } from '@/components/item-form';
import { useInventory } from '@/context/inventory-context';
import { returnToInventory } from '@/utils/navigation';

/**
 * Edit an item already in the inventory.
 *
 * Lives beside the detail screen rather than inside it so that cancelling an
 * edit is just a back press, with nothing saved.
 */
export default function EditItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { items, isLoading, isStorageReady, storageError, updateItem } = useInventory();

  const item = items.find((candidate) => candidate.id === id);

  async function handleSubmit(values: ItemFormValues) {
    await updateItem(id, values);

    returnToInventory();
  }

  if (isLoading) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color="#2f7d32" />
        <Text style={styles.centeredText}>Loading item...</Text>
      </View>
    );
  }

  if (!item) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.centeredText}>
          This item may have been removed, so there is nothing to edit.
        </Text>
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
        <Text style={styles.eyebrow}>EDIT ITEM</Text>
        <Text style={styles.title}>{item.name}</Text>

        <Text style={styles.subtitle}>
          Correct the details or push the expiry date back after checking the package.
        </Text>

        <ItemForm
          blockedReason={
            isStorageReady
              ? null
              : (storageError ??
                'Loading your saved inventory. Saving will be enabled in a moment.')
          }
          initialValues={{
            name: item.name,
            quantity: item.quantity,
            expiryDate: item.expiryDate,
            notes: item.notes,
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
    backgroundColor: '#f6f8f3',
  },
  centeredContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#f6f8f3',
    padding: 24,
  },
  centeredText: {
    color: '#59635b',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
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
    fontSize: 30,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 7,
    color: '#59635b',
    fontSize: 15,
    lineHeight: 22,
  },
});
