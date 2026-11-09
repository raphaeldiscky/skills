# Waiting: estimate first, cap every wait

Before waiting on a command, job, deploy or test run, estimate how long it should realistically take (from earlier
runs, logs, CI history or the docs) and use a short timeout near that estimate. Don't wait much longer than it.

- Every polling loop has a hard cap (an iteration limit or a deadline). Never loop on a condition alone.
- Poll at the pace the state actually changes, such as every 30 to 60 seconds for a job, not every few seconds.
  Run anything over about two minutes in the background and check back, instead of blocking on it.
- When the estimate plus a margin passes, stop. Read the logs, report the status and the likely cause, and ask the
  user before waiting longer.
