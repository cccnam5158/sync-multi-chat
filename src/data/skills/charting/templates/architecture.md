# Architecture Diagram Templates

## Basic Architecture (Beta)

```mermaid
architecture-beta
    group api(cloud)[API Layer]
    group backend(server)[Backend]
    group data(database)[Data Layer]

    service web(internet)[Web Client]
    service gateway(server)[API Gateway] in api
    service auth(server)[Auth Service] in backend
    service app(server)[App Service] in backend
    service db(database)[PostgreSQL] in data
    service cache(disk)[Redis] in data

    web:R --> L:gateway
    gateway:R --> L:auth
    gateway:B --> T:app
    app:R --> L:db
    app:B --> T:cache
```

## Microservices Architecture

```mermaid
architecture-beta
    group frontend(cloud)[Frontend]
    group services(server)[Services]
    group storage(database)[Storage]

    service browser(internet)[Browser] in frontend
    service mobile(internet)[Mobile App] in frontend
    service gateway(server)[API Gateway] in services
    service users(server)[User Service] in services
    service orders(server)[Order Service] in services
    service payments(server)[Payment Service] in services
    service userdb(database)[User DB] in storage
    service orderdb(database)[Order DB] in storage

    browser:B --> T:gateway
    mobile:B --> T:gateway
    gateway:B --> T:users
    gateway:B --> T:orders
    gateway:B --> T:payments
    users:B --> T:userdb
    orders:B --> T:orderdb
```

## Key Syntax

- `architecture-beta` - Declaration keyword (beta suffix required)
- **Groups**: `group id(icon)[Label]`, nest with `in parent_id`
- **Services**: `service id(icon)[Label]`, place with `in group_id`
- **Junctions**: `junction id` - enable 4-way splits
- **Edges**: `service1:Direction --> Direction:service2`
- **Directions**: `T` (top), `B` (bottom), `L` (left), `R` (right)
- **Arrow types**: `-->` (forward), `<--` (reverse), `---` (no arrow)
- **Built-in icons**: `cloud`, `database`, `disk`, `internet`, `server`
