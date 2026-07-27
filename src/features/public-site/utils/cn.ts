/** Join class names, filtering falsy entries. No external dependency. */
export function cn(
  ...classes: Array<string | false | null | undefined | string[]>
): string {
  return classes
    .flat()
    .filter((value): value is string => Boolean(value))
    .join(" ");
}
