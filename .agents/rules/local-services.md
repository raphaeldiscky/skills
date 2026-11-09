# Local services: start them yourself, stop what you started

**You may start local services yourself** when a task needs them: dev servers, containers, databases,
tunnels and port-forwards. Run long-lived ones in the background.

- Before starting one, check whether I already have it running on that port, and reuse it if so.
- When the task is done, stop every service you started and say which ones.
- Never stop a service you didn't start.
