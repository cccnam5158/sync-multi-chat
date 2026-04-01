# ZenUML Templates

## Basic ZenUML Sequence

```mermaid
zenuml
    title Order Service
    @Actor Client
    @Boundary API
    @EC2 Service
    @Database DB

    Client->API.createOrder() {
        Service.validate()
        DB.save()
        return orderId
    }
```

## ZenUML with Conditionals

```mermaid
zenuml
    title Authentication Flow
    @Actor User
    @Boundary AuthController
    @EC2 AuthService
    @Database UserDB

    User->AuthController.login(credentials) {
        AuthService.authenticate(credentials) {
            UserDB.findUser(email)
            if (valid) {
                return token
            } else {
                return error
            }
        }
    }
```

## ZenUML with Error Handling

```mermaid
zenuml
    title Payment Processing
    @Actor Client
    @EC2 PaymentService
    @Database PaymentDB

    Client->PaymentService.processPayment(amount) {
        try {
            PaymentDB.debit(amount)
            return success
        } catch {
            PaymentDB.rollback()
            return failure
        } finally {
            PaymentDB.logTransaction()
        }
    }
```

## Key Syntax

- `zenuml` - Declaration keyword
- **Participants**: `@Actor Name`, `@Database Name`, `@Boundary Name`, `@EC2 Name`, `@Lambda Name`
- **Sync message**: `A.method()` or `A.method() { ... }`
- **Async message**: `A->B: message`
- **Return**: `return value` inside blocks
- **Conditionals**: `if (condition) { } else { }`
- **Loops**: `while(condition) { }`, `for(item in list) { }`, `loop { }`
- **Error handling**: `try { } catch { } finally { }`
- **Parallel**: `par { ... }`
- **Comments**: `// comment text`
