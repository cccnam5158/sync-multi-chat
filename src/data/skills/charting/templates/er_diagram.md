# Entity-Relationship Diagram Templates

## Basic ER Diagram

```mermaid
erDiagram
    USER ||--o{ ORDER : places
    ORDER ||--|{ LINE_ITEM : contains
    PRODUCT ||--o{ LINE_ITEM : "included in"
    USER {
        int id PK
        string name
        string email UK
        datetime created_at
    }
    ORDER {
        int id PK
        int user_id FK
        datetime order_date
        string status
        decimal total
    }
    PRODUCT {
        int id PK
        string name
        decimal price
        int stock
    }
    LINE_ITEM {
        int id PK
        int order_id FK
        int product_id FK
        int quantity
        decimal unit_price
    }
```

## Blog Platform Schema

```mermaid
erDiagram
    AUTHOR ||--o{ POST : writes
    POST ||--o{ COMMENT : has
    POST }o--o{ TAG : "tagged with"
    AUTHOR ||--o{ COMMENT : writes
    AUTHOR {
        int id PK
        string username UK
        string email UK
        string bio
    }
    POST {
        int id PK
        int author_id FK
        string title
        text content
        string status
        datetime published_at
    }
    COMMENT {
        int id PK
        int post_id FK
        int author_id FK
        text body
        datetime created_at
    }
    TAG {
        int id PK
        string name UK
    }
```

## Relationship Cardinality

- `||--||` Exactly one to exactly one
- `||--o{` One to zero or many
- `||--|{` One to one or many
- `}o--o{` Zero or many to zero or many
- `}|--|{` One or many to one or many

## Attribute Labels

- `PK` Primary Key
- `FK` Foreign Key
- `UK` Unique Key
