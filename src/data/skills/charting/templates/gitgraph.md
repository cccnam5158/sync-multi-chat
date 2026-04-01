# GitGraph Templates

## Basic Git Workflow

```mermaid
gitgraph
    commit id: "init" tag: "v1.0.0"
    commit id: "fix-1"
    branch develop
    checkout develop
    commit id: "feat-1"
    commit id: "feat-2"
    checkout main
    merge develop id: "merge-1" tag: "v1.1.0"
    commit id: "hotfix" type: HIGHLIGHT
```

## Feature Branch Workflow

```mermaid
gitgraph
    commit id: "initial"
    branch develop order: 1
    checkout develop
    commit id: "dev-1"
    branch feature/auth order: 2
    checkout feature/auth
    commit id: "auth-1"
    commit id: "auth-2"
    checkout develop
    merge feature/auth id: "merge-auth"
    branch feature/ui order: 3
    checkout feature/ui
    commit id: "ui-1"
    commit id: "ui-2" type: REVERSE
    checkout develop
    merge feature/ui id: "merge-ui"
    checkout main
    merge develop tag: "v2.0.0"
```

## Key Syntax

- `gitgraph` - Declaration keyword (also `gitgraph LR:`, `gitgraph TB:`, `gitgraph BT:`)
- `commit` - Create commit (options: `id: "id"`, `tag: "label"`, `type: NORMAL|REVERSE|HIGHLIGHT`)
- `branch name` - Create and switch to branch (option: `order: N` for display position)
- `checkout name` - Switch to existing branch
- `merge branch` - Merge branch into current (options: `id:`, `tag:`, `type:`)
- `cherry-pick id: "commit_id"` - Copy a commit from another branch
