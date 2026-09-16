import { Ionicons } from '@expo/vector-icons';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ItemForm, ItemFormValues } from '@/components/item-form';
import { useInventory } from '@/context/inventory-context';
import { returnToInventory } from '@/utils/navigation';

/**
 * Add / Scan screen.
 *
 * The entry point for putting a new grocery item into the inventory, either by
 * scanning its barcode and letting the product details fill in automatically,
 * or by typing the item in by hand. Pushed over the inventory by its add
 * button, so saving returns to the list underneath.
 */
export default function AddItemScreen() {
  const { addItem, isStorageReady, storageError } = useInventory();

  async function handleSubmit(values: ItemFormValues) {
    await addItem(values);

    returnToInventory();
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

        <ItemForm
          blockedReason={
            isStorageReady
              ? null
              : (storageError ??
                'Loading your saved inventory. Saving will be enabled in a moment.')
          }
          clearOnSubmit
          onSubmit={handleSubmit}
          submitLabel="Save item"
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
});
