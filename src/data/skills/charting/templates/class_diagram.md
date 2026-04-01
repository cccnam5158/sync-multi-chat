# Class Diagram Templates

## Basic Inheritance

```mermaid
classDiagram
    class Animal {
        +String name
        +int age
        +makeSound() void
        +move() void
    }
    class Dog {
        +String breed
        +fetch() void
        +bark() void
    }
    class Cat {
        +bool indoor
        +purr() void
    }
    Animal <|-- Dog
    Animal <|-- Cat
```

## Interface Pattern

```mermaid
classDiagram
    class Repository {
        <<interface>>
        +findById(id) Entity
        +findAll() List~Entity~
        +save(entity) void
        +delete(id) void
    }
    class UserRepository {
        +findByEmail(email) User
    }
    class OrderRepository {
        +findByUser(userId) List~Order~
    }
    Repository <|.. UserRepository
    Repository <|.. OrderRepository
```

## Composition and Aggregation

```mermaid
classDiagram
    class Company {
        +String name
        +List~Department~ departments
    }
    class Department {
        +String name
        +List~Employee~ employees
    }
    class Employee {
        +String name
        +String role
    }
    Company *-- Department : contains
    Department o-- Employee : has
```

## Relationship Types

- `<|--` Inheritance (extends)
- `<|..` Implementation (implements)
- `*--` Composition (strong ownership)
- `o--` Aggregation (weak ownership)
- `-->` Association
- `-->`  Dependency (dashed)
- `1` `*` `0..1` `1..*` Cardinality labels
