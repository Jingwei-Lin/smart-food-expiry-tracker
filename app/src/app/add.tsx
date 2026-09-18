import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ItemForm, ItemFormValues } from '@/components/item-form';
import { useInventory } from '@/context/inventory-context';
import { returnToInventory } from '@/utils/navigation';

type ScanParams = {
  barcode?: string;
  name?: string;
  quantity?: string;
  expiryDate?: string;
  shelfLifeLabel?: string;
  lookupOutcome?: string;
};

/**
 * Describes what the scanner came back with, so the student knows whether the
 * fields below were filled in for them or are still blank on purpose.
 */
function describeScan(params: ScanParams): { tone: 'found' | 'manual'; text: string } | null {
  if (!params.barcode) {
    return null;
  }

  if (params.lookupOutcome === 'not-found') {
    return {
      tone: 'manual',
      text: `Barcode ${params.barcode} is not in Open Food Facts yet. Add the item by hand — it will still be saved against the barcode.`,
    };
  }

  if (params.lookupOutcome === 'unavailable') {
    return {
      tone: 'manual',
      text: `Could not reach Open Food Facts to look up ${params.barcode}. Add the item by hand, or try the scan again with a connection.`,
    };
  }

  return { tone: 'found', text: `Scanned ${params.barcode} — check the details before saving.` };
}

/**
 * Add item screen.
 *
 * Reached from the scanner, either carrying a product it recognised or empty
 * when it could not. Everything it fills in is an ordinary form field, so the
 * student can correct any of it before saving.
 */
export default function AddItemScreen() {
  const { addItem, isStorageReady, storageError } = useInventory();
  const params = useLocalSearchParams<ScanParams>();

  const scanNotice = describeScan(params);

  async function handleSubmit(values: ItemFormValues) {
    await addItem({ ...values, barcode: params.barcode });

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
        <Text style={styles.eyebrow}>{params.barcode ? 'SCANNED ITEM' : 'MANUAL ENTRY'}</Text>
        <Text style={styles.title}>Add grocery item</Text>

        <Text style={styles.subtitle}>
          {params.barcode
            ? 'Correct anything the scan got wrong, then save it.'
            : 'Add loose produce or an item without a barcode.'}
        </Text>

        <View style={scanNotice?.tone === 'manual' ? styles.warningCard : styles.informationCard}>
          <Ionicons
            color={scanNotice?.tone === 'manual' ? '#8b6b1f' : '#2f7d32'}
            name={
              scanNotice?.tone === 'manual' ? 'alert-circle-outline' : 'information-circle-outline'
            }
            size={22}
          />

          <Text style={scanNotice?.tone === 'manual' ? styles.warningText : styles.informationText}>
            {scanNotice?.text ??
              'Required fields are marked with an asterisk. You can add quantity and notes if they are useful.'}
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
          expiryHelpText={
            params.shelfLifeLabel
              ? `Estimated from "${params.shelfLifeLabel}" — check the package and correct it.`
              : undefined
          }
          initialValues={{
            name: params.name ?? '',
            quantity: params.quantity ?? '',
            expiryDate: params.expiryDate ?? '',
            reminderDaysBefore: 1,
            notes: '',
          }}
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
  warningCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 22,
    borderRadius: 14,
    backgroundColor: '#fff0d5',
    padding: 14,
  },
  warningText: {
    flex: 1,
    color: '#8b6b1f',
    fontSize: 13,
    lineHeight: 19,
  },
});
