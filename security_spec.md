# Firestore Security Specification — Portal Guru SDN Lendang Telaga

## 1. Data Invariants
1. Every document in `/users/{userId}` and its subcollections (`/rosters/{rosterId}`, `/workspaceItems/{itemId}`) belongs strictly to the authenticated user whose `request.auth.uid == userId` and `request.auth.token.email_verified == true`.
2. Subcollection documents (`rosters` and `workspaceItems`) cannot be read or written unless the parent `/users/{userId}` document exists (Master Gate).
3. All `ownerUid`, `teacherId`, `itemType`, and `createdAt` fields are immutable after creation; `createdAt` and `updatedAt` must match `request.time`.
4. All document IDs (`userId`, `rosterId`, `itemId`) must match `^[a-zA-Z0-9_\-]+$` with length `1..128`.
5. Unbounded arrays are prohibited; `students` is capped at `<= 60` entries and `payload` map keys are capped at `<= 40`.

## 2. Dirty Dozen Adversarial Payloads (Expected: PERMISSION_DENIED)
1. Unauthenticated read/write to `/users/uid1/workspaceItems/item1`.
2. Unverified email (`email_verified: false`) writing `/users/uid1`.
3. Identity spoofing: `uid2` creating `/users/uid1/rosters/r1` with `ownerUid: "uid1"`.
4. Shadow field injection on create: `{ ..., isAdmin: true }`.
5. Shadow field injection on update: modifying `ownerUid` or `createdAt`.
6. Oversized document ID (`1500` chars) on `/users/uid1/workspaceItems/<long>`.
7. Invalid `itemType: "executable"` on `workspaceItems`.
8. Oversized `title` (`> 200` chars) on `workspaceItems`.
9. Oversized `students` array (`65` entries) on `rosters`.
10. Client-forged `createdAt` timestamp not equal to `request.time`.
11. Orphaned subcollection write to `/users/uid1/rosters/r1` when `/users/uid1` does not exist.
12. Cross-user collection `list` query on `/users` or `/users/uid1/workspaceItems` by `uid2`.
