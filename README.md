# MediKeeper

An offline medication reminder. No account, no internet needed, no limit on medications, and your data never leaves your phone.

Built with Expo (SDK 58), Expo Router and AsyncStorage, so it runs in Expo Go with no custom build.

## What works so far (week 1)

- Add, edit and delete medications: name, dose, type, colour, notes.
- Schedules: every day, specific weekdays, every N days, or as needed, with any number of reminder times.
- Optional refill tracking: taking a dose counts one down, and the list warns you when you're running low.
- **Today** tab: each scheduled dose with Take / Skip / Undo, plus a quick "log a dose" for as-needed medicines.
- Everything is stored on the device (AsyncStorage).

Reminder notifications arrive in week 2.

## Run it

```bash
npm install
npx expo start
```

Scan the QR code with the Expo Go app on your phone.

## Checks

```bash
npm run typecheck   # TypeScript
npm test            # scheduling logic unit tests (Node's built-in test runner)
```

## Project layout

- `src/app/(tabs)/index.tsx`: Today screen
- `src/app/(tabs)/medications.tsx`: medication list
- `src/app/med/edit.tsx`: add / edit form
- `src/lib/schedule.ts`: pure scheduling logic (tested in `tests/`)
- `src/lib/db.ts`: on-device storage and dose logging
