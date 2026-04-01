# Requirement Diagram Templates

## Basic Requirement Diagram

```mermaid
requirementDiagram

    requirement user_auth {
        id: 1
        text: Users must authenticate before accessing the system.
        risk: high
        verifymethod: test
    }

    functionalRequirement password_policy {
        id: 1.1
        text: Passwords must be at least 12 characters.
        risk: medium
        verifymethod: test
    }

    performanceRequirement login_speed {
        id: 1.2
        text: Login must complete within 2 seconds.
        risk: low
        verifymethod: demonstration
    }

    element auth_service {
        type: microservice
        docref: docs/auth_service
    }

    element login_page {
        type: UI component
        docref: docs/login_page
    }

    user_auth - contains -> password_policy
    user_auth - contains -> login_speed
    auth_service - satisfies -> user_auth
    login_page - satisfies -> password_policy
    auth_service - verifies -> login_speed
```

## Key Syntax

- `requirementDiagram` - Declaration keyword
- **Requirement types**: `requirement`, `functionalRequirement`, `interfaceRequirement`, `performanceRequirement`, `physicalRequirement`, `designConstraint`
- **Requirement fields**: `id`, `text`, `risk` (low/medium/high), `verifymethod` (analysis/inspection/test/demonstration)
- **Elements**: `element name { type: ..., docref: ... }`
- **Relationships**: `contains`, `copies`, `derives`, `satisfies`, `verifies`, `refines`, `traces`
- **Syntax**: `source - relationship -> target`
