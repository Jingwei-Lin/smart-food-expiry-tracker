import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

function isSameDay(first: Date, second: Date): boolean {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

/**
 * The current date, for screens that group or label food by the days it has left.
 *
 * Calling `new Date()` while rendering is not enough. Tab screens stay mounted,
 * and the React Compiler reuses a value until its inputs change, so a screen
 * would keep yesterday's date until the inventory changed. This moves on when
 * the screen comes back into view and when the app returns to the foreground.
 * It only changes on a new day, so it never re-renders a screen for nothing.
 */
export function useToday(): Date {
  const [today, setToday] = useState(() => new Date());

  const refresh = useCallback(() => {
    const now = new Date();

    setToday((current) => (isSameDay(current, now) ? current : now));
  }, []);

  useFocusEffect(refresh);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refresh();
      }
    });

    return () => subscription.remove();
  }, [refresh]);

  return today;
}
