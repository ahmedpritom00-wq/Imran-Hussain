# Security Specification — Team Sales Pro (Laxmipur Territory)

## 1. Data Invariants
1. **Verified Identity**: All writes and authenticated reads require `request.auth != null` and `request.auth.token.email_verified == true`.
2. **RBAC Integrity (No Self-Escalation)**: Users creating their own `/users/{uid}` profile can only register with `role == 'pending'` (unless their verified email matches the bootstrapped admin `imran972913@gmail.com`). Users cannot modify their own `role`, `active`, or `uid`, nor can they write to `/admins/{uid}`.
3. **PII Isolation**: User email and phone are stored strictly in `/users/{uid}/private/info` and are only readable/writable by the owning user (`uid == request.auth.uid`) or an `admin`.
4. **Master Gate & Relational Integrity**:
   - Every `srs/{srId}` document references an existing `distributors/{distributorId}` document.
   - Every `transactionItems/{itemId}` document references an existing (or same-batch `existsAfter`) `transactions/{transactionId}` document and `products/{productId}` document.
   - Every `transactions/{transactionId}` document references an existing `distributors/{distributorId}` document.
   - Secondary Sales transactions require a valid `srId` referencing an existing `srs/{srId}` document.
5. **SR Assignment Scope**: An `sr` user can only create `Secondary Sales` transactions (never `Primary Stock`), and only for their assigned `distributorId` and `srId`.
6. **Price & Catalog Protection**: Only `admin` (and `tso` for SRs/opening stock) can modify `products`, `distributors`, `srs`, or `priceHistory`. SRs can never alter prices or product definitions.
7. **Temporal Integrity & Immutability**: `createdAt == request.time`, `updatedAt == request.time`, and `id`, `createdAt`, `createdByUid` are immutable after creation.
8. **Zero Blanket Reads / Zero `get()` in `list`**: Every `allow list` rule evaluates `isBootstrappedAdmin()` or `resource.data` (`createdByUid == request.auth.uid` or `request.auth.uid in resource.data.sharedWithUids`).
9. **Path & Field Bounds**: All document IDs match `^[a-zA-Z0-9_-]+$` (`<= 128` chars), all strings enforce explicit `.size()` limits, and `sharedWithUids` is strictly bounded (`<= 100`).

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return `PERMISSION_DENIED`)
1. **Self-Role Escalation on Registration**: Pending user creates `/users/{uid}` with `{ role: "admin" }`.
2. **Profile Role Tampering on Update**: Authenticated SR updates `/users/{uid}` changing `role` from `"sr"` to `"admin"`.
3. **Shadow Ghost Field Injection**: Admin or SR writes `/products/p2` with an extra undeclared field `{ isVerified: true }`.
4. **PII Scraping**: Authenticated SR attempts `get` on `/users/{otherUid}/private/info`.
5. **Unverified Email Spoof**: User with `email: "imran972913@gmail.com"` and `email_verified: false` attempts read/write.
6. **SR Creating Primary Stock**: Authenticated SR attempts to create a `transactions/{txId}` with `kind: "Primary Stock"`.
7. **SR Forging Another Distributor's Sale**: SR assigned to `d1` attempts to create a `Secondary Sales` transaction with `distributorId: "d2"`.
8. **Orphaned Transaction Item**: User creates `/transactionItems/item1` pointing to a non-existent `transactionId: "fake_tx"`.
9. **SR Price Modification**: Authenticated SR attempts to update `/products/p2` changing `price` to `0.01`.
10. **ID Poisoning**: User attempts to write `/products/bad$id` or a 300-char document ID.
11. **Timestamp Forgery**: User creates a transaction with `createdAt` set to a backdated client timestamp instead of `request.time`.
12. **Blanket List Scraping by Pending User**: Newly signed-in `pending` user attempts to list `/transactions` or `/products`.
