# Releasing AutoMate

How versions, tags, the changelog and GitHub Releases work. Releases are cut by a maintainer.

## Versioning

AutoMate uses [Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`.

- **PATCH** (`0.1.1`): fixes only; no new migrations that change existing data, no configuration
  changes.
- **MINOR** (`0.2.0`): new features, new migrations or new optional settings, compatible with
  existing installations after a normal update.
- **MAJOR** (`1.0.0` → `2.0.0`): anything that needs manual action when updating: a removed or
  renamed setting, a data migration that needs a step, a changed deployment requirement.

While AutoMate is below `1.0.0`, a MINOR release may also carry breaking changes; they are always
called out under **Upgrade notes**. The version lives in the Git tag (`v0.1.0`). The package
manifests stay at `0.0.0` and `private`: nothing is published to npm.

## Changelog

[CHANGELOG.md](../CHANGELOG.md) follows [Keep a Changelog](https://keepachangelog.com/). Every pull
request that changes behaviour adds a line under `## [Unreleased]` in the right group (`Added`,
`Changed`, `Fixed`, `Removed`, `Security`). Write for people running AutoMate, not for developers.

## Release checklist

1. `main` is green: CI, Security and Docker checks pass.
2. Update the changelog: rename `## [Unreleased]` to `## [X.Y.Z] - YYYY-MM-DD`, add a fresh empty
   `## [Unreleased]` above it, and write **Upgrade notes** for anything self-hosters must do (new
   required settings, migrations that take a while, manual steps).
3. Check the docs match the release (README, `.env.example`, deployment guides).
4. Commit: `chore(release): vX.Y.Z`.
5. Tag and push:

   ```bash
   git tag -a vX.Y.Z -m "AutoMate vX.Y.Z"
   git push origin main vX.Y.Z
   ```

6. The [Release workflow](../.github/workflows/release.yml) creates the GitHub Release with notes
   generated from the merged pull requests. Edit it to add the changelog section and the upgrade
   notes at the top.
7. Try the update path on a test installation:
   `git checkout vX.Y.Z && docker compose -f docker-compose.prod.yml up -d --build`.

## Migrations in a release

- Migrations are forward-only and applied automatically by the `migrate` service (Docker) or
  `prisma migrate deploy` (other deployments) before the new API starts.
- A release that adds migrations says so in its notes. Self-hosters back up before updating; rolling
  back across a migration means restoring that backup
  ([backup and restore](deployment/backup-and-restore.md)).

## Security releases

Fixes for reported vulnerabilities are prepared privately (a GitHub security advisory), released as
a PATCH, and described in the release notes and the advisory once users can update. See
[SECURITY.md](../SECURITY.md).
