/**
 * Best-effort guess at "the next class" for promotion, by finding a
 * trailing number in the source class's name and looking for another
 * class whose name has that number + 1 (e.g. "Grade 1" -> "Grade 2").
 * Returns undefined if the name has no number or no matching class
 * exists - the UI just leaves the target unselected in that case rather
 * than guessing wrong.
 */
export function suggestNextClass(
  classes: { id: string; name: string }[],
  fromClassId: string
): string | undefined {
  const fromClass = classes.find((c) => c.id === fromClassId);
  if (!fromClass) return undefined;

  const match = fromClass.name.match(/(\d+)(?!.*\d)/); // last number in the name
  if (!match) return undefined;

  const nextNumber = Number(match[1]) + 1;
  const nextName = fromClass.name.replace(/(\d+)(?!.*\d)/, String(nextNumber));

  const nextClass = classes.find((c) => c.name.trim().toLowerCase() === nextName.trim().toLowerCase());
  return nextClass?.id;
}
