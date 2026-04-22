# Firebase Security Specification - ProKaraoke Studio

## 1. Data Invariants
- Each user has a unique document at `/users/{uid}`.
- Real-time session data at `/users/{uid}/sessions/current` is private to the user.
- Queue items at `/users/{uid}/queue/{itemId}` are private to the user.
- Users can only read and write their own data.

## 2. The Dirty Dozen (Attack Scenarios)

| ID | Attack Name | Description | Expected |
|----|-------------|-------------|----------|
| 1 | Identity Spoofing | Attempt to create a user profile for a different UID. | DENY |
| 2 | Shadow Field Injection | Add `isAdmin: true` to the user profile. | DENY |
| 3 | Cross-User Sniffing | Try to read `sessions/current` of another user. | DENY |
| 4 | Queue Hijacking | Add a song to another user's queue. | DENY |
| 5 | ID Poisoning | Create a queue item with a 2KB junk character ID. | DENY |
| 6 | Bulk Leak | Attempt to list all users in the system. | DENY |
| 7 | State Shortcutting | Directly update `isPlaying` without changing `updatedAt`. | DENY (Integrity Check) |
| 8 | Email Tampering | Update another user's email address. | DENY |
| 9 | Large Payload Attack | Send a 1MB string into the `bpm` field. | DENY |
| 10 | Anonymous Write | Attempt to write to a session without being logged in. | DENY |
| 11 | Recursive Cost Attack | Triggering deep relational reads on a list query. | DENY |
| 12 | PII Leak | Unverified user reading owner's email. | DENY |

## 3. Test Runner (Draft)
A `firestore.rules.test.ts` will be implemented to verify these denials.
