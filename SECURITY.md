# Security Policy

## Reporting a vulnerability

Please do **not** open a public GitHub issue for security-sensitive findings.

Instead, report security issues privately to:

- Email: hello@pcircle.ai

Include as much detail as possible:

- affected version
- reproduction steps
- impact
- proof of concept if available

## Scope

Security-relevant areas in this project include:

- hook execution behavior
- file and path handling
- cached content persistence
- parser and detector boundaries
- input size handling
- any behavior that could unexpectedly expose or mutate user data

## Response expectations

We will try to:

- acknowledge receipt
- reproduce the issue
- assess severity and impact
- prepare a fix or mitigation

The exact timeline depends on issue severity and maintainer availability.

## Supported versions

Security fixes are generally applied to the latest maintained version on `main`.

If you are running an older version, upgrade first whenever possible.
