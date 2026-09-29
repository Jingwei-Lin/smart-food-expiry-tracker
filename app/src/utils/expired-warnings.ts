/*
 * The red warnings on the Recipes tab. They are the app's own fixed wording,
 * built from the student's dates; the model never writes them, so they cannot
 * go missing or be softened.
 */

function joinNames(names: string[]): string {
  if (names.length === 1) {
    return names[0];
  }

  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** The banner under the checklist while expired food is ticked. */
export function describeExpiredTicked(names: string[]): string {
  return names.length > 1
    ? `${joinNames(names)} are past their date. Check they look and smell fine before cooking with them.`
    : `${names[0]} is past its date. Check it looks and smells fine before cooking with it.`;
}

/** The warning on a recipe card that uses expired food. */
export function describeExpiredInRecipe(names: string[]): string {
  return names.length > 1
    ? `Uses ${joinNames(names)}, which are past their date. Check they look and smell fine before cooking with them.`
    : `Uses ${names[0]}, which is past its date. Check it looks and smells fine before cooking with it.`;
}
