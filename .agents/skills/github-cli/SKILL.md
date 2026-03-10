---
name: github-cli
description: Use the GitHub CLI (gh) to perform all GitHub-related actions — pull requests, issues, releases, repo management, workflow runs, and API queries — directly from the terminal.
---

# GitHub CLI Skill

Use `gh` (GitHub CLI) for **all** GitHub interactions. Prefer `gh` over the GitHub MCP server tools whenever a terminal command can accomplish the task, because it is faster, scriptable, and produces machine-readable output with `--json`.

## Prerequisites

| Requirement | Check command |
|---|---|
| `gh` installed | `gh --version` |
| Authenticated | `gh auth status` |

If authentication fails, run `gh auth login` and follow the prompts.

## Current Repository Context

- **Repo:** `Rakeen70210/cartographerv2`
- **Default branch:** `main`

> [!TIP]
> Most `gh` commands auto-detect the repo from the current working directory's git remote. You rarely need to pass `--repo`.

---

## Quick-Reference Commands

### Pull Requests

```bash
# List open PRs
gh pr list

# Create a PR (interactive)
gh pr create

# Create a PR (non-interactive)
gh pr create --title "feat: add fog opacity slider" \
  --body "Adds a slider to control fog opacity" \
  --base main --head feature-branch

# View PR details
gh pr view <number>
gh pr view <number> --json title,state,reviews,mergeable

# Check out a PR locally
gh pr checkout <number>

# Review / approve / request changes
gh pr review <number> --approve
gh pr review <number> --request-changes --body "Please fix X"

# Merge a PR
gh pr merge <number> --squash --delete-branch

# View PR diff
gh pr diff <number>

# List PR checks/status
gh pr checks <number>
```

### Issues

```bash
# List open issues
gh issue list

# Create an issue
gh issue create --title "Bug: fog flickers on zoom" \
  --body "Steps to reproduce..." --label bug

# View an issue
gh issue view <number>

# Close an issue
gh issue close <number> --reason completed

# Reopen
gh issue reopen <number>

# Add labels
gh issue edit <number> --add-label "priority:high"

# Search issues
gh issue list --search "fog rendering" --state all
```

### Repository

```bash
# View repo info
gh repo view
gh repo view --json name,description,defaultBranchRef,stargazerCount

# Clone a repo
gh repo clone <owner>/<repo>

# Fork a repo
gh repo fork <owner>/<repo> --clone

# Create a new repo
gh repo create <name> --public --description "My project"

# List branches
gh api repos/{owner}/{repo}/branches --jq '.[].name'
```

### Releases

```bash
# List releases
gh release list

# Create a release
gh release create v1.0.0 --title "v1.0.0" --notes "Initial release"

# Create a release with auto-generated notes
gh release create v1.0.0 --generate-notes

# Download release assets
gh release download v1.0.0

# Delete a release
gh release delete v1.0.0 --yes
```

### GitHub Actions / Workflows

```bash
# List workflows
gh workflow list

# List recent runs
gh run list --limit 10

# View a specific run
gh run view <run-id>

# Watch a running workflow
gh run watch <run-id>

# Re-run a failed workflow
gh run rerun <run-id>

# View workflow run logs
gh run view <run-id> --log

# Trigger a workflow manually
gh workflow run <workflow-file> --ref main
```

### Gists

```bash
# Create a gist
gh gist create file.txt --public --desc "My gist"

# List your gists
gh gist list

# View a gist
gh gist view <gist-id>
```

### Notifications & Status

```bash
# See your cross-repo status (assigned PRs, review requests, issues)
gh status
```

### Labels

```bash
# List labels
gh label list

# Create a label
gh label create "priority:high" --color FF0000 --description "High priority"
```

---

## Advanced: The `gh api` Escape Hatch

For anything not covered by built-in commands, use `gh api` to hit any GitHub REST or GraphQL endpoint with automatic authentication.

### REST Examples

```bash
# Get repo details
gh api repos/Rakeen70210/cartographerv2

# List collaborators
gh api repos/Rakeen70210/cartographerv2/collaborators --jq '.[].login'

# Get a specific file from the repo
gh api repos/Rakeen70210/cartographerv2/contents/README.md --jq '.content' | base64 -d

# Create a comment on an issue
gh api repos/Rakeen70210/cartographerv2/issues/1/comments \
  -f body="Automated comment from gh api"
```

### GraphQL Example

```bash
# Get the 5 most recent PRs with review decision
gh api graphql -f query='
  query {
    repository(owner: "Rakeen70210", name: "cartographerv2") {
      pullRequests(last: 5) {
        nodes {
          title
          state
          reviewDecision
        }
      }
    }
  }
'
```

---

## JSON Output & Filtering

Always use `--json` and `--jq` for machine-readable output when scripting or when you need specific fields.

```bash
# Get PR titles and states as JSON
gh pr list --json number,title,state

# Filter with jq expressions
gh pr list --json number,title,state --jq '.[] | select(.state == "OPEN") | .title'

# Get the current user's login
gh api user --jq '.login'
```

---

## Best Practices

1. **Prefer `--json` output** — parse structured data instead of scraping human-readable text.
2. **Use `--jq` for filtering** — extract exactly the fields you need in one command.
3. **Use non-interactive flags** — when running commands programmatically, always supply `--title`, `--body`, `--base`, `--head`, etc. to avoid interactive prompts.
4. **Use `--yes` or `-y`** — for destructive commands (`gh release delete`, `gh pr merge`) to skip confirmation when you are confident.
5. **Check CI status before merging** — run `gh pr checks <number>` to verify all checks pass before `gh pr merge`.
6. **Delete branches after merge** — use `--delete-branch` with `gh pr merge` to keep the repo tidy.
7. **Scope searches** — use `--state`, `--label`, `--assignee`, `--search`, and `--limit` flags to narrow results.
8. **Fallback to `gh api`** — if a built-in command doesn't support what you need, `gh api` with REST or GraphQL will.

---

## Common Workflows

### Create a Feature Branch → PR → Merge

```bash
# 1. Create and switch to a feature branch
git checkout -b feat/my-feature

# 2. Make changes, commit
git add -A && git commit -m "feat: implement feature"

# 3. Push the branch
git push -u origin feat/my-feature

# 4. Create the PR
gh pr create --title "feat: implement feature" \
  --body "Description of changes" --base main

# 5. After review, merge
gh pr merge --squash --delete-branch
```

### Triage Issues

```bash
# List unassigned bugs
gh issue list --label bug --assignee ""

# Assign and label
gh issue edit <number> --add-assignee @me --add-label "priority:high"
```
