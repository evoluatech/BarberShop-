# Security Specification — Barber Shop Client & Shared Firestore Backend

## 1. Data Invariants
1. **Default Deny**: No document outside explicitly matched collections can be read or written.
2. **Verified Identity**: All reads/writes require `request.auth != null` and `request.auth.token.email_verified == true`.
3. **Zero Privilege Escalation**: Clients registering in `/users/{userId}` can only create `role: "client"`, cannot alter `role` or `uid`, and cannot write to `/admins` or `/barberAccounts`.
4. **Zero-Trust Pricing & Duration**: On appointment creation, `priceCents` and `serviceDurationMinutes` MUST match the authoritative `/services/{serviceId}` document in Firestore.
5. **Atomic Double-Booking Lock**: Every client booking in `/appointments/{appointmentId}` MUST atomically create its matching lock in `/availabilitySlots/{slotLockId}` in the same write batch (`existsAfter` / `getAfter`).
6. **PII Isolation & Query Enforcement**: Clients can ONLY `get` or `list` `/appointments` where `resource.data.clientId == request.auth.uid`, and can NEVER read other users' `/users/{otherId}` documents. Availability lookups query `/availabilitySlots`, which stores ZERO PII (no names, phones, emails, or notes).
7. **Terminal State Locking**: Once an appointment reaches `Concluído` or `Cancelado`, clients cannot modify it further; only verified barbers/admins (`isBarber()`) have controlled management overrides.
8. **Shadow Field Prevention**: Every `create` validates exact `keys().hasAll(...)` and `keys().hasOnly(...)`; every `update` validates `affectedKeys().hasOnly(...)` inside named action branches + full `isValidEntity()` re-validation.

## 2. The "Dirty Dozen" Attack Payloads (All MUST Return `PERMISSION_DENIED`)
1. **Unauthenticated Appointment Read**: Anonymous user calls `getDocs(collection(db, 'appointments'))` -> Denied.
2. **Unverified Email Spoof (`email_verified: false`)**: Attacker claims admin email `evoluatechbr@gmail.com` with `email_verified: false` -> Denied (`isVerifiedSignedIn()` fails).
3. **Self-Role Escalation on Profile Create**: Client creates `/users/{uid}` with `role: "admin"` or `role: "barber"` -> Denied (`incoming().role == 'client'`).
4. **Role Escalation on Profile Update**: Client updates `/users/{uid}` adding `role: "barber"` in `affectedKeys()` -> Denied.
5. **Shadow / Ghost Field Injection**: Client creates appointment with extra field `isPaid: true` or `discountCents: 9999` -> Denied (`keys().hasOnly(...)`).
6. **Client Price Tampering**: Client submits `priceCents: 1` for `corte-degrade` (`4500`) -> Denied (`get(/services/...).data.priceCents == incoming().priceCents`).
7. **Cross-Client PII Harvesting (`list` without owner filter)**: Client A runs `getDocs(collection(db, 'appointments'))` without `where('clientId', '==', uid)` -> Denied (`allow list: if resource.data.clientId == request.auth.uid || isBarber()`).
8. **Identity Spoofing on Booking Create**: Client A attempts creating appointment with `clientId: "client-B"` -> Denied (`incoming().clientId == request.auth.uid`).
9. **Orphaned Appointment Without Slot Lock**: Client creates `/appointments/{id}` directly without creating `/availabilitySlots/{slotLockId}` in the same batch -> Denied (`existsAfter(...)` fails).
10. **Terminal State Resurrection**: Client tries updating a `Cancelado` or `Concluído` appointment back to `Confirmado` -> Denied.
11. **Oversized Payload / Resource Poisoning**: Attacker writes a 5,000-character string to `notes` or a 300-character document ID -> Denied (`isValidId()` and `.size()` checks fail).
12. **Client Timestamp Forgery**: Client passes a backdated `createdAt` instead of `request.time` -> Denied (`incoming().createdAt == request.time`).
