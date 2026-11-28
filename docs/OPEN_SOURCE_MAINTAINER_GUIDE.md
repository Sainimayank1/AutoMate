# Open-source maintainer guide

What the repository already contains for running AutoMate as an open-source project, and the
GitHub settings a maintainer has to configure by hand. **None of the settings below can be set from
the repository itself, and none of them has been verified as enabled**: check each one in
**Settings** on GitHub.

## 1. In the repository (done)

| Area           | Files                                                                                                                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Licence        | `LICENSE` (AGPL-3.0); `AGPL-3.0-only` in every `package.json`                                                                                                                                           |
| Community      | `README.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `SUPPORT.md`, `CHANGELOG.md`                                                                                                       |
| Issues and PRs | `.github/ISSUE_TEMPLATE/` (bug, feature, documentation forms; blank issues off, links to security and support), `.github/PULL_REQUEST_TEMPLATE.md`                                                      |
| CI             | `.github/workflows/ci.yml`: format, lint, types, unit and API e2e tests, web tests, builds (job `checks`); Playwright (job `browser`); the Docker stack (job `docker`)                                  |
| Security       | `.github/workflows/security.yml`: Gitleaks on the whole history (job `Secret scan (Gitleaks)`), CodeQL and dependency review (public repositories only); `.gitleaksignore` for reviewed false positives |
| Dependencies   | `.github/dependabot.yml`: npm, GitHub Actions, Dockerfiles and Compose, weekly and grouped, with a 7-day cooldown                                                                                       |
| Releases       | `.github/workflows/release.yml` (a GitHub Release for each `v*.*.*` tag), [`docs/RELEASING.md`](RELEASING.md)                                                                                           |
| Supply chain   | Every GitHub Action pinned to a commit SHA (Dependabot keeps them current); workflow tokens read-only by default                                                                                        |

## 2. GitHub settings to configure (manual)

### Before making the repository public

- [ ] Check the latest **Actions** runs on `main` are green (CI, Security).
- [ ] Turn on **private vulnerability reporting** (below). `SECURITY.md` points people to it.
- [ ] Optional: make your commit email private for future commits (GitHub → Settings → Emails →
      "Keep my email addresses private"; then `git config user.email <id>+<login>@users.noreply.github.com`).
      Past commits keep their email.
- [ ] **Settings → General → Danger Zone → Change visibility → Public.**

### General (Settings → General)

- **Description:** `Open-source, self-hostable car ownership companion: fuel, expenses, maintenance, documents, trips and total cost of ownership.`
- **Website:** a live demo or the docs, if you have one.
- **Topics:** `car`, `vehicle-management`, `fuel-tracker`, `expense-tracker`, `maintenance-tracker`,
  `self-hosted`, `nestjs`, `react`, `prisma`, `postgresql`, `typescript`.
- **Social preview:** upload a 1280×640 image (for example the dashboard screenshot on a dark
  background with the logo).
- **Features:** Issues on. Discussions optional (if you turn it on, add it to `SUPPORT.md` and the
  issue template `config.yml`). Wiki off (docs live in the repository).
- **Pull requests:** allow squash merging (the PR title becomes a Conventional Commit); consider
  turning off merge commits and rebase merging for a linear history; turn on **Automatically delete
  head branches**.

### Branch protection (Settings → Rules → Rulesets, or Branches)

Create a ruleset for the default branch `main`:

- Require a pull request before merging (1 approval once there are other maintainers; with a single
  maintainer, requiring the checks alone avoids blocking yourself).
- Require status checks to pass, and the branch to be up to date: `checks`, `browser`, `docker` and
  `Secret scan (Gitleaks)`. Add `CodeQL` once it has run after the repository is public.
- Block force pushes and deletion.

### Actions (Settings → Actions → General)

- Workflow permissions: **Read repository contents** (the default token is read-only; the workflows
  ask for more only where they need it).
- Allow actions from GitHub and verified creators, or all actions: every action used is pinned to a
  commit SHA.
- Require approval for workflows from first-time contributors' forks.
- Optional secrets for scheduled push notifications: `AUTOMATE_API_URL` and `AUTOMATE_DISPATCH_SECRET`
  (see [deployment](architecture/deployment.md#4-push-notifications-optional)).

### Security (Settings → Security / Code security)

- **Private vulnerability reporting:** enable.
- **Dependabot alerts** and **Dependabot security updates:** enable. Version updates come from
  `.github/dependabot.yml`.
- **Secret scanning** and **push protection:** enable (free for public repositories).
- **Code scanning:** CodeQL already runs from `.github/workflows/security.yml` (the "advanced"
  setup). Don't also turn on CodeQL's default setup, which would conflict with the workflow.

### Labels (Issues → Labels)

The issue forms use GitHub's default `bug`, `enhancement` and `documentation` labels; keep them.
Useful additions: `good first issue`, `help wanted`, `dependencies` (Dependabot applies it),
`security`.

### Releases

Follow [docs/RELEASING.md](RELEASING.md). The first release is a maintainer decision; nothing has
been tagged yet.

## 3. Optional

- **CODEOWNERS** (`.github/CODEOWNERS` with `* @Sainimayank1`) to request your review on every pull
  request automatically.
- **OpenSSF Scorecard** (the `ossf/scorecard-action` workflow) and its badge, once the repository is
  public.
- **GitHub Discussions** for questions and ideas.
- **Sponsorship** with `.github/FUNDING.yml`.
- **A live demo instance** for the README, running the Docker stack with the demo data
  (`pnpm db:seed:demo` refuses remote APIs unless `DEMO_ALLOW_REMOTE=true`; use a separate, isolated
  instance).

## 4. Depends on plan or visibility

| Feature                                    | Public repository | Private repository                                                     |
| ------------------------------------------ | ----------------- | ---------------------------------------------------------------------- |
| CodeQL code scanning and dependency review | Free              | Needs GitHub Advanced Security (the workflow skips them while private) |
| Secret scanning and push protection        | Free              | Needs GitHub Secret Protection                                         |
| Private vulnerability reporting            | Available         | Not available                                                          |
| Branch protection and rulesets             | Free              | Needs a paid plan on personal accounts                                 |
| Dependabot alerts and updates              | Free              | Free                                                                   |

Plans change; check GitHub's current documentation before relying on this table.
