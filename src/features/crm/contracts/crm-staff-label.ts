/**
 * CRM — resolving a staff user id to a name a person can read.
 *
 * Lead detail names staff in several places: who a lead is assigned to, who
 * wrote a note, who changed an assignment, and — since the conversation log —
 * who actually completed or cancelled an activity.
 *
 * All of them resolve through ONE directory, `list_crm_assignable_executives`,
 * which returns rows only to broad readers. That is correct for a directory
 * (an assignment-scoped executive has no business enumerating the team) but it
 * made the CRM unable to name the one person it always knows: the caller.
 *
 * A sales executive completing their own call saw
 *
 *     5 Sep 2026, 10:45 AM · Staff member
 *
 * against their own user id, which defeats the point of recording an actor.
 *
 * The fix needs no extra query and no wider permission. The caller's own id is
 * already on `CrmAccessContext`, so the caller is resolvable by comparison
 * alone. Everyone else stays exactly as private as before.
 */

/** The caller, named as themselves rather than anonymised. */
export const CRM_SELF_STAFF_LABEL = "You";

/**
 * A real staff member the caller is not entitled to name. Deliberately not an
 * id: scope is enforced by withholding the NAME, never by leaking a UUID.
 */
export const CRM_UNKNOWN_STAFF_LABEL = "Staff member";

/**
 * Resolution order, most specific first:
 *
 *   1. no user            -> null   (absent, not anonymous — callers decide)
 *   2. the caller         -> "You"
 *   3. a directory member -> their display name
 *   4. anyone else        -> "Staff member"
 *
 * Self precedes the directory so a broad reader also reads "You" for their own
 * actions, which is how a person expects their own history to read.
 *
 * Returning null for an absent id is what keeps "unknown actor" distinguishable
 * from "some staff member": the conversation log omits the actor entirely
 * rather than implying someone was recorded when the column is null.
 */
export function resolveCrmStaffLabel(
  userId: string | null | undefined,
  currentUserId: string | null | undefined,
  directoryLabels: Readonly<Record<string, string>>
): string | null {
  if (!userId) {
    return null;
  }

  if (currentUserId && userId === currentUserId) {
    return CRM_SELF_STAFF_LABEL;
  }

  return directoryLabels[userId] ?? CRM_UNKNOWN_STAFF_LABEL;
}
