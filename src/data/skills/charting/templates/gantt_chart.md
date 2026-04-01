# Gantt Chart Templates

## Basic Project Timeline

```mermaid
gantt
    title Project Timeline
    dateFormat YYYY-MM-DD

    section Planning
    Requirements    :a1, 2024-01-01, 14d
    Design          :a2, after a1, 10d

    section Development
    Backend         :b1, after a2, 30d
    Frontend        :b2, after a2, 25d
    Integration     :b3, after b1, 10d

    section Testing
    QA Testing      :c1, after b3, 14d
    Bug Fixes       :c2, after c1, 7d

    section Launch
    Deployment      :d1, after c2, 3d
    Monitoring      :d2, after d1, 7d
```

## Sprint Plan

```mermaid
gantt
    title Sprint 12 Plan
    dateFormat YYYY-MM-DD
    axisFormat %b %d

    section User Stories
    Auth refactor       :active, us1, 2024-03-01, 5d
    Search feature      :us2, after us1, 4d
    Dashboard update    :us3, 2024-03-01, 3d

    section Tasks
    Code review         :crit, task1, after us1, 1d
    Testing             :task2, after us2, 2d

    section Milestones
    Sprint Demo         :milestone, m1, 2024-03-15, 0d
```

## Key Syntax

- `dateFormat YYYY-MM-DD` - Date format
- `axisFormat %b %d` - Axis display format
- `:active` - Currently active task
- `:crit` - Critical path task
- `:done` - Completed task
- `:milestone` - Milestone marker
- `after taskId` - Dependencies
- `2024-01-01, 14d` - Start date and duration
