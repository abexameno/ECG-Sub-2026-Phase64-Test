# Security Spec

## Data Invariants
1. A user document can only be created by the owner, with role "Teacher", credits 10, and status "Active".
2. Only Admins can modify "role" and "status" fields for a user.
3. Users can only modify their own documents, except for restricted fields.
4. Library items can only be created, read, updated, or deleted by the user who owns that path.
5. Feedback can be created by users, but only read/updated by admins (or read by creators).
6. Curriculum overrides can only be modified by admins, but are readable by any authenticated user.

## The "Dirty Dozen" Payloads
1. Create user with Admin role.
2. Update own user to Admin role.
3. Update own user's status.
4. Read another user's profile without being Admin.
5. Create a library item for another user.
6. Create an invalid library item (schema validation failure).
7. Create usage log with wrong userId.
8. Create feedback with corrupted schema.
9. Non-admin updating curriculum overrides.
10. Update feedback status without Admin.
11. Update valid library item with invalid fields.
12. Create a User with a ghost field.
