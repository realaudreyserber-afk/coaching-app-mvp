# Firestore Rules Tests

## Requirements

- Firebase CLI installed (`npm install -g firebase-tools`)
- Java 11+ (Firebase emulator dependency)

## Running

```bash
# 1. Start emulator
firebase emulators:start --only firestore

# 2. In another terminal
npx vitest run test/rules
```

## What is covered

- `users/{uid}` owner-only read/write
- Recursive subcollection access (any depth) for owner only
- Cross-user access blocked
- `content/*` admin-only write (food-data poisoning protection)
- `experiments` read-only for users
- `experiment_exposures` append-only with uid spoofing protection
- Unauthenticated access blocked

## CI integration

In CI, use the emulator action:

```yaml
- name: Start Firebase emulator
  run: firebase emulators:exec --only firestore "npx vitest run test/rules"
```
