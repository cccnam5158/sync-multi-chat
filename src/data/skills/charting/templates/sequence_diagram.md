# Sequence Diagram Templates

## Basic Request-Response

```mermaid
sequenceDiagram
    participant C as Client
    participant S as Server
    participant D as Database

    C->>S: HTTP Request
    S->>D: Query
    D-->>S: Results
    S-->>C: HTTP Response
```

## Authentication Flow

```mermaid
sequenceDiagram
    participant U as User
    participant A as App
    participant Auth as Auth Server
    participant API as API Server

    U->>A: Enter credentials
    A->>Auth: POST /login
    Auth->>Auth: Validate credentials
    alt Valid
        Auth-->>A: JWT Token
        A->>API: Request + Token
        API->>API: Verify token
        API-->>A: Protected data
        A-->>U: Show data
    else Invalid
        Auth-->>A: 401 Unauthorized
        A-->>U: Show error
    end
```

## Async Processing

```mermaid
sequenceDiagram
    participant U as User
    participant API as API
    participant Q as Queue
    participant W as Worker

    U->>API: Submit job
    API->>Q: Enqueue task
    API-->>U: Job ID (202 Accepted)

    W->>Q: Poll for tasks
    Q-->>W: Task data
    W->>W: Process task
    W->>API: Update status

    U->>API: Check status
    API-->>U: Job complete
```

## Key Syntax

- `->>` Solid line with arrowhead (synchronous)
- `-->>` Dashed line with arrowhead (response/async)
- `--)` Solid line with open arrow
- `alt/else/end` - Conditional paths
- `loop/end` - Repeated interactions
- `Note over A,B: text` - Notes spanning participants
- `activate/deactivate` - Activation bars
