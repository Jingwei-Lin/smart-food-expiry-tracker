import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { ItemForm, ItemFormValues } from '@/components/item-form';
import { useInventory } from '@/context/inventory-context';
import { getValidCategory } from '@/types/food-item';
import { returnToInventory } from '@/utils/navigation';

type ScanParams = {
  barcode?: string;
  name?: string;
  quantity?: string;
  expiryDate?: string;
  shelfLifeLabel?: string;
  category?: string;
  lookupOutcome?: string;
};

function describeScan(
  params: ScanParams,
): { tone: 'found' | 'manual'; title: string; text: string } | null {
  if (!params.barcode) return null;

  if (params.lookupOutcome === 'not-found') {
    return {
      tone: 'manual',
      title: "We couldn't find that barcode",
      text: "No problem. Fill it in and we'll still remind you.",
    };
  }

  if (params.lookupOutcome === 'unavailable' || params.lookupOutcome === 'error') {
    return {
      tone: 'manual',
      title: 'Could not look up this barcode',
      text: 'Enter the details manually and save your item.',
    };
  }

  return {
    tone: 'found',
    title: 'Found it',
    text: 'Filled in from Open Food Facts. Check it looks right.',
  };
}

const COLORS = {
  background: '#FFFDF5',
  surface: '#FFFFFF',
  primary: '#1E2A16',
  secondary: '#55614D',
  border: '#E4E5D4',
  divider: '#EEEFE5',
  accentSoft: '#F0F7DB',
  pink: '#FBEFF2',
  pinkText: '#D82D69',
  green: '#54852C',
};

export default function AddItemScreen() {
  const { addItem, isStorageReady, storageError } = useInventory();
  const params = useLocalSearchParams<ScanParams>();
  const insets = useSafeAreaInsets();

  const scanNotice = describeScan(params);
  const scannedCategory = params.category ? getValidCategory(params.category) : undefined;

  async function handleSubmit(values: ItemFormValues) {
    await addItem({
      ...values,
      barcode: typeof params.barcode === 'string' ? params.barcode : undefined,
    });

    returnToInventory();
  }

  const topContent = (
    <View>
      <View style={styles.headingRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              returnToInventory();
            }
          }}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressedButton]}
        >
          <Ionicons name="chevron-back" size={25} color={COLORS.primary} />
        </Pressable>

        <Text style={styles.title}>Add food</Text>
      </View>

      <View
        style={[
          styles.noticeCard,
          scanNotice?.tone === 'manual' ? styles.warningCard : styles.successCard,
        ]}
      >
        <View style={styles.noticeIcon}>
          <Ionicons
            name={
              scanNotice?.tone === 'manual'
                ? 'alert-circle-outline'
                : scanNotice
                  ? 'checkmark-circle-outline'
                  : 'information-circle-outline'
            }
            size={22}
            color={scanNotice?.tone === 'manual' ? COLORS.pinkText : COLORS.green}
          />
        </View>

        <View style={styles.noticeContent}>
          <Text style={styles.noticeTitle}>{scanNotice?.title ?? 'Add your groceries'}</Text>

          <Text style={styles.noticeText}>
            {scanNotice?.text ??
              'Enter your food details below so we can help you keep track of expiry dates.'}
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
      style={[styles.screen, { paddingTop: insets.top + 10 }]}
    >
      <ItemForm
        key={JSON.stringify([
          params.barcode,
          params.name,
          params.quantity,
          params.expiryDate,
          scannedCategory,
        ])}
        topContent={topContent}
        blockedReason={
          isStorageReady
            ? null
            : (storageError ?? 'Loading your saved inventory. Saving will be enabled in a moment.')
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
          storageLocation: 'fridge',
          category: scannedCategory ?? 'Others',
        }}
        onSubmit={handleSubmit}
        submitLabel={(storageLocation) => `Add to ${storageLocation}`}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headingRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  backButton: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.divider,
    borderRadius: 28,
    backgroundColor: '#F1F3E8',
  },
  title: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 26,
    lineHeight: 34,
  },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    borderRadius: 18,
    padding: 15,
  },
  successCard: {
    backgroundColor: COLORS.accentSoft,
  },
  warningCard: {
    backgroundColor: COLORS.pink,
  },
  noticeIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: COLORS.surface,
  },
  noticeContent: {
    flex: 1,
    gap: 4,
    paddingTop: 1,
  },
  noticeTitle: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_500Medium',
    fontSize: 16,
  },
  noticeText: {
    color: COLORS.secondary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 13,
    lineHeight: 19,
  },
  pressedButton: {
    opacity: 0.72,
  },
});
