import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ComponentProps, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ExpiryBadge } from '@/components/expiry-badge';
import { useInventory } from '@/context/inventory-context';
import { returnToInventory } from '@/utils/navigation';
import { ResolvedFoodItemStatus } from '@/types/food-item';
import { formatDayMonthYear, formatExpiryDate } from '@/utils/expiry-date';

type IconName = ComponentProps<typeof Ionicons>['name'];

const resolvedStatusLabels: Record<ResolvedFoodItemStatus, string> = {
  eaten: 'Eaten',
  discarded: 'Thrown out',
  donated: 'Donated',
};

/**
 * Formats the moment an item was eaten, thrown out or donated.
 */
function formatResolvedDate(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return formatDayMonthYear(date);
}

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { items, isLoading, isStorageReady, storageError, deleteItem, resolveItem } =
    useInventory();

  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const item = items.find((candidate) => candidate.id === id);

  /*
   * Every action writes to storage, so they are all blocked while the saved
   * inventory is still loading or failed to load.
   */
  const areActionsDisabled = isWorking || !isStorageReady;

  async function runAction(action: () => Promise<void>, failureMessage: string) {
    setActionError(null);
    setIsWorking(true);

    try {
      await action();

      returnToInventory();
    } catch {
      setActionError(failureMessage);
    } finally {
      setIsWorking(false);
    }
  }

  function handleResolve(status: ResolvedFoodItemStatus) {
    void runAction(
      () => resolveItem(id, status),
      'This item could not be updated. Please try again.',
    );
  }

  function handleDelete() {
    void runAction(() => deleteItem(id), 'This item could not be deleted. Please try again.');
  }

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2f7d32" />
        <Text style={styles.loadingText}>Loading item...</Text>
      </View>
    );
  }

  if (!item) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'Item not found',
          }}
        />

        <View style={styles.notFoundContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#687269" />

          <Text style={styles.notFoundTitle}>Item not found</Text>

          <Text style={styles.notFoundText}>
            This item may have been removed or is no longer available.
          </Text>

          <Pressable
            accessibilityRole="button"
            onPress={returnToInventory}
            style={({ pressed }) => [styles.returnButton, pressed ? styles.pressedButton : null]}
          >
            <Text style={styles.returnButtonText}>Back to inventory</Text>
          </Pressable>
        </View>
      </>
    );
  }

  const resolvedDate = formatResolvedDate(item.statusUpdatedAt);

  return (
    <>
      <Stack.Screen
        options={{
          title: item.name,
        }}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.summaryCard}>
          <View style={styles.itemIcon}>
            <Ionicons name="nutrition-outline" size={32} color="#2f7d32" />
          </View>

          <Text style={styles.itemName}>{item.name}</Text>

          {item.status === 'active' ? (
            <ExpiryBadge expiryDate={item.expiryDate} />
          ) : (
            <Text style={styles.resolvedLabel}>
              {resolvedStatusLabels[item.status]}
              {resolvedDate ? ` on ${resolvedDate}` : ''}
            </Text>
          )}
        </View>

        <Text style={styles.sectionTitle}>ITEM DETAILS</Text>

        <View style={styles.detailsCard}>
          <DetailRow
            icon="calendar-outline"
            label="Expiry date"
            value={formatExpiryDate(item.expiryDate)}
          />

          <View style={styles.divider} />

          <DetailRow
            icon="notifications-outline"
            label="Reminders"
            value={`${item.reminderDaysBefore} ${item.reminderDaysBefore === 1 ? 'day' : 'days'} before and on expiry day`}
          />

          <View style={styles.divider} />

          <DetailRow icon="cube-outline" label="Quantity" value={item.quantity} />

          {item.notes ? (
            <>
              <View style={styles.divider} />

              <DetailRow icon="document-text-outline" label="Notes" value={item.notes} />
            </>
          ) : null}
        </View>

        <Text style={styles.sectionTitle}>ACTIONS</Text>

        {actionError ? (
          <View style={styles.banner}>
            <Ionicons name="warning-outline" size={19} color="#8b2c25" />

            <Text style={styles.bannerText}>{actionError}</Text>
          </View>
        ) : null}

        {!isStorageReady ? (
          <View style={styles.notice}>
            <Ionicons name="hourglass-outline" size={19} color="#8b6b1f" />

            <Text style={styles.noticeText}>
              {storageError ??
                'Loading your saved inventory. These actions will be enabled in a moment.'}
            </Text>
          </View>
        ) : null}

        {isConfirmingDelete ? (
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Delete {item.name}?</Text>

            <Text style={styles.confirmText}>
              This removes the item from your inventory and from the waste summary. It cannot be
              undone.
            </Text>

            <View style={styles.confirmButtons}>
              <Pressable
                accessibilityRole="button"
                disabled={isWorking}
                onPress={() => setIsConfirmingDelete(false)}
                style={({ pressed }) => [
                  styles.confirmCancelButton,
                  pressed ? styles.pressedButton : null,
                ]}
              >
                <Text style={styles.confirmCancelText}>Keep item</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                disabled={areActionsDisabled}
                onPress={handleDelete}
                style={({ pressed }) => [
                  styles.confirmDeleteButton,
                  pressed ? styles.pressedButton : null,
                  areActionsDisabled ? styles.disabledButton : null,
                ]}
              >
                <Text style={styles.confirmDeleteText}>{isWorking ? 'Deleting...' : 'Delete'}</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.actionsCard}>
            {item.status === 'active' ? (
              <>
                {/*
                 * Goes back to the tabs already underneath rather than pushing
                 * a second copy of them, and opens Recipes with this item ticked.
                 */}
                <ActionButton
                  icon="book-outline"
                  isDisabled={areActionsDisabled}
                  label="Find recipes"
                  onPress={() =>
                    router.dismissTo({ pathname: '/recipes', params: { select: item.id } })
                  }
                />

                <View style={styles.divider} />

                {/*
                 * The same way back to the tabs, for food the student can't
                 * finish, listing the places near the phone. It saves nothing,
                 * so only a save already running holds it back.
                 */}
                <ActionButton
                  icon="location-outline"
                  isDisabled={isWorking}
                  label="Find donation point"
                  onPress={() =>
                    router.dismissTo({ pathname: '/donation-points', params: { near: 'phone' } })
                  }
                />

                <View style={styles.divider} />

                <ActionButton
                  icon="create-outline"
                  isDisabled={areActionsDisabled}
                  label="Edit item"
                  onPress={() =>
                    router.push({ pathname: '/item/edit/[id]', params: { id: item.id } })
                  }
                />

                <View style={styles.divider} />

                <ActionButton
                  icon="restaurant-outline"
                  isDisabled={areActionsDisabled}
                  label="Mark as eaten"
                  onPress={() => handleResolve('eaten')}
                />

                <View style={styles.divider} />

                <ActionButton
                  icon="trash-bin-outline"
                  isDisabled={areActionsDisabled}
                  label="Mark as thrown out"
                  onPress={() => handleResolve('discarded')}
                />

                <View style={styles.divider} />

                <ActionButton
                  icon="heart-outline"
                  isDisabled={areActionsDisabled}
                  label="Mark as donated"
                  onPress={() => handleResolve('donated')}
                />

                <View style={styles.divider} />
              </>
            ) : null}

            <ActionButton
              icon="close-circle-outline"
              isDanger
              isDisabled={areActionsDisabled}
              label="Delete item"
              onPress={() => setIsConfirmingDelete(true)}
            />
          </View>
        )}
      </ScrollView>
    </>
  );
}

function DetailRow({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon} size={22} color="#537059" />

      <View style={styles.detailText}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

function ActionButton({
  icon,
  isDanger = false,
  isDisabled,
  label,
  onPress,
}: {
  icon: IconName;
  isDanger?: boolean;
  isDisabled: boolean;
  label: string;
  onPress: () => void;
}) {
  const tint = isDanger ? '#9f2420' : '#2f6b34';

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        pressed ? styles.pressedButton : null,
        isDisabled ? styles.disabledButton : null,
      ]}
    >
      <Ionicons name={icon} size={22} color={tint} />

      <Text style={[styles.actionLabel, { color: tint }]}>{label}</Text>

      <Ionicons name="chevron-forward" size={18} color="#a2aea5" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#f6f8f3',
  },
  loadingText: {
    color: '#59635b',
    fontSize: 15,
  },
  notFoundContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f6f8f3',
    padding: 24,
  },
  notFoundTitle: {
    marginTop: 14,
    color: '#172019',
    fontSize: 22,
    fontWeight: '700',
  },
  notFoundText: {
    marginTop: 7,
    color: '#687269',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  returnButton: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    borderRadius: 14,
    backgroundColor: '#2f7d32',
    paddingHorizontal: 20,
  },
  returnButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  content: {
    flexGrow: 1,
    backgroundColor: '#f6f8f3',
    padding: 20,
    paddingBottom: 40,
  },
  summaryCard: {
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#dce4da',
    borderRadius: 20,
    backgroundColor: '#ffffff',
    padding: 24,
  },
  itemIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#e7f4e8',
  },
  itemName: {
    marginTop: 14,
    marginBottom: 10,
    color: '#172019',
    fontSize: 25,
    fontWeight: '800',
    textAlign: 'center',
  },
  resolvedLabel: {
    color: '#5e6260',
    fontSize: 14,
    fontWeight: '700',
  },
  sectionTitle: {
    marginTop: 26,
    marginBottom: 9,
    color: '#687269',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.9,
  },
  detailsCard: {
    borderWidth: 1,
    borderColor: '#dce4da',
    borderRadius: 16,
    backgroundColor: '#ffffff',
    padding: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  detailText: {
    flex: 1,
  },
  detailLabel: {
    color: '#718075',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  detailValue: {
    marginTop: 3,
    color: '#253028',
    fontSize: 16,
    lineHeight: 22,
  },
  divider: {
    height: 1,
    marginVertical: 14,
    backgroundColor: '#e4e9e3',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: '#fde7e5',
    padding: 12,
  },
  bannerText: {
    flex: 1,
    color: '#8b2c25',
    fontSize: 13,
    lineHeight: 18,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: '#fff0d5',
    padding: 12,
  },
  noticeText: {
    flex: 1,
    color: '#8b6b1f',
    fontSize: 13,
    lineHeight: 18,
  },
  actionsCard: {
    borderWidth: 1,
    borderColor: '#dce4da',
    borderRadius: 16,
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  actionButton: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  confirmCard: {
    borderWidth: 1,
    borderColor: '#f0c9c4',
    borderRadius: 16,
    backgroundColor: '#ffffff',
    padding: 16,
  },
  confirmTitle: {
    color: '#172019',
    fontSize: 17,
    fontWeight: '700',
  },
  confirmText: {
    marginTop: 7,
    color: '#687269',
    fontSize: 13,
    lineHeight: 19,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  confirmCancelButton: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#cad4c9',
    borderRadius: 12,
  },
  confirmCancelText: {
    color: '#3c463e',
    fontSize: 15,
    fontWeight: '700',
  },
  confirmDeleteButton: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#9f2420',
  },
  confirmDeleteText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  pressedButton: {
    opacity: 0.72,
  },
  disabledButton: {
    opacity: 0.55,
  },
});
