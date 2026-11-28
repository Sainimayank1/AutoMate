# Security Policy

Thank you for helping keep AutoMate and the people who use it safe.

## Supported versions

AutoMate has not published a release yet. Security fixes are made on the `main` branch, and only
the latest `main` is supported. Once releases begin, this section will list which versions receive
fixes.

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub issues, discussions or pull
requests.**

Report them privately through GitHub's **private vulnerability reporting**: open the repository's
**Security** tab and choose **Report a vulnerability**. Only the maintainers can see the report.
If that option isn't available, email the maintainer at [mayanksaini4455@gmail.com](mailto:mayanksaini4455@gmail.com) with
"AutoMate security" in the subject.

Please include as much of the following as you can:

- the type of issue (for example authentication bypass, cross-user data access, injection, unsafe
  file upload);
- the affected endpoint, page or file path, and the commit or version you tested;
- step-by-step instructions to reproduce it, with any proof-of-concept code;
- the impact you believe it has, and any configuration it depends on.

## What to expect

AutoMate is maintained by volunteers, so we can't promise fixed response times. We aim to
acknowledge a report, keep you updated while we investigate, and credit you in the fix's release
notes if you'd like. Please give us a reasonable chance to release a fix before disclosing the issue
publicly.

## Scope

In scope: the code in this repository (the API in `apps/api`, the web app in `apps/web`, the shared
package in `packages/shared`) and its default configuration.

Out of scope:

- findings that need a compromised server, a stolen session or physical access to a device;
- denial-of-service or load testing against any instance you don't own;
- social engineering of maintainers or users;
- vulnerabilities in third-party services or dependencies (report those upstream; tell us if
  AutoMate needs to react);
- missing hardening on a self-hosted instance that deviates from the documented configuration.

## Running AutoMate securely

If you self-host AutoMate, keep secrets out of the repository, generate strong values for
`JWT_ACCESS_SECRET` and `DISPATCH_SECRET`, serve it over HTTPS, never expose PostgreSQL to the
internet, and keep regular backups. See `docs/architecture/security.md` and
`docs/architecture/deployment.md`.
