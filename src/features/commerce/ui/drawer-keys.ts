export function isDrawerEscapeKey(key: string): boolean {
  return key === "Escape";
}

export interface DrawerFocusTarget {
  focus: () => void;
  isConnected?: boolean;
}

export function isFocusRestoreTarget(value: unknown): value is DrawerFocusTarget {
  return (
    typeof value === "object" &&
    value != null &&
    "focus" in value &&
    typeof (value as { focus?: unknown }).focus === "function"
  );
}

export function captureDrawerRestorationTarget(input: {
  readonly wasOpen: boolean;
  readonly isOpen: boolean;
  readonly currentlyFocused: unknown;
  readonly existingTarget: DrawerFocusTarget | null;
}): DrawerFocusTarget | null {
  if (!input.wasOpen && input.isOpen) {
    return isFocusRestoreTarget(input.currentlyFocused) ? input.currentlyFocused : null;
  }
  return input.existingTarget;
}

export function restoreDrawerFocus(target: DrawerFocusTarget | null): boolean {
  if (!isFocusRestoreTarget(target) || target.isConnected === false) {
    return false;
  }
  target.focus();
  return true;
}
