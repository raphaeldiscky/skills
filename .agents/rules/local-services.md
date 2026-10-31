# Local services: start them yourself, stop what you started

**You may start local services yourself** when a task needs them: Workers (`wrangler dev`), dev servers
(`moon run <app>:serve` / `:dev`, `pnpm dev`), the compose stack, cluster port-forwards, background launcher
scripts. Run long-lived ones in the background.

- Before starting one, check whether I already have it running on that port, and reuse it if so.
- When the task is done, stop every service you started and say which ones.
- Never stop a service you didn't start.
