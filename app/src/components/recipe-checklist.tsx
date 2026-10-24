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

const COLORS = {
  surface: '#FFFFFF',
  primary: '#1E2A16',
  secondary: '#55614D',
  border: '#E4E5D4',
  divider: '#EEEFE5',
  accentSoft: '#F0F7DB',
  pinkSoft: '#F9D3DD',
  neutralSoft: '#EEF0E2',
  error: '#8B2C25',
  errorSoft: '#FDE7E5',
};

type DaysLeftPresentation = {
  meta: string;
  /** The badge on the right of the row. */
  badge: { background: string; border: string; color: string };
  isExpired: boolean;
};

/*
 * The badges follow the design: dark for today, pink for the next few days,
 * soft grey within a week and just an outline after that. The wording says
 * how long is left rather than a weekday, because here the student is
 * choosing what to cook now.
 */
function describeDaysLeft(daysLeft: number): DaysLeftPresentation {
  const outline = { background: COLORS.surface, border: COLORS.border, color: COLORS.secondary };

  if (!Number.isFinite(daysLeft)) {
    return { meta: 'No date', badge: outline, isExpired: false };
  }

  if (daysLeft < 0) {
    const elapsedDays = Math.abs(daysLeft);

    return {
      meta: `Expired ${elapsedDays} ${elapsedDays === 1 ? 'day' : 'days'} ago`,
      badge: { background: COLORS.errorSoft, border: COLORS.errorSoft, color: COLORS.error },
      isExpired: true,
    };
  }

  if (daysLeft === 0) {
    return {
      meta: 'Today',
      badge: { background: COLORS.primary, border: COLORS.primary, color: COLORS.surface },
      isExpired: false,
    };
  }

  const meta = `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}`;

  if (daysLeft <= 3) {
    return {
      meta,
      badge: { background: COLORS.pinkSoft, border: COLORS.pinkSoft, color: COLORS.primary },
      isExpired: false,
    };
  }

  if (daysLeft <= 7) {
    return {
      meta,
      badge: { background: COLORS.neutralSoft, border: COLORS.neutralSoft, color: COLORS.primary },
      isExpired: false,
    };
  }

  return { meta, badge: outline, isExpired: false };
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
      <View style={[styles.toolbar, disabled ? styles.busy : null]}>
        <Text style={styles.sectionTitle}>IN YOUR FRIDGE</Text>

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
          {selectedIds.length} of {MAX_RECIPE_INGREDIENTS} ticked
        </Text>
      </View>

      <View style={[styles.card, disabled ? styles.busy : null]}>
        {candidates.map((candidate, index) => {
          const isChecked = selectedIds.includes(candidate.id);
          const isRowDisabled = disabled || (!isChecked && isAtLimit);
          const { meta, badge, isExpired } = describeDaysLeft(candidate.daysLeft);

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
                  isChecked ? styles.rowChecked : null,
                  isRowDisabled && !disabled ? styles.dimmed : null,
                  pressed ? styles.pressed : null,
                ]}
              >
                <View style={[styles.tickBox, isChecked ? styles.tickBoxChecked : null]}>
                  {isChecked ? (
                    <Ionicons color={COLORS.surface} name="checkmark" size={17} />
                  ) : null}
                </View>

                <Text style={styles.name}>{candidate.name}</Text>

                <View
                  style={[
                    styles.badge,
                    { backgroundColor: badge.background, borderColor: badge.border },
                  ]}
                >
                  {isExpired ? (
                    <Ionicons color={COLORS.error} name="warning-outline" size={13} />
                  ) : null}
                  <Text style={[styles.badgeText, { color: badge.color }]}>{meta}</Text>
                </View>
              </Pressable>
            </View>
          );
        })}
      </View>

      {expiredTickedNames.length > 0 ? (
        <View accessibilityLiveRegion="polite" style={styles.warning}>
          <Ionicons color={COLORS.error} name="warning-outline" size={19} />
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
    color: COLORS.secondary,
    fontFamily: 'Fredoka_500Medium',
    fontSize: 12,
    letterSpacing: 0.9,
  },
  toolbarButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  toolbarButtonText: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 13,
  },
  counter: {
    minWidth: 52,
    marginLeft: 4,
    color: COLORS.secondary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 13,
    textAlign: 'right',
  },
  card: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.divider,
  },
  row: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    backgroundColor: COLORS.surface,
  },
  /* Ticked food is tinted lime, as in the design. */
  rowChecked: {
    backgroundColor: COLORS.accentSoft,
  },
  name: {
    flex: 1,
    color: COLORS.primary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 17,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 13,
  },
  warning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 14,
    borderRadius: 14,
    backgroundColor: COLORS.errorSoft,
    padding: 12,
  },
  warningText: {
    flex: 1,
    color: COLORS.error,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 13,
    lineHeight: 18,
  },
  /* Drawn rather than an icon, to match the design's rounded 24 px boxes. */
  tickBox: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#D5D8C4',
    borderRadius: 7,
    backgroundColor: COLORS.surface,
  },
  tickBoxChecked: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  /* A row that cannot be ticked because ten already are. */
  dimmed: {
    opacity: 0.45,
  },
  /* The whole list while a request runs, as in the design's loading state. */
  busy: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.72,
  },
});
