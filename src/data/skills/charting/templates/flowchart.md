# Flowchart Templates

## Basic Top-Down Flowchart

```mermaid
graph TD
    A[Start] --> B{Decision?}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]
    C --> E[End]
    D --> E
```

## Left-Right Flowchart

```mermaid
graph LR
    A[Input] --> B[Process]
    B --> C{Valid?}
    C -->|Yes| D[Output]
    C -->|No| E[Error]
    E --> A
```

## Flowchart with Subgraphs

```mermaid
graph TD
    subgraph Frontend
        A[User] --> B[Browser]
        B --> C[React App]
    end
    subgraph Backend
        D[API Server] --> E[Business Logic]
        E --> F[Database]
    end
    C -->|HTTP Request| D
    D -->|Response| C
```

## Multi-Decision Flowchart

```mermaid
graph TD
    Start([Start]) --> Input[/Receive Input/]
    Input --> Validate{Valid?}
    Validate -->|No| Error[Show Error]
    Error --> Input
    Validate -->|Yes| Process[Process Data]
    Process --> Check{Approved?}
    Check -->|Yes| Save[(Save to DB)]
    Check -->|No| Reject[Reject]
    Save --> Notify[Send Notification]
    Notify --> End([End])
    Reject --> End
```

## Node Shapes Reference

- `[Text]` - Rectangle (process)
- `{Text}` - Diamond (decision)
- `([Text])` - Stadium/pill (start/end)
- `[(Text)]` - Cylinder (database)
- `[/Text/]` - Parallelogram (input/output)
- `((Text))` - Circle
- `>Text]` - Flag
