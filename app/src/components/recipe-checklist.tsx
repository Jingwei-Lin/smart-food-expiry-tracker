import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { describeExpiredTicked } from '@/utils/expired-warnings';
import {
  MAX_RECIPE_INGREDIENTS,
  RecipeCandidate,
  selectAllRecipeCandidates,
  toggleRecipeCandidate,
} from '@/utils/recipe-ingredients';

type RecipeChecklistProps = {
  candidates: RecipeCandidate[];
  selectedIds: string[];
  onChange: (selectedIds: string[]) => void;
  /** While a request is running the ticks cannot change under it. */
  disabled?: boolean;
};

type DaysLeftPresentation = {
  meta: string;
  railColor: string;
  isExpired: boolean;
};

/*
 * The rail colours match the inventory rows, so a food looks equally urgent
 * on both screens. The wording says how long is left rather than a weekday,
 * because here the student is choosing what to cook now.
 */
function describeDaysLeft(daysLeft: number): DaysLeftPresentation {
  if (!Number.isFinite(daysLeft)) {
    return { meta: 'No date', railColor: '#c2cbc3', isExpired: false };
  }

  if (daysLeft < 0) {
    const elapsedDays = Math.abs(daysLeft);

    return {
      meta: `Expired ${elapsedDays} ${elapsedDays === 1 ? 'day' : 'days'} ago`,
      railColor: '#c8352c',
      isExpired: true,
    };
  }

  if (daysLeft === 0) {
    return { meta: 'Today', railColor: '#c8352c', isExpired: false };
  }

  if (daysLeft === 1) {
    return { meta: 'Tomorrow', railColor: '#d9922f', isExpired: false };
  }

  return {
    meta: `${daysLeft} days`,
    railColor: daysLeft <= 3 ? '#d9922f' : '#7fb183',
    isExpired: false,
  };
}

/**
 * The list of food the student ticks to cook with. It holds no state of its
 * own: every change goes back through `onChange`, using the rules in
 * recipe-ingredients.
 */
export function RecipeChecklist({
  candidates,
  selectedIds,
  onChange,
  disabled = false,
}: RecipeChecklistProps) {
  const isAtLimit = selectedIds.length >= MAX_RECIPE_INGREDIENTS;
  const expiredTickedNames = candidates
    .filter((candidate) => candidate.daysLeft < 0 && selectedIds.includes(candidate.id))
    .map((candidate) => candidate.name);

  return (
    <View>
      <View style={styles.toolbar}>
        <Text style={styles.sectionTitle}>YOUR FOOD</Text>

        <Pressable
          accessibilityRole="button"
          disabled={disabled}
          onPress={() => onChange(selectAllRecipeCandidates(candidates))}
          style={({ pressed }) => [styles.toolbarButton, pressed ? styles.pressed : null]}
        >
          <Text style={styles.toolbarButtonText}>Select all</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          disabled={disabled || selectedIds.length === 0}
          onPress={() => onChange([])}
          style={({ pressed }) => [styles.toolbarButton, pressed ? styles.pressed : null]}
        >
          <Text style={styles.toolbarButtonText}>Clear</Text>
        </Pressable>

        <Text accessibilityLiveRegion="polite" style={styles.counter}>
          {selectedIds.length} of {MAX_RECIPE_INGREDIENTS}
        </Text>
      </View>

      <View style={[styles.card, disabled ? styles.dimmed : null]}>
        {candidates.map((candidate, index) => {
          const isChecked = selectedIds.includes(candidate.id);
          const isRowDisabled = disabled || (!isChecked && isAtLimit);
          const { meta, railColor, isExpired } = describeDaysLeft(candidate.daysLeft);

          return (
            <View key={candidate.id}>
              {index > 0 ? <View style={styles.divider} /> : null}

              <Pressable
                accessibilityLabel={`${candidate.name}, ${meta}`}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isChecked, disabled: isRowDisabled }}
                disabled={isRowDisabled}
                onPress={() => onChange(toggleRecipeCandidate(selectedIds, candidate.id))}
                style={({ pressed }) => [
                  styles.row,
                  isRowDisabled && !disabled ? styles.dimmed : null,
                  pressed ? styles.pressed : null,
                ]}
              >
                <View style={[styles.rail, { backgroundColor: railColor }]} />

                <Ionicons
                  color={isChecked ? '#2f7d32' : '#aab6a9'}
                  name={isChecked ? 'checkbox' : 'square-outline'}
                  size={26}
                />

                <Text style={styles.name}>{candidate.name}</Text>

                {isExpired ? <Ionicons color="#9f2420" name="warning-outline" size={16} /> : null}

                <Text style={[styles.meta, isExpired ? styles.expiredMeta : null]}>{meta}</Text>
              </Pressable>
            </View>
          );
        })}
      </View>

      {expiredTickedNames.length > 0 ? (
        <View accessibilityLiveRegion="polite" style={styles.warning}>
          <Ionicons color="#9f2420" name="warning-outline" size={19} />
          <Text style={styles.warningText}>{describeExpiredTicked(expiredTickedNames)}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  sectionTitle: {
    flex: 1,
    color: '#687269',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.9,
  },
  toolbarButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  toolbarButtonText: {
    color: '#2f7d32',
    fontSize: 14,
    fontWeight: '700',
  },
  counter: {
    minWidth: 52,
    color: '#59635b',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
  },
  card: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#dce4da',
    borderRadius: 14,
    backgroundColor: '#ffffff',
  },
  divider: {
    height: 1,
    marginLeft: 16,
    backgroundColor: '#eef1ed',
  },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingRight: 16,
    backgroundColor: '#ffffff',
  },
  rail: {
    alignSelf: 'stretch',
    width: 4,
  },
  name: {
    flex: 1,
    color: '#172019',
    fontSize: 17,
    fontWeight: '600',
  },
  meta: {
    color: '#687269',
    fontSize: 13,
    fontWeight: '600',
  },
  expiredMeta: {
    color: '#9f2420',
  },
  warning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 14,
    borderRadius: 12,
    backgroundColor: '#fde7e5',
    padding: 12,
  },
  warningText: {
    flex: 1,
    color: '#8b2c25',
    fontSize: 13,
    lineHeight: 18,
  },
  dimmed: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.72,
  },
});
