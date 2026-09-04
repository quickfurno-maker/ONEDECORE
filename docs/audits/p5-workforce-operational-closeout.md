# P5 Workforce — operational closeout readiness

**Status at this PR:** repository work complete; **nothing has been applied to
managed Supabase and nothing has been deployed.**

This audit deliberately keeps four things apart, because collapsing them is how
a repository change gets reported as a live activation.

---

## 1. Repository readiness — DONE in this PR

| Item | Evidence |
| :--- | :--- |
| M57 `20260904170000_workforce_p5_launch_catalogue.sql` | Forward-only; seeds `casual` / `sick` / `unpaid` only |
| Launch leave names and half-day setting | pgTAP 47 asserts exact names and `allows_half_day = false` on all three |
| No holiday, salary, statement, payment, employment or attendance row created | pgTAP 47 asserts each count is 0 |
| `attendance.correct.team` still absent from `sales_manager` | pgTAP 47 |
| `attendance.team.read` and `leave.team.approve` retained | pgTAP 47 |
| Approved leave still non-cancellable | pgTAP 47 asserts `LEAVE_NOT_CANCELLABLE` |
| Weekly-off monthly cap intact | pgTAP 47 asserts the active-count helper and its use in submission |
| No applied migration edited | `git diff` vs base touches only the new M57 file under `supabase/migrations/` |

**What the repository cannot prove** and does not claim: that the managed
database contains these rows, that anyone can log in, or that attendance works
in production.

---

## 2. Managed M57 apply — NOT DONE

M57 exists only in the repository. Managed Supabase (`lpurlfmpvriyvpkujvyl`) was
**not contacted during this work**.

After review and merge, and only then:

```
.\node_modules\.bin\supabase.cmd db push --linked
```

M57 must be the **sole** pending migration at that point. Verify managed
alignment afterwards.

---

## 3. Owner-only credential issuance — NOT DONE, and not doable by tooling

The staff password is **owner-private**. It is never generated, logged,
committed, transmitted to a coding agent, or displayed. Nothing in this PR
creates an Auth identity, and no production credential exists yet.

The operational sequence, performed by the owner after deploy:

1. Super Admin opens the **SM001** staff detail.
2. Attendance eligible → **YES**; policy → **Workforce V1 Attendance**.
3. Reason: *P5 activation — Sales Manager attendance tracked*. Save through the
   canonical audited UI (`update_staff_employment`).
4. **Login & access** → issue credentials using the staff member's **own**
   10-digit Indian mobile (stored canonically as `+91…`).
5. The owner privately chooses a password of at least 10 characters.
6. The staff member performs the **first real login**; access becomes active.

---

## 4. Production attendance E2E — NOT DONE

No production attendance data exists. The following must be observed on the
live system before P5 can be called complete:

- staff attendance page visible to the staff member;
- real **Check In** succeeds with a server timestamp;
- a duplicate check-in replay does **not** create a second session;
- **Check Out** succeeds;
- a truthful attendance category is submitted;
- the Super Admin approval inbox receives it;
- the Super Admin approves it;
- the monthly view reflects the approved result;
- Weekly Off remains approval-gated with its quota intact;
- Casual / Sick / Unpaid leave request is available with correct approval scope;
- approved leave cannot be self-cancelled;
- salary and payment pages contain **no invented values**;
- no cross-staff data leakage.

The fifth-Weekly-Off hard cap does **not** need fabricated production days: the
certified database tests already prove the refusal.

---

## 5. No fake evidence

This file records **no PASS** for anything in sections 2–4. Those sections
describe work that has not happened. Any future claim that P5 is live must cite
the managed apply output, the deployment SHA and the real E2E observations —
not this document.

---

## Related

- [docs/12 — Workforce V1](../12-workforce-v1-attendance-salary.md) §13.1, §13.2
- [docs/11 — Accelerated Closeout Roadmap](../11-accelerated-closeout-roadmap.md) P5
- [docs/10 — Decision Register](../10-decision-register.md) DEC-0098, DEC-0099
