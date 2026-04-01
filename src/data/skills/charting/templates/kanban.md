# Kanban Board Templates

## Basic Kanban

```mermaid
kanban
    todo[Todo]
        task1[Design landing page]
        task2[Write API docs]
        task3[Set up CI/CD]
    inprogress[In Progress]
        task4[Build auth module]
        task5[Create database schema]
    done[Done]
        task6[Project setup]
        task7[Define requirements]
```

## Kanban with Metadata

```mermaid
---
config:
  kanban:
    ticketBaseUrl: 'https://project.atlassian.net/browse/#TICKET#'
---
kanban
    todo[Todo]
        t1[Create user signup flow]@{ assigned: Alice, ticket: PROJ-101, priority: High }
        t2[Add email verification]@{ assigned: Bob, ticket: PROJ-102, priority: High }
    inprogress[In Progress]
        t3[Design dashboard]@{ assigned: Carol, ticket: PROJ-100, priority: Very High }
    review[Review]
        t4[API rate limiting]@{ assigned: Dave, ticket: PROJ-98 }
    done[Done]
        t5[Setup project repo]@{ assigned: Alice, ticket: PROJ-95 }
```

## Key Syntax

- `kanban` - Declaration keyword
- **Columns**: `columnId[Column Title]` - workflow stages
- **Tasks**: `taskId[Task Description]` - nested under columns via indentation
- **Metadata**: `@{ assigned: Name, ticket: ID, priority: Level }`
- **Priority levels**: `Very High`, `High`, `Low`, `Very Low`
- **Config**: `ticketBaseUrl` with `#TICKET#` placeholder for clickable links
