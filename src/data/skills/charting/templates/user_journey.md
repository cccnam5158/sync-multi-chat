# User Journey Templates

## Basic User Journey

```mermaid
journey
    title My Working Day
    section Go to work
        Make tea: 5: Me
        Go upstairs: 3: Me
        Do work: 1: Me, Cat
    section Go home
        Go downstairs: 5: Me
        Sit down: 5: Me
```

## E-Commerce Purchase Journey

```mermaid
journey
    title Online Shopping Experience
    section Discovery
        Search for product: 4: Customer
        Browse results: 3: Customer
        Read reviews: 4: Customer
    section Purchase
        Add to cart: 5: Customer
        Enter shipping info: 2: Customer
        Enter payment: 2: Customer
        Confirm order: 4: Customer
    section Post-Purchase
        Receive confirmation email: 5: Customer, System
        Track shipment: 3: Customer
        Receive package: 5: Customer
        Leave review: 3: Customer
```

## Key Syntax

- `journey` - Declaration keyword
- `title Title Text` - Diagram title
- `section Section Name` - Groups tasks into phases
- `Task name: score: actor1, actor2` - Task with satisfaction score (1-5) and actors
- Score: 1 = worst (red), 5 = best (green)
- Multiple actors are comma-separated
