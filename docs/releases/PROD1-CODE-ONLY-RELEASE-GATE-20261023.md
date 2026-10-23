# ONEDECORE — PROD-1 Code-only Production Release Gate

**Prepared:** 23 October 2026, IST. **Classification:** supervised preparation, not a deployment approval.
**Decision:** HOLD until the manual gate evidence and approval are complete.
**Scope:** code-only `origin/main` baseline `27521f031195a8b749bebeceae0ba22ad475b816` → reviewed source candidate `1be509082232e030a6ca2e91a5fb7f122a011080` (4 commits, 16 files, 0 new SQL migrations). A future merged commit SHA must be checked separately, not assumed equal to branch HEAD.

## Confirmed and limitations

1. GitHub Actions quality run #661 on the branch candidate: Application Quality + Database Quality SUCCESS. Internal source work complete; 127/127 source manifest blobs match.
2. User-provided authenticated VPS session: host `onedecore-prod`, `root` terminal, tracked application HEAD `27521f03…`, `pm2-onedecore.service` active, MainPID 810 running as Unix user `onedecore`, PM2 application `onedecore` online, zero restarts. `/api/health` returns `{"ok":true,"service":"onedecore"}`; 90G disk and 6.9GiB RAM available; `.env.production.local` owner `onedecore:onedecore` mode `600`.
3. Current environment **MUST BE PRESERVED**, not changed as part of this release: `ONEDECORE_WHATSAPP_OUTBOUND_MODE=enabled`, `ONEDECORE_WHATSAPP_WEBHOOK_MODE=enabled`, `ONEDECORE_CAMPAIGN_EXECUTION_MODE=disabled`, `ONEDECORE_SHOP_PUBLIC_ENABLED=disabled`, `ONEDECORE_PROVIDER_DATA_SHARING_ENABLED=disabled`, `ONEDECORE_LEAD_INTAKE_MODE=enabled`. **Individual WhatsApp sends are already potentially live** under separate authorization; do not claim that the outbound service is disabled. Do not invoke provider operations, send test templates, or schedule campaigns in PROD-1.
4. Managed Supabase ONEDECORE **109/109** migration ledger versions/names agree with repository inventory. PROD-1 diff adds **no** SQL migrations. Read-only counts showed 2 WhatsApp conversations / 6 inbound / 0 stored outbound messages / 0 pending campaign runs/jobs, and no marketing execution policy at time of inspection. These are a snapshot, not a durable future-send veto.
5. User's Supabase backup screenshot displays daily physical backups, latest **2026-10-22 19:53:38 UTC** (2026-10-23 01:23:38 IST), with Restore controls; **this proves backup visibility, not restoration success**. Supabase database backups **exclude Storage API object bytes**. Point-in-time recovery, restore drill, and separate Storage export remain unverified. Do not click Restore merely to test it on Production.
6. External AppSec/DBA independent certification explicitly **deferred by user**, **not approved/passed**. Managed security advisors flagged potentially anonymous-executable SECURITY DEFINER endpoints and other warnings; they are not all automatically exploitable but remain an unresolved review risk. Source manifest `decision=HOLD`, `productionAuthorized=false`, `independentDbaApproved=false`, `independentAppsecApproved=false`; neither this document nor the preflight changes those facts.
7. An unrelated SSH process in user's Windows Terminal is authenticated to VPS; automated non-interactive SSH from Remote Desktop Commander still fails. We cannot run or verify VPS operations directly from the tool session.

## Mandatory gate before any Git merge/deploy

- [ ] Run `bash scripts/prod1-readonly-vps-preflight.sh` on the current VPS after source file is available, and attach redacted output. It reads only and **never deploys**.
- [ ] Verify a recovery method independently: recent successful physical backup, restorable instance/database scope and RPO, plus plan for Storage files; document who is authorized to restore. A backup listing is not a restore drill.
- [ ] Inspect `systemctl cat pm2-onedecore.service`, `systemctl show pm2-onedecore.service -p User -p MainPID -p ExecStart` and matching `onedecore` process list **read-only**. The canonical deploy script performs `pm2 restart` **as onedecore**; systemd owns the PM2 **daemon**. Determine that restarting the existing application in the owned daemon will not spawn another daemon/process. Never run `pm2` as root in production.
- [ ] Owner explicitly signs off on **code-only** risk deferral knowing independent AppSec/DBA, real Staging E2E and backup restore drill are incomplete. This is a business release-risk decision, never a synthetic certification.
- [ ] Resolve repo protection requirements and approve the merge of draft PR #218; do not bypass the `HOLD` release manifest. If the repository requires external review, obtain review instead of representing a waiver as an approval.
- [ ] After any authorized merge, verify new `origin/main` exact SHA, full green CI for that SHA, and identity of the deployed files/migration delta before deployment.
- [ ] Maintenance window, accountable rollback operator, rollback target SHA and post-deploy monitoring are staffed and recorded.

## Rollback readiness — plan only, no commands run

**Current known-good application commit:** `27521f031195a8b749bebeceae0ba22ad475b816`.

The deploy script (`scripts/deploy-production.sh`) only allows **fast-forward onto an origin/main commit**, checks non-root deployment identity and PM2 ownership, installs `npm ci`, builds and restarts `onedecore` in the owning `PM2_HOME`. This procedure itself **cannot reverse the main branch** to a parent commit. Rolling back needs a separate **manually approved** controlled Git checkout/detached recovery of the known-good commit (or approved revert commit), rebuilding dependencies, correct-user PM2 restart, and verification of local/public health. After detached rollback, reconcile the production branch before any future forward deploy. Do not casually run `git reset --hard` or recursively overwrite production files.

**Operator verification sequence (read-only before a deployment):**
```bash
systemctl cat pm2-onedecore.service
systemctl show pm2-onedecore.service -p User -p MainPID -p ExecStart
sudo -u onedecore -H env PM2_HOME=/home/onedecore/.pm2 pm2 list --no-color
git -C /var/www/onedecore status --short --untracked-files=no
git -C /var/www/onedecore rev-parse HEAD
curl -fsS --max-time 8 http://127.0.0.1:3000/api/health
```
No restart or state mutation is intended by this sequence. Only perform the actual deploy using the approved exact SHA and runbook once every gate is cleared.

## Post-deploy acceptance (future)

Public GET `/`, `/api/health`, `/robots.txt`, `/sitemap.xml`, `/portfolio`; logged-out `/admin` and `/admin/whatsapp/scheduler` redirect to login; authorized Owner/Staff logins succeed; CRM leads, nurture, scheduler and reports render at mobile/tablet/desktop; permissions/assignee isolation hold; normal website lead-intake path remains enabled. Check app/systemd status and logs for errors, unexpected jobs and duplicate dispatch. Check that **no new WhatsApp campaign, automated send, shop, payment or ad provider action** was triggered by rollout. Do not submit real marketing tests without separately granted authority.

## GO/NO-GO decision

**NO-GO today on current evidence.** This document and its companion script are read-only release preparation. HOLD flags remain unchanged. A future GO must identify approver, exact commit, backup/recovery evidence, restart owner, rollout time, risk waiver and rollback operator; absence of any is NO-GO.
