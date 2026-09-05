/**
 * Local password guidance for the Super Admin credential forms.
 *
 * A TWO-STAGE TRUST MODEL, AND STAGE 1 IS NOT AUTHORITATIVE
 *
 *   Stage 1 — everything in this file. Fast, local, advisory.
 *   Stage 2 — Supabase Auth. The only thing that decides acceptance.
 *
 * The distinction is the whole point. Supabase can reject a password that
 * satisfies every rule here — most often `weak_password` with a `pwned` reason,
 * meaning the password appears in breach data. When the UI implied success and
 * the provider had actually refused, the operator handed out a password that
 * could not sign in, and only discovered it when the staff member called.
 *
 * So nothing in this module may ever say "accepted". Hard checks say "ready to
 * submit"; soft checks say "recommended". Both are guidance until the server
 * answers.
 */

import { STAFF_PASSWORD_MIN_LENGTH } from "./staff-login-phone.ts";

/* -------------------------------------------------------------------------- */
/* Checklist                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * `pending` = not yet assessable (nothing typed). It is deliberately distinct
 * from `unmet`, so an untouched form does not open covered in failures.
 */
export type StaffPasswordCheckState = "met" | "unmet" | "pending";

export interface StaffPasswordCheck {
  readonly id: string;
  readonly label: string;
  readonly state: StaffPasswordCheckState;
  /** Hard checks gate submission; soft checks never do. */
  readonly kind: "hard" | "soft";
}

export const STAFF_PASSWORD_STRENGTH_LABELS = [
  "Weak",
  "Fair",
  "Good",
  "Strong",
] as const;

export type StaffPasswordStrength =
  (typeof STAFF_PASSWORD_STRENGTH_LABELS)[number];

export interface StaffPasswordAnalysis {
  readonly checks: readonly StaffPasswordCheck[];
  /** True only when every HARD check is met — the submit gate. */
  readonly canSubmit: boolean;
  /** Local estimate only. Never a promise of acceptance. */
  readonly strength: StaffPasswordStrength;
  /** True before anything has been typed, so the UI can stay neutral. */
  readonly untouched: boolean;
}

/* -------------------------------------------------------------------------- */
/* Weak-pattern heuristics — advisory only                                     */
/* -------------------------------------------------------------------------- */

/**
 * A deliberately small list. It is not a breach database and must never be
 * presented as one — Supabase does the real check. This only catches the
 * password an operator types when they are in a hurry.
 */
const COMMON_PASSWORD_FRAGMENTS = [
  "password",
  "qwerty",
  "letmein",
  "welcome",
  "admin",
  "iloveyou",
  "abc123",
  "123456",
  "onedecore",
  "changeme",
  "monkey",
  "dragon",
] as const;

/** "aaaa", "111111" — four or more of the same character in a row. */
const REPEATED_RUN = /(.)\1{3,}/;

/** Ascending or descending runs of 4+ digits or letters, e.g. 1234 / dcba. */
function hasSequentialRun(value: string): boolean {
  const lower = value.toLowerCase();
  let ascending = 1;
  let descending = 1;

  for (let index = 1; index < lower.length; index += 1) {
    const delta = lower.charCodeAt(index) - lower.charCodeAt(index - 1);
    ascending = delta === 1 ? ascending + 1 : 1;
    descending = delta === -1 ? descending + 1 : 1;
    if (ascending >= 4 || descending >= 4) {
      return true;
    }
  }
  return false;
}

/**
 * Local "looks guessable" heuristic.
 *
 * Advisory by construction: it can produce false negatives (a breached password
 * it has never heard of) and that is expected — the provider is the authority.
 */
export function looksEasilyGuessed(password: string): boolean {
  if (password.length === 0) {
    return false;
  }
  const lower = password.toLowerCase();

  return (
    COMMON_PASSWORD_FRAGMENTS.some((fragment) => lower.includes(fragment)) ||
    REPEATED_RUN.test(password) ||
    hasSequentialRun(password)
  );
}

/* -------------------------------------------------------------------------- */
/* Analysis                                                                    */
/* -------------------------------------------------------------------------- */

const HAS_LOWER = /[a-z]/;
const HAS_UPPER = /[A-Z]/;
const HAS_DIGIT = /\d/;
const HAS_SPECIAL = /[^A-Za-z0-9]/;

const RECOMMENDED_LENGTH = 12;

function state(condition: boolean, assessable: boolean): StaffPasswordCheckState {
  if (!assessable) {
    return "pending";
  }
  return condition ? "met" : "unmet";
}

/**
 * The live checklist behind both credential forms.
 *
 * Hard checks mirror `validateStaffPassword` exactly, so the button never
 * enables for something the server action will reject on arrival. Soft checks
 * are separate and never gate submission — blocking on a recommendation would
 * imply the recommendations are the standard, and they are not.
 */
export function analyseStaffPassword(
  password: string,
  confirmation: string
): StaffPasswordAnalysis {
  const typed = password.length > 0;
  const confirmTyped = confirmation.length > 0;
  const untouched = !typed && !confirmTyped;

  const longEnough = password.length >= STAFF_PASSWORD_MIN_LENGTH;
  const matches = typed && password === confirmation;

  const checks: StaffPasswordCheck[] = [
    {
      id: "min-length",
      kind: "hard",
      label: `At least ${STAFF_PASSWORD_MIN_LENGTH} characters`,
      state: state(longEnough, typed),
    },
    {
      id: "match",
      kind: "hard",
      label: "Passwords match",
      state: state(matches, typed && confirmTyped),
    },
    {
      id: "recommended-length",
      kind: "soft",
      label: `Recommended: ${RECOMMENDED_LENGTH} or more characters`,
      state: state(password.length >= RECOMMENDED_LENGTH, typed),
    },
    {
      id: "mixed-case",
      kind: "soft",
      label: "Recommended: includes uppercase and lowercase letters",
      state: state(HAS_UPPER.test(password) && HAS_LOWER.test(password), typed),
    },
    {
      id: "digit",
      kind: "soft",
      label: "Recommended: includes a number",
      state: state(HAS_DIGIT.test(password), typed),
    },
    {
      id: "special",
      kind: "soft",
      label: "Recommended: includes a special character",
      state: state(HAS_SPECIAL.test(password), typed),
    },
    {
      id: "not-common",
      kind: "soft",
      label: "Recommended: not a common or easily guessed password",
      state: state(!looksEasilyGuessed(password), typed),
    },
  ];

  const canSubmit = checks
    .filter((check) => check.kind === "hard")
    .every((check) => check.state === "met");

  return {
    checks,
    canSubmit,
    strength: estimateStrength(password),
    untouched,
  };
}

/**
 * A coarse local estimate, shown only beside the checklist and the note that it
 * is not the decision. It is not entropy and must not be read as one.
 */
export function estimateStrength(password: string): StaffPasswordStrength {
  if (password.length === 0) {
    return "Weak";
  }

  let score = 0;
  if (password.length >= STAFF_PASSWORD_MIN_LENGTH) score += 1;
  if (password.length >= RECOMMENDED_LENGTH) score += 1;
  if (password.length >= 16) score += 1;
  if (HAS_UPPER.test(password) && HAS_LOWER.test(password)) score += 1;
  if (HAS_DIGIT.test(password)) score += 1;
  if (HAS_SPECIAL.test(password)) score += 1;
  if (looksEasilyGuessed(password)) score -= 3;

  if (score <= 2) return "Weak";
  if (score <= 3) return "Fair";
  if (score <= 4) return "Good";
  return "Strong";
}

/* -------------------------------------------------------------------------- */
/* Generation                                                                  */
/* -------------------------------------------------------------------------- */

/*
 * Visually confusing characters are excluded, because this password is read
 * aloud or copied by hand to a staff member: 0/O, 1/l/I, 5/S, 2/Z.
 */
const GEN_LOWER = "abcdefghjkmnpqrstuvwxyz";
const GEN_UPPER = "ABCDEFGHJKMNPQRSTUVWXYZ";
const GEN_DIGIT = "346789";
const GEN_SPECIAL = "!@#$%^&*?-_+=";
const GEN_ALL = GEN_LOWER + GEN_UPPER + GEN_DIGIT + GEN_SPECIAL;

export const GENERATED_PASSWORD_MIN_LENGTH = 16;
export const GENERATED_PASSWORD_MAX_LENGTH = 20;

/** Injectable so generation is deterministic under test. */
export type RandomInts = (count: number, bound: number) => number[];

/** Browser/Node CSPRNG. Never `Math.random` — this value guards an account. */
export const cryptoRandomInts: RandomInts = (count, bound) => {
  const values = new Uint32Array(count);
  globalThis.crypto.getRandomValues(values);
  // Modulo bias is irrelevant at these bounds relative to the entropy budget,
  // and the alphabet is far smaller than 2^32.
  return Array.from(values, (value) => value % bound);
};

/**
 * A strong password the operator does not have to invent.
 *
 * Guarantees one character from each class, then fills the remainder from the
 * full alphabet and shuffles, so the mandatory characters are not always in the
 * same positions.
 *
 * This is still only Stage 1: a generated password is overwhelmingly likely to
 * be accepted, but the UI must not claim it until the server says so.
 */
export function generateStrongStaffPassword(
  randomInts: RandomInts = cryptoRandomInts
): string {
  const [lengthPick] = randomInts(
    1,
    GENERATED_PASSWORD_MAX_LENGTH - GENERATED_PASSWORD_MIN_LENGTH + 1
  );
  const length = GENERATED_PASSWORD_MIN_LENGTH + (lengthPick ?? 0);

  const required = [GEN_LOWER, GEN_UPPER, GEN_DIGIT, GEN_SPECIAL];
  const picks: string[] = [];

  for (const alphabet of required) {
    const [index] = randomInts(1, alphabet.length);
    picks.push(alphabet[index ?? 0]!);
  }

  const remaining = randomInts(length - picks.length, GEN_ALL.length);
  for (const index of remaining) {
    picks.push(GEN_ALL[index]!);
  }

  // Fisher-Yates, so the four class-guaranteed characters are not pinned to the
  // first four positions.
  const shuffleIndexes = randomInts(picks.length, picks.length);
  for (let i = picks.length - 1; i > 0; i -= 1) {
    const j = (shuffleIndexes[i] ?? 0) % (i + 1);
    const swap = picks[i]!;
    picks[i] = picks[j]!;
    picks[j] = swap;
  }

  return picks.join("");
}
