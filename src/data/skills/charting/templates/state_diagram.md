# State Diagram Templates

## Basic State Machine

```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> Processing: Start
    Processing --> Done: Complete
    Processing --> Error: Fail
    Error --> Idle: Retry
    Done --> [*]
```

## Order Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Draft
    Draft --> Submitted: Submit
    Submitted --> Processing: Accept
    Submitted --> Rejected: Reject
    Processing --> Shipped: Ship
    Shipped --> Delivered: Confirm delivery
    Delivered --> [*]
    Rejected --> Draft: Revise

    state Processing {
        [*] --> Picking
        Picking --> Packing
        Packing --> ReadyToShip
        ReadyToShip --> [*]
    }
```

## Concurrent States

```mermaid
stateDiagram-v2
    [*] --> Active

    state Active {
        [*] --> Running
        Running --> Paused: Pause
        Paused --> Running: Resume
        --
        [*] --> Monitoring
        Monitoring --> Alerting: Threshold exceeded
        Alerting --> Monitoring: Resolved
    }

    Active --> Stopped: Shutdown
    Stopped --> [*]
```

## Key Syntax

- `[*]` Start or end state
- `-->` Transition with optional label after `:`
- `state Name { }` Composite state
- `--` Separator for concurrent regions
- `note right of State: text` Add notes
