# Waiting: estimate first, cap every wait

Before waiting on a command, job, deploy or test run, estimate how long it should realistically take (from earlier
runs, logs, CI history or the docs) and use a timeout near that estimate. Don't wait much longer than it.

- Under 1 minute: run it in the foreground with a timeout of twice the estimate.
- 1 to 2 minutes: run it in the foreground, checking every 15 to 30 seconds.
- Over 2 minutes: run it in the background, check after about 1 minute, then every fifth of the estimate (30 to 120
  seconds).
- Every polling loop has a hard cap (an iteration limit or a deadline). Never loop on a condition alone.
- Stop at twice the estimate, or after 5 minutes with no progress (logs or status unchanged), whichever comes first.
  Read the logs, report the status and the likely cause, and ask the user before waiting longer.
