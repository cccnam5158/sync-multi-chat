# C4 Diagram Templates

## C4 Context Diagram

```mermaid
C4Context
    title System Context Diagram

    Person(user, "User", "A customer of the system")

    System(webapp, "Web Application", "Main application providing all features")

    System_Ext(email, "Email System", "Sends notification emails")
    System_Ext(payment, "Payment Gateway", "Processes payments")

    Rel(user, webapp, "Uses", "HTTPS")
    Rel(webapp, email, "Sends emails", "SMTP")
    Rel(webapp, payment, "Processes payments", "HTTPS/API")
    Rel(email, user, "Delivers emails to")
```

## C4 Container Diagram

```mermaid
C4Container
    title Container Diagram

    Person(user, "User", "A customer")

    Container_Boundary(app, "Web Application") {
        Container(spa, "SPA", "React", "User interface")
        Container(api, "API Server", "Node.js", "Business logic and REST API")
        ContainerDb(db, "Database", "PostgreSQL", "Stores user data")
        ContainerQueue(queue, "Message Queue", "RabbitMQ", "Async processing")
    }

    System_Ext(email, "Email Service", "SendGrid")

    Rel(user, spa, "Uses", "HTTPS")
    Rel(spa, api, "API calls", "JSON/HTTPS")
    Rel(api, db, "Reads/Writes", "SQL")
    Rel(api, queue, "Publishes", "AMQP")
    Rel(queue, email, "Sends via", "SMTP")
```

## C4 Deployment Diagram

```mermaid
C4Deployment
    title Deployment Diagram

    Deployment_Node(cloud, "AWS", "Cloud") {
        Deployment_Node(ecs, "ECS Cluster") {
            Container(api, "API Server", "Node.js")
        }
        Deployment_Node(rds, "RDS") {
            ContainerDb(db, "Database", "PostgreSQL")
        }
    }

    Deployment_Node(client, "User Device") {
        Deployment_Node(browser, "Web Browser") {
            Container(spa, "SPA", "React")
        }
    }

    Rel(spa, api, "API calls", "HTTPS")
    Rel(api, db, "SQL", "TCP")
```

## Key Syntax

- **Diagrams**: `C4Context`, `C4Container`, `C4Component`, `C4Dynamic`, `C4Deployment`
- **Nodes**: `Person(alias, label, descr)`, `System(alias, label, descr)`, `Container(alias, label, techn, descr)`, `ContainerDb(...)`, `ContainerQueue(...)`
- **External**: Add `_Ext` suffix: `System_Ext(...)`, `Container_Ext(...)`
- **Boundaries**: `Enterprise_Boundary(alias, label) { }`, `System_Boundary(...)`, `Container_Boundary(...)`
- **Relationships**: `Rel(from, to, label, techn)`, `BiRel(...)`, `Rel_U/D/L/R(...)`
- **Styling**: `UpdateElementStyle(name, $bgColor, $fontColor, $borderColor)`
