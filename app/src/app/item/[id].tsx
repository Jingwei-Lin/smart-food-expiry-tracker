import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FoodCategoryIcon } from '@/components/food-category-icon';
import { useInventory } from '@/context/inventory-context';
import { returnToInventory } from '@/utils/navigation';
import type { FoodStorageLocation, ResolvedFoodItemStatus } from '@/types/food-item';
import { describeDeletion } from '@/utils/delete-confirm';
import {
  daysUntilExpiry,
  describeReminders,
  formatDayMonthYear,
  formatExpiryDate,
  getExpiryPresentation,
} from '@/utils/expiry-date';

const COLORS = {
  background: '#FFFDF5',
  surface: '#FFFFFF',
  primary: '#1E2A16',
  secondary: '#55614D',
  border: '#E4E5D4',
  accent: '#A6D45A',
  accentSoft: '#F0F7DB',
  urgent: '#A92E26',
  urgentSoft: '#FBEFF2',
  warning: '#8B6B1F',
  warningSoft: '#FFF0D5',
  error: '#8B2C25',
  errorSoft: '#FDE7E5',
};

const STORAGE_LABELS: Record<FoodStorageLocation, string> = {
  fridge: 'Fridge',
  freezer: 'Freezer',
  pantry: 'Pantry',
};

const STATUS_LABELS: Record<ResolvedFoodItemStatus, string> = {
  eaten: 'Eaten',
  discarded: 'Thrown out',
  donated: 'Donated',
};

/** Null for a missing or unreadable timestamp, so the line can be left out. */
function formatStoredDate(value: string | undefined): string | null {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return formatDayMonthYear(date);
}

function getExpiryHeadline(days: number): string {
  if (!Number.isFinite(days)) return 'Check expiry date';

  if (days < 0) {
    const overdue = Math.abs(days);
    return `Expired ${overdue} ${overdue === 1 ? 'day' : 'days'} ago`;
  }

  if (days === 0) return 'Expires today';
  if (days === 1) return 'Expires tomorrow';

  return `Expires in ${days} days`;
}

function getExpiryHint(days: number): string {
  if (!Number.isFinite(days)) {
    return 'Check the expiry date for this item.';
  }

  if (days < 0) {
    return 'Check the food before deciding whether to use it.';
  }

  if (days <= 3) {
    return 'Consider using it soon to help reduce food waste.';
  }

  return 'Keep an eye on the expiry date.';
}

/** Pops one screen. A reminder or a link can open this one with nothing underneath. */
function BackButton() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Go back"
      onPress={returnToInventory}
      style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
    >
      <Ionicons name="chevron-back" size={25} color={COLORS.primary} />
    </Pressable>
  );
}

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  const { items, isLoading, isStorageReady, storageError, deleteItem, resolveItem } =
    useInventory();

  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<ResolvedFoodItemStatus | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const item = items.find((candidate) => candidate.id === id);
  const actionsDisabled = isWorking || !isStorageReady;

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
      setPendingStatus(null);
    }
  }

  function handleResolve(status: ResolvedFoodItemStatus) {
    setPendingStatus(status);

    void runAction(
      () => resolveItem(id, status),
      'This item could not be updated. Please try again.',
    );
  }

  function handleDelete() {
    void runAction(() => deleteItem(id), 'This item could not be deleted. Please try again.');
  }

  function openEdit() {
    if (!item) return;

    router.push({
      pathname: '/item/edit/[id]',
      params: { id: item.id },
    });
  }

  function openRecipes() {
    if (!item) return;

    router.dismissTo({
      pathname: '/recipes',
      params: { select: item.id },
    });
  }

  function openDonationPoints() {
    router.dismissTo({
      pathname: '/donation-points',
      params: { near: 'phone' },
    });
  }

  if (isLoading) {
    return (
      <View style={styles.screen}>
        <View style={[styles.header, styles.loadingHeader, { paddingTop: insets.top + 10 }]}>
          <BackButton />
        </View>

        <View style={styles.centeredContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.centeredText}>Loading item...</Text>
        </View>
      </View>
    );
  }

  if (!item) {
    return (
      <View style={[styles.centeredContainer, { paddingTop: insets.top + 24 }]}>
        <Ionicons name="alert-circle-outline" size={42} color={COLORS.secondary} />

        <Text style={styles.notFoundTitle}>Item not found</Text>

        <Text style={styles.centeredText}>
          This item may have been removed or is no longer available.
        </Text>

        <Pressable accessibilityRole="button" onPress={returnToInventory} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back to inventory</Text>
        </Pressable>
      </View>
    );
  }

  const isActive = item.status === 'active';
  const statusLabel = item.status === 'active' ? null : STATUS_LABELS[item.status];
  const daysLeft = daysUntilExpiry(item.expiryDate);
  const expiry = getExpiryPresentation(item.expiryDate);
  const deletion = describeDeletion(item);
  /* A donation point's page only offers food still in date, so expired food has nowhere to go. */
  const canDonate = Number.isFinite(daysLeft) && daysLeft >= 0;
  const addedOn = formatStoredDate(item.createdAt);
  const updatedOn = formatStoredDate(item.statusUpdatedAt);

  /* An item can have no quantity, and the separator belongs only between two parts. */
  const itemMeta = [item.quantity.trim(), addedOn ? `Added ${addedOn}` : '']
    .filter(Boolean)
    .join(' · ');
  /*
   * Web never schedules reminders, so "Not set" there would send the student
   * to Edit for nothing.
   */
  const reminderDescription =
    Platform.OS === 'web' ? 'Not available on web' : describeReminders(item);

  const deleteToggle = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={isConfirmingDelete ? 'Cancel delete' : `Delete ${item.name}`}
      disabled={actionsDisabled}
      onPress={() => setIsConfirmingDelete((current) => !current)}
      style={styles.deleteLink}
    >
      <Text style={styles.deleteLinkText}>
        {isConfirmingDelete ? 'Cancel delete' : 'Delete item'}
      </Text>
    </Pressable>
  );

  const deleteConfirm = isConfirmingDelete ? (
    <View style={styles.deleteConfirmCard}>
      <Text style={styles.deleteConfirmTitle}>{deletion.title}</Text>

      <Text style={styles.deleteConfirmText}>{deletion.message}</Text>

      <View style={styles.confirmButtons}>
        <Pressable
          accessibilityRole="button"
          disabled={isWorking}
          onPress={() => setIsConfirmingDelete(false)}
          style={styles.cancelDeleteButton}
        >
          <Text style={styles.cancelDeleteText}>Keep item</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          disabled={actionsDisabled}
          onPress={handleDelete}
          style={[styles.confirmDeleteButton, actionsDisabled && styles.disabled]}
        >
          <Text style={styles.confirmDeleteText}>{isWorking ? 'Deleting...' : 'Delete'}</Text>
        </Pressable>
      </View>
    </View>
  ) : null;

  // This is a qualitative urgency indicator, not a shelf-life percentage.
  const urgencyWidth = !Number.isFinite(daysLeft)
    ? '0%'
    : daysLeft <= 0
      ? '100%'
      : daysLeft === 1
        ? '85%'
        : daysLeft <= 3
          ? '70%'
          : daysLeft <= 7
            ? '45%'
            : '20%';

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom: isActive ? 145 + insets.bottom : 24 + insets.bottom,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <BackButton />

          <View style={styles.headerSpacer} />

          {isActive ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Edit ${item.name}`}
              onPress={openEdit}
              style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}
            >
              <Ionicons name="create-outline" size={23} color={COLORS.primary} />
            </Pressable>
          ) : (
            <View style={styles.headerSpacer} />
          )}
        </View>

        <View
          style={[
            styles.summary,
            {
              backgroundColor: isActive ? expiry.background : COLORS.accentSoft,
            },
          ]}
        >
          <View style={styles.foodIcon}>
            <FoodCategoryIcon
              category={item.category}
              size={28}
              color={COLORS.primary}
              backgroundColor={COLORS.accentSoft}
            />
          </View>

          <View style={styles.summaryDetails}>
            <View style={styles.storagePill}>
              <Text style={styles.storageText}>{STORAGE_LABELS[item.storageLocation]}</Text>
            </View>

            <Text accessibilityRole="header" style={styles.itemName}>
              {item.name}
            </Text>

            {itemMeta ? <Text style={styles.itemMeta}>{itemMeta}</Text> : null}

            {isActive ? (
              <View style={styles.statusBadge}>
                <Text style={[styles.statusBadgeText, { color: expiry.foreground }]}>
                  {getExpiryHeadline(daysLeft)}
                </Text>
              </View>
            ) : (
              <View style={styles.statusBadge}>
                <Text style={styles.resolvedLabel}>{statusLabel}</Text>
              </View>
            )}
          </View>
        </View>

        {isActive ? (
          <>
            <View style={[styles.expiryCard, { backgroundColor: expiry.background }]}>
              <View style={styles.expiryHeading}>
                <Ionicons name="warning-outline" size={25} color={expiry.foreground} />

                <View style={styles.expiryHeadingDetails}>
                  <Text style={styles.expiryTitle}>{getExpiryHeadline(daysLeft)}</Text>

                  <Text style={styles.expiryDate}>Use by {formatExpiryDate(item.expiryDate)}</Text>
                </View>
              </View>

              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: urgencyWidth,
                      backgroundColor: expiry.foreground,
                    },
                  ]}
                />
              </View>

              <View style={styles.expiryBottom}>
                <Text style={styles.expiryHint}>{getExpiryHint(daysLeft)}</Text>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Change the expiry date of ${item.name}`}
                  onPress={openEdit}
                  style={({ pressed }) => [styles.changeDateButton, pressed && styles.pressed]}
                >
                  <Text style={styles.changeDate}>Change date</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.reminderCard}>
              <View style={styles.reminderContent}>
                <Text style={styles.sectionEyebrow}>ALERTS</Text>

                {/*
                 * Only what is actually scheduled: the chosen notice alone would
                 * claim a reminder when notifications are off or the day has passed.
                 */}
                <View style={styles.reminderRow}>
                  <Ionicons name="notifications-outline" size={21} color={COLORS.primary} />

                  <View style={styles.reminderCopy}>
                    <Text style={styles.reminderTitle}>Reminders</Text>

                    <Text style={styles.reminderDescription}>{reminderDescription}</Text>
                  </View>
                </View>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Edit reminder settings for ${item.name}`}
                  onPress={openEdit}
                  style={({ pressed }) => [styles.reminderEdit, pressed && styles.pressed]}
                >
                  <Text style={styles.reminderEditText}>Edit reminder settings</Text>

                  <Ionicons name="chevron-forward" size={18} color={COLORS.secondary} />
                </Pressable>
              </View>
            </View>

            <View style={styles.quickActions}>
              <Pressable
                accessibilityRole="button"
                disabled={actionsDisabled}
                onPress={openRecipes}
                style={({ pressed }) => [
                  styles.quickActionButton,
                  pressed && styles.pressed,
                  actionsDisabled && styles.disabled,
                ]}
              >
                <Ionicons name="book-outline" size={23} color={COLORS.primary} />

                <Text style={styles.quickActionText}>Find recipes</Text>
              </Pressable>

              {canDonate ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={isWorking}
                  onPress={openDonationPoints}
                  style={({ pressed }) => [
                    styles.quickActionButton,
                    pressed && styles.pressed,
                    isWorking && styles.disabled,
                  ]}
                >
                  <Ionicons name="location-outline" size={23} color={COLORS.primary} />

                  <Text style={styles.quickActionText}>Donate it</Text>
                </Pressable>
              ) : null}
            </View>

            {deleteConfirm}
          </>
        ) : (
          <>
            <View style={styles.resolvedCard}>
              <Ionicons name="checkmark-circle-outline" size={30} color={COLORS.secondary} />

              <Text style={styles.resolvedTitle}>This item is no longer in your inventory.</Text>

              <Text style={styles.resolvedDescription}>Status: {statusLabel}</Text>

              {updatedOn ? (
                <Text style={styles.resolvedDescription}>Updated {updatedOn}</Text>
              ) : null}
            </View>

            {/*
             * Resolved food still counts in the summary, so deleting it is the
             * only way to undo a mistaken Eaten or Thrown out.
             */}
            {deleteToggle}
            {deleteConfirm}
          </>
        )}

        {item.notes ? (
          <>
            <Text style={styles.sectionTitle}>NOTES</Text>

            <View style={styles.notesCard}>
              <Text style={styles.notesText}>{item.notes}</Text>
            </View>
          </>
        ) : null}

        {actionError ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={20} color={COLORS.error} />

            <Text style={styles.errorText}>{actionError}</Text>
          </View>
        ) : null}

        {!isStorageReady ? (
          <View style={styles.storageNotice}>
            <Ionicons name="hourglass-outline" size={19} color={COLORS.warning} />

            <Text style={styles.storageNoticeText}>
              {storageError ?? 'Loading your saved inventory. Actions will be enabled shortly.'}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      {isActive && (
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={styles.bottomButtons}>
            <Pressable
              accessibilityRole="button"
              disabled={actionsDisabled}
              accessibilityLabel={`Mark ${item.name} as eaten`}
              accessibilityState={{ busy: pendingStatus === 'eaten' }}
              onPress={() => handleResolve('eaten')}
              style={({ pressed }) => [
                styles.eatenButton,
                pressed && styles.pressed,
                actionsDisabled && styles.disabled,
              ]}
            >
              <Text style={styles.eatenButtonText}>
                {pendingStatus === 'eaten' ? 'Saving...' : 'Eaten'}
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              disabled={actionsDisabled}
              accessibilityLabel={`Mark ${item.name} as thrown out`}
              accessibilityState={{ busy: pendingStatus === 'discarded' }}
              onPress={() => handleResolve('discarded')}
              style={({ pressed }) => [
                styles.discardButton,
                pressed && styles.pressed,
                actionsDisabled && styles.disabled,
              ]}
            >
              <Text style={styles.discardButtonText}>
                {pendingStatus === 'discarded' ? 'Saving...' : 'Thrown out'}
              </Text>
            </Pressable>
          </View>

          {deleteToggle}
        </View>
      )}
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
    flexGrow: 1,
    paddingHorizontal: 20,
  },
  centeredContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: COLORS.background,
    padding: 24,
  },
  centeredText: {
    color: COLORS.secondary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  notFoundTitle: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 22,
  },
  backButton: {
    marginTop: 8,
    borderRadius: 16,
    backgroundColor: COLORS.accent,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backButtonText: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 15,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingBottom: 20,
  },
  loadingHeader: {
    paddingHorizontal: 20,
    paddingBottom: 0,
  },
  headerButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: COLORS.surface,
  },
  headerSpacer: {
    width: 48,
  },
  editButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: COLORS.surface,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 22,
    padding: 16,
  },
  foodIcon: {
    width: 84,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 22,
    backgroundColor: COLORS.surface,
  },
  summaryDetails: {
    flex: 1,
    alignItems: 'flex-start',
  },
  storagePill: {
    marginBottom: 6,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  storageText: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_500Medium',
    fontSize: 13,
  },
  itemName: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 24,
    lineHeight: 32,
  },
  itemMeta: {
    marginTop: 4,
    color: COLORS.secondary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 14,
    lineHeight: 20,
  },
  statusBadge: {
    marginTop: 9,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusBadgeText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 13,
  },
  resolvedLabel: {
    color: COLORS.secondary,
    fontFamily: 'Fredoka_500Medium',
    fontSize: 13,
  },
  expiryCard: {
    marginTop: 16,
    borderRadius: 20,
    padding: 16,
  },
  expiryHeading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  expiryHeadingDetails: {
    flex: 1,
  },
  expiryTitle: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 18,
    lineHeight: 25,
  },
  expiryDate: {
    marginTop: 3,
    color: COLORS.secondary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 14,
  },
  progressTrack: {
    height: 9,
    overflow: 'hidden',
    marginTop: 13,
    borderRadius: 5,
    backgroundColor: COLORS.surface,
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
  },
  expiryBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 12,
  },
  expiryHint: {
    flex: 1,
    color: COLORS.primary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 13,
    lineHeight: 19,
  },
  changeDateButton: {
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 4,
  },
  changeDate: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  reminderCard: {
    marginTop: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
  },
  reminderContent: {
    padding: 16,
  },
  sectionEyebrow: {
    marginBottom: 12,
    color: COLORS.secondary,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 13,
    letterSpacing: 1,
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  reminderCopy: {
    flex: 1,
  },
  reminderTitle: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 18,
  },
  reminderDescription: {
    marginTop: 4,
    color: COLORS.secondary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 14,
    lineHeight: 20,
  },
  reminderEdit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingVertical: 4,
  },
  reminderEditText: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_500Medium',
    fontSize: 14,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  quickActionButton: {
    flex: 1,
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 10,
  },
  quickActionText: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_500Medium',
    fontSize: 14,
  },
  sectionTitle: {
    marginTop: 24,
    marginBottom: 12,
    color: COLORS.secondary,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 16,
    letterSpacing: 1.2,
  },
  notesCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
    padding: 16,
  },
  notesText: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 15,
    lineHeight: 22,
  },
  resolvedCard: {
    alignItems: 'center',
    gap: 10,
    marginTop: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    padding: 20,
  },
  resolvedTitle: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 17,
    textAlign: 'center',
  },
  resolvedDescription: {
    color: COLORS.secondary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 14,
    textAlign: 'center',
  },
  deleteConfirmCard: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#EBC7C3',
    borderRadius: 18,
    backgroundColor: COLORS.surface,
    padding: 16,
  },
  deleteConfirmTitle: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 17,
  },
  deleteConfirmText: {
    marginTop: 7,
    color: COLORS.secondary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 14,
    lineHeight: 20,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  cancelDeleteButton: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
  },
  cancelDeleteText: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_500Medium',
  },
  confirmDeleteButton: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: COLORS.error,
  },
  confirmDeleteText: {
    color: COLORS.surface,
    fontFamily: 'Fredoka_600SemiBold',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 14,
    borderRadius: 14,
    backgroundColor: COLORS.errorSoft,
    padding: 12,
  },
  errorText: {
    flex: 1,
    color: COLORS.error,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 13,
    lineHeight: 19,
  },
  storageNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 12,
    borderRadius: 14,
    backgroundColor: COLORS.warningSoft,
    padding: 12,
  },
  storageNoticeText: {
    flex: 1,
    color: COLORS.warning,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 13,
    lineHeight: 19,
  },
  bottomBar: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  bottomButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  eatenButton: {
    flex: 1,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: COLORS.accent,
  },
  eatenButtonText: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 17,
  },
  discardButton: {
    flex: 1,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
  },
  discardButtonText: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_500Medium',
    fontSize: 17,
  },
  deleteLink: {
    alignSelf: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 12,
  },
  deleteLinkText: {
    color: COLORS.error,
    fontFamily: 'Fredoka_500Medium',
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  pressed: {
    opacity: 0.72,
  },
  disabled: {
    opacity: 0.45,
  },
});
