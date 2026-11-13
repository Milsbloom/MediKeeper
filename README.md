# MediKeeper

An offline medication reminder. No account, no internet needed, no limit on medications, and your data never leaves your phone.

Built with Expo (SDK 58), Expo Router and AsyncStorage, so it runs in Expo Go with no custom build.

## What works so far (week 1)

- Add, edit and delete medications: name, dose, type, colour, notes.
- Schedules: every day, specific weekdays, every N days, or as needed, with any number of reminder times.
- Optional refill tracking: taking a dose counts one down, and the list warns you when you're running low.
- **Today** tab: each scheduled dose with Take / Skip / Undo, plus a quick "log a dose" for as-needed medicines.
- Everything is stored on the device (AsyncStorage).

## Week 2: reminders

- A local notification at every dose time, with **Take** and **Snooze** buttons.
- Repeats every 5 to 30 minutes (up to 3 times) until the dose is marked; configurable in **Settings**.
- Marking a dose anywhere (app or notification) cancels its remaining reminders and clears it from the tray.
- The next 4 days are scheduled (capped under iOS's 64-notification limit) and topped up each time the app opens.
- Settings tab: reminders on/off, repeat interval, snooze length, permission status and a test reminder.

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
- `src/lib/db.ts`: on-device storage, settings and dose logging
- `src/lib/reminders.ts`: notification scheduling, Take/Snooze handling
- `src/app/(tabs)/settings.tsx`: reminder settings
