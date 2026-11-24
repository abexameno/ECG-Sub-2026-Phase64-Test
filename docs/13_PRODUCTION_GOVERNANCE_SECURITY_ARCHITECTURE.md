# ECG Architecture: Production Governance, AI Reliability & Security (Phase 7)

## 1. Overview
Phase 7 hardens ECG into a secure, robust, multi-school production platform. It establishes centralized AI model governance, server-authoritative quotas (`QuotaService`), structured operational audit trails (`AuditService`), and strict defense-in-depth school isolation.

## 2. Core Architectural Rules
- **Curriculum = WHAT**: Authoritative canonical curriculum is immutable by AI or users.
- **School = WHERE**: Strict multi-school isolation is enforced at the repository and quota boundaries.
- **Teaching Plan = WHEN**: Teaching context is preserved immutably.
- **Gemini = HOW**: Pedagogical content generation is governed and strictly validated against structured schemas.
- **Server = AUTHORITY**: Authorization, quotas, entitlements, and security decisions are never entrusted to the client.

## 3. Production Architecture Flow
```text
USER ──► AUTH / AUTHORIZATION ──► QUOTA CHECK ──► GENERATION CONTEXT
                                                          │
                                                          ▼
REPOSITORY ◄── ARTIFACT VALIDATION ◄── SCHEMA VALIDATION ◄── GEMINI
```
