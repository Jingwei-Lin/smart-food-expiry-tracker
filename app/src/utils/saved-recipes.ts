/** "Saved today", or the day it was saved, e.g. "Saved 25 Sept". */
export function describeSavedDate(savedAt: string, today = new Date()): string {
  const saved = new Date(savedAt);

  if (Number.isNaN(saved.getTime())) {
    return 'Saved';
  }

  const isToday =
    saved.getFullYear() === today.getFullYear() &&
    saved.getMonth() === today.getMonth() &&
    saved.getDate() === today.getDate();

  return isToday
    ? 'Saved today'
    : `Saved ${new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short' }).format(saved)}`;
}
