import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
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
import type {
  FoodStorageLocation,
  ResolvedFoodItemStatus,
} from '@/types/food-item';
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
  divider: '#EEEFE5',
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

function formatStoredDate(value: string | undefined): string {
  if (!value) return 'Not available';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return 'Not available';

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

type DetailRowProps = {
  icon:
    | 'calendar-outline'
    | 'time-outline'
    | 'notifications-outline'
    | 'cube-outline';
  label: string;
  value: string;
};

function DetailRow({ icon, label, value }: DetailRowProps) {
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon} size={24} color={COLORS.secondary} />

      <View style={styles.detailCopy}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

type ActionRowProps = {
  icon: 'book-outline' | 'location-outline' | 'create-outline';
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

function ActionRow({
  icon,
  label,
  onPress,
  disabled = false,
}: ActionRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionRow,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Ionicons name={icon} size={24} color={COLORS.primary} />

      <Text style={styles.actionLabel}>{label}</Text>

      <Ionicons
        name="chevron-forward"
        size={22}
        color={COLORS.secondary}
      />
    </Pressable>
  );
}

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  const {
    items,
    isLoading,
    isStorageReady,
    storageError,
    deleteItem,
    resolveItem,
  } = useInventory();

  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const item = items.find((candidate) => candidate.id === id);
  const actionsDisabled = isWorking || !isStorageReady;

  async function runAction(
    action: () => Promise<void>,
    failureMessage: string,
  ) {
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
    void runAction(
      () => deleteItem(id),
      'This item could not be deleted. Please try again.',
    );
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
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.centeredText}>Loading item...</Text>
      </View>
    );
  }

  if (!item) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />

        <View
          style={[
            styles.centeredContainer,
            { paddingTop: insets.top + 24 },
          ]}
        >
          <Ionicons
            name="alert-circle-outline"
            size={42}
            color={COLORS.secondary}
          />

          <Text style={styles.notFoundTitle}>Item not found</Text>

          <Text style={styles.centeredText}>
            This item may have been removed or is no longer available.
          </Text>

          <Pressable
            accessibilityRole="button"
            onPress={returnToInventory}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>Back to inventory</Text>
          </Pressable>
        </View>
      </>
    );
  }

  const isActive = item.status === 'active';
  const statusLabel =
    item.status === 'active' ? null : STATUS_LABELS[item.status];
  const daysLeft = daysUntilExpiry(item.expiryDate);
  const expiry = getExpiryPresentation(item.expiryDate);
  const deletion = describeDeletion(item);
  const reminderDescription = describeReminders(item);

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
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.screen}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            {
              paddingBottom: isActive
                ? 145 + insets.bottom
                : 24 + insets.bottom,
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View
            style={[
              styles.header,
              { paddingTop: insets.top + 10 },
            ]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to inventory"
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  returnToInventory();
                }
              }}
              style={({ pressed }) => [
                styles.headerButton,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name="chevron-back"
                size={25}
                color={COLORS.primary}
              />
            </Pressable>

            <Text style={styles.headerTitle} numberOfLines={1}>
              {item.name}
            </Text>

            {isActive ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Edit item"
                onPress={openEdit}
                style={({ pressed }) => [
                  styles.editButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.editButtonText}>Edit</Text>
              </Pressable>
            ) : (
              <View style={styles.headerSpacer} />
            )}
          </View>

          {/* Food summary */}
          <View
            style={[
              styles.summary,
              {
                backgroundColor: isActive
                  ? expiry.background
                  : COLORS.accentSoft,
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
                <Text style={styles.storageText}>
                  {STORAGE_LABELS[item.storageLocation]}
                </Text>
              </View>

              <Text style={styles.itemName}>{item.name}</Text>

              <Text style={styles.itemMeta}>
                {item.quantity} · Added {formatStoredDate(item.createdAt)}
              </Text>

              {isActive ? (
                <View style={styles.statusBadge}>
                  <Text
                    style={[
                      styles.statusBadgeText,
                      { color: expiry.foreground },
                    ]}
                  >
                    {getExpiryHeadline(daysLeft)}
                  </Text>
                </View>
              ) : (
                <View style={styles.statusBadge}>
                  <Text style={styles.resolvedLabel}>
                    {statusLabel}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {isActive ? (
            <>
              {/* Expiry card */}
              <View
                style={[
                  styles.expiryCard,
                  { backgroundColor: expiry.background },
                ]}
              >
                <View style={styles.expiryHeading}>
                  <Ionicons
                    name="warning-outline"
                    size={25}
                    color={expiry.foreground}
                  />

                  <View style={styles.expiryHeadingDetails}>
                    <Text style={styles.expiryTitle}>
                      {getExpiryHeadline(daysLeft)}
                    </Text>

                    <Text style={styles.expiryDate}>
                      Use by {formatExpiryDate(item.expiryDate)}
                    </Text>
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
                  <Text style={styles.expiryHint}>
                    {getExpiryHint(daysLeft)}
                  </Text>

                  <Pressable
                    accessibilityRole="button"
                    onPress={openEdit}
                    style={({ pressed }) =>
                      pressed ? styles.pressed : undefined
                    }
                  >
                    <Text style={styles.changeDate}>Change date</Text>
                  </Pressable>
                </View>
              </View>

              {/* Reminder information */}
              <View style={styles.reminderCard}>
                <View style={styles.reminderContent}>
                  <Text style={styles.sectionEyebrow}>ALERTS</Text>

                  <View style={styles.reminderRow}>
                    <View style={styles.reminderCopy}>
                      <Text style={styles.reminderTitle}>Remind me</Text>

                      <Text style={styles.reminderDescription}>
                        {item.reminderDaysBefore}{' '}
                        {item.reminderDaysBefore === 1 ? 'day' : 'days'} before
                        it expires
                      </Text>
                    </View>

                    <View style={styles.reminderValue}>
                      <Ionicons
                        name="notifications-outline"
                        size={20}
                        color={COLORS.primary}
                      />

                      <Text style={styles.reminderValueText}>
                        {item.reminderDaysBefore}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.divider} />

                  <View style={styles.reminderStatusRow}>
                    <Ionicons
                      name="notifications-outline"
                      size={21}
                      color={COLORS.secondary}
                    />

                    <Text style={styles.reminderStatus}>
                      {reminderDescription}
                    </Text>
                  </View>

                  <Pressable
                    accessibilityRole="button"
                    onPress={openEdit}
                    style={({ pressed }) => [
                      styles.reminderEdit,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.reminderEditText}>
                      Edit reminder settings
                    </Text>

                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={COLORS.secondary}
                    />
                  </Pressable>
                </View>
              </View>

              {/* Quick actions */}
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
                  <Ionicons
                    name="book-outline"
                    size={23}
                    color={COLORS.primary}
                  />

                  <Text style={styles.quickActionText}>Find recipes</Text>
                </Pressable>

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
                  <Ionicons
                    name="location-outline"
                    size={23}
                    color={COLORS.primary}
                  />

                  <Text style={styles.quickActionText}>Donate it</Text>
                </Pressable>
              </View>

              {/* Delete confirmation */}
              {isConfirmingDelete && (
                <View style={styles.deleteConfirmCard}>
                  <Text style={styles.deleteConfirmTitle}>
                    {deletion.title}
                  </Text>

                  <Text style={styles.deleteConfirmText}>
                    {deletion.message}
                  </Text>

                  <View style={styles.confirmButtons}>
                    <Pressable
                      accessibilityRole="button"
                      disabled={isWorking}
                      onPress={() => setIsConfirmingDelete(false)}
                      style={styles.cancelDeleteButton}
                    >
                      <Text style={styles.cancelDeleteText}>
                        Keep item
                      </Text>
                    </Pressable>

                    <Pressable
                      accessibilityRole="button"
                      disabled={actionsDisabled}
                      onPress={handleDelete}
                      style={[
                        styles.confirmDeleteButton,
                        actionsDisabled && styles.disabled,
                      ]}
                    >
                      <Text style={styles.confirmDeleteText}>
                        {isWorking ? 'Deleting...' : 'Delete'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </>
          ) : (
            <View style={styles.resolvedCard}>
              <Ionicons
                name="checkmark-circle-outline"
                size={30}
                color={COLORS.secondary}
              />

              <Text style={styles.resolvedTitle}>
                This item is no longer in your inventory.
              </Text>

              <Text style={styles.resolvedDescription}>
                Status: {statusLabel}
              </Text>

              {item.statusUpdatedAt ? (
                <Text style={styles.resolvedDescription}>
                  Updated {formatStoredDate(item.statusUpdatedAt)}
                </Text>
              ) : null}
            </View>
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
              <Ionicons
                name="alert-circle-outline"
                size={20}
                color={COLORS.error}
              />

              <Text style={styles.errorText}>{actionError}</Text>
            </View>
          ) : null}

          {!isStorageReady ? (
            <View style={styles.storageNotice}>
              <Ionicons
                name="hourglass-outline"
                size={19}
                color={COLORS.warning}
              />

              <Text style={styles.storageNoticeText}>
                {storageError ??
                  'Loading your saved inventory. Actions will be enabled shortly.'}
              </Text>
            </View>
          ) : null}
        </ScrollView>

        {/* Fixed bottom actions */}
        {isActive && (
          <View
            style={[
              styles.bottomBar,
              { paddingBottom: Math.max(insets.bottom, 12) },
            ]}
          >
            <View style={styles.bottomButtons}>
              <Pressable
                accessibilityRole="button"
                disabled={actionsDisabled}
                onPress={() => handleResolve('eaten')}
                style={({ pressed }) => [
                  styles.eatenButton,
                  pressed && styles.pressed,
                  actionsDisabled && styles.disabled,
                ]}
              >
                <Text style={styles.eatenButtonText}>
                  {isWorking ? 'Saving...' : 'Eaten'}
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                disabled={actionsDisabled}
                onPress={() => handleResolve('discarded')}
                style={({ pressed }) => [
                  styles.discardButton,
                  pressed && styles.pressed,
                  actionsDisabled && styles.disabled,
                ]}
              >
                <Text style={styles.discardButtonText}>Thrown out</Text>
              </Pressable>
            </View>

            <Pressable
              accessibilityRole="button"
              disabled={actionsDisabled}
              onPress={() =>
                setIsConfirmingDelete((current) => !current)
              }
              style={styles.deleteLink}
            >
              <Text style={styles.deleteLinkText}>
                {isConfirmingDelete ? 'Cancel delete' : 'Delete item'}
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </>
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
  headerButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: COLORS.surface,
  },
  headerTitle: {
    flex: 1,
    color: COLORS.primary,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 20,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 72,
  },
  editButton: {
    minWidth: 72,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 16,
  },
  editButtonText: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 16,
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
    alignItems: 'center',
    justifyContent: 'space-between',
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
  reminderValue: {
    minWidth: 54,
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 21,
  },
  reminderValueText: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 16,
  },
  divider: {
    height: 1,
    marginTop: 14,
    backgroundColor: COLORS.divider,
  },
  reminderStatusRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 14,
  },
  reminderStatus: {
    flex: 1,
    color: COLORS.secondary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 13,
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
    paddingTop: 8,
    paddingBottom: 2,
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

  // Kept for the existing helper components.
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  detailCopy: {
    flex: 1,
  },
  detailLabel: {
    color: COLORS.secondary,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  detailValue: {
    marginTop: 4,
    color: COLORS.primary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 16,
    lineHeight: 22,
  },
  actionRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  actionLabel: {
    flex: 1,
    color: COLORS.primary,
    fontFamily: 'Fredoka_500Medium',
    fontSize: 16,
  },
});