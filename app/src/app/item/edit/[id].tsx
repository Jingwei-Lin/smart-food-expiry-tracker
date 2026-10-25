
import { useState } from 'react';
import { ArrowLeft } from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FoodCategoryIcon } from '@/components/food-category-icon';
import { ItemForm, ItemFormValues } from '@/components/item-form';
import { useInventory } from '@/context/inventory-context';
import type { FoodCategory } from '@/types/food-item';
import { returnToInventory } from '@/utils/navigation';

const FOOD_CATEGORIES: FoodCategory[] = [
  'Veg',
  'Fruit',
  'Dairy',
  'Meat',
  'Bread',
  'Seafood',
  'Others',
];

function getValidCategory(category?: FoodCategory): FoodCategory {
  return category && FOOD_CATEGORIES.includes(category)
    ? category
    : 'Others';
}

const COLORS = {
  background: '#FFFDF5',
  surface: '#FFFFFF',
  primary: '#1E2A16',
  secondary: '#55614D',
  border: '#E4E5D4',
  divider: '#EEEFE5',
  accent: '#A6D45A',
  accentSoft: '#F0F7DB',
};

export default function EditItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [selectedCategory, setSelectedCategory] =
    useState<FoodCategory | undefined>();

  const {
    items,
    isLoading,
    isStorageReady,
    storageError,
    updateItem,
  } = useInventory();

  const item = items.find((candidate) => candidate.id === id);

  async function handleSubmit(values: ItemFormValues) {
    await updateItem(id, {
      ...values,
      storageLocation: values.storageLocation ?? item?.storageLocation ?? 'fridge',
      category: values.category,
    });

    returnToInventory();
  }

  function handleGoBack() {
    if (router.canGoBack()) {
      router.back();
    } else {
      returnToInventory();
    }
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

        <Pressable
          accessibilityRole="button"
          onPress={returnToInventory}
          style={({ pressed }) => [
            styles.returnButton,
            pressed && styles.pressedButton,
          ]}
        >
          <Text style={styles.returnButtonText}>
            Back to inventory
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
      style={styles.screen}
    >
      <ItemForm
        topContent={
          <View
            style={[
              styles.heading,
              { paddingTop: insets.top + 10 },
            ]}
          >
            <View style={styles.headingRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Go back"
                onPress={handleGoBack}
                style={({ pressed }) => [
                  styles.backButton,
                  pressed && styles.pressedButton,
                ]}
              >
                <ArrowLeft
                  size={23}
                  color={COLORS.primary}
                  strokeWidth={2}
                />
              </Pressable>

              <Text style={styles.title}>Edit item</Text>
            </View>

            <View style={styles.itemInfo}>
              <FoodCategoryIcon
                category={selectedCategory ?? getValidCategory(item.category)}
                size={22}
              />

              <Text style={styles.subtitle} numberOfLines={2}>
                Update the details for {item.name}.
              </Text>
            </View>
          </View>
        }
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
          category: getValidCategory(item.category),
        }}
        onSubmit={handleSubmit}
        onCategoryChange={setSelectedCategory}
        submitLabel="Save changes"
      />
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
    gap: 12,
    paddingBottom: 14,
  },
  headingRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  backButton: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.divider,
    borderRadius: 26,
    backgroundColor: COLORS.surface,
  },
  itemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 26,
    lineHeight: 34,
  },
  subtitle: {
    flex: 1,
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
  returnButton: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: COLORS.accent,
  },
  returnButtonText: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_500Medium',
    fontSize: 15,
  },
  pressedButton: {
    opacity: 0.72,
  },
});
