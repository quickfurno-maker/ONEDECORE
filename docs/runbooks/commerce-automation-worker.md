# Commerce automation worker runbook

ONEDECORE owns the commerce automation queue and worker. n8n and WhatsApp are not part of this execution path.

## Safety gates

Processing requires both gates to be open:

1. `ONEDECORE_COMMERCE_AUTOMATION_ENABLED=true` in `.env.production.local`.
2. Commerce → Automations runtime state is `Running`.

The worker secret must be at least 32 characters. Keep it server-only and never prefix it with `NEXT_PUBLIC_`.

The public Shop gate is separate. Enabling commerce automation does not enable `/shop`.

## Install after the reviewed commit is merged and deployed

Run as root on the production VPS:

```bash
install -o root -g root -m 0644 /var/www/onedecore/scripts/systemd/onedecore-commerce-automation.service /etc/systemd/system/
install -o root -g root -m 0644 /var/www/onedecore/scripts/systemd/onedecore-commerce-automation.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now onedecore-commerce-automation.timer
```

Before opening the deployment gate, set these in `/var/www/onedecore/.env.production.local`:

```text
ONEDECORE_COMMERCE_AUTOMATION_ENABLED=true
ONEDECORE_COMMERCE_AUTOMATION_WORKER_SECRET=<32+ character random secret>
```

Then restart the existing PM2 app with `--update-env` using the canonical deployment process.

## Verify

```bash
systemctl status onedecore-commerce-automation.timer --no-pager
systemctl list-timers onedecore-commerce-automation.timer --no-pager
systemctl start onedecore-commerce-automation.service
journalctl -u onedecore-commerce-automation.service -n 20 --no-pager
```

Logs contain counts only; they must never print the worker secret or notification payloads.

## Emergency stop

Pause from Commerce → Automations for the fastest reversible stop. For a deployment-level shutdown, set `ONEDECORE_COMMERCE_AUTOMATION_ENABLED=false` and restart the existing PM2 app. To stop scheduling entirely:

```bash
systemctl disable --now onedecore-commerce-automation.timer
```

Do not enable the WhatsApp channel until its adapter is separately certified.
