# Smart Food Expiry Tracker

**Group:**  COMP5216-2026-GP-23


**SDG Goal 12: Responsible consumption and production**

An app that helps university students waste less food by taking the effort out of tracking groceries. We built it with Expo SDK 57.

The idea is that you scan a product's barcode when you unpack your shopping, and the app fills in the product and works out when it will go off. It reminds you before the food spoils and suggests recipes for whatever needs using up. For anything you can't finish in time, it points you to a nearby donation point, and a waste summary shows what you ate against what you threw away.

## Key Features

Our Phase 2 mid-progress submission is tagged `v1.0`, and not everything we proposed is finished yet. The table below is what `main` does now. "Partly working" means you can open the screen and use it, but it is not reading real data yet.

| Feature | Status | What that means right now |
| --- | --- | --- |
| **Barcode scanning** | Working | Scan a product barcode, the app looks it up in Open Food Facts and fills in the name and a guessed expiry date, which you can correct |
| **Manual entry** | Working | Add, edit and delete items by hand, for loose produce or anything without a barcode |
| **Waste summary** | Partly working | The screen works, but the totals on it are example numbers, not counted from your real inventory |
| **Donation point finder** | Partly working | The list and the search box work, but the places are invented and sit at fixed distances. No GPS yet |
| **Expiry reminders** | Working | Choose 1 to 7 days' notice (1 by default) and get a second reminder on the expiry day. Reminders are rescheduled or cancelled when you edit, resolve or delete an item, and tapping one opens that item. Added after `v1.0` |
| **Recipe suggestions** | Not started | Placeholder screen only |


- **The inventory saves properly.** Items are written to storage on the device before the screen updates, then read back and checked when the app starts. They are still there after you close the app.
- **The expiry date field is built for a phone.** It uses a number keypad and puts the dashes in as you type, because the phone keypad has no dash key.
- **You can mark an item eaten or thrown out.** This saves the date as well, which the waste summary will need once it counts real data.
- **Nothing crashes when something goes wrong.** If the camera is blocked, the barcode isn't in the database, or there is no internet, you get the manual form with a message saying why.

## TODO for Phase 3

- Test expiry notifications on real Android and iOS devices
- Count the waste summary totals from real item outcomes, and add a `donated` outcome to the data model (at the moment you can only mark an item eaten or thrown out, but the summary counts donations)
- Replace the invented donation points with `expo-location` and a real data source
- Recipe suggestions from an LLM, built from the ingredients closest to expiring
- Empty, loading and error states on every screen, plus an accessibility pass

## Current Challenges

- Open Food Facts does not actually store shelf life. Its `expiration_date` field is whatever was printed on the packet a contributor photographed, so it is usually already in the past and we could not use it. We estimate shelf life from the product's category tags instead, and always show it as a guess for the user to correct.
- `expo-notifications` starts registering for push tokens as soon as you import it, which crashes Expo Go on Android in SDK 57 even though we only want local notifications. We got around it by importing the local-only parts of the library directly.
- Notifications depend on the phone's permission and battery settings, so we can unit test the timing rules but we can't prove delivery without a real device.
- Everything is stored on the phone, so there are no accounts and your data does not follow you to another device. We decided this was an acceptable trade-off to keep the project in scope.

## Mobile technologies

| Technology                                 | Used for                                       | Status                                     |
| ------------------------------------------ | ---------------------------------------------- | ------------------------------------------ |
| Camera (`expo-camera`)                     | Scanning product barcodes                      | Working                                    |
| Local notifications (`expo-notifications`) | Scheduled expiry reminders                     | Working, needs a real-device test pass     |
| GPS / geolocation (`expo-location`)        | Locating nearby food donation points           | Phase 3                                    |
| Mobile data networks                       | Open Food Facts lookups and recipe suggestions | Open Food Facts works; recipes are Phase 3 |

The notifications are scheduled locally on the phone. We don't use a push server or an Expo push token.

## How to run it

You need Node.js 20 or newer.

```bash
git clone git@github.sydney.edu.au:COMP5216-2026-S2/COMP5216-2026-GP-23.git
cd COMP5216-2026-GP-23/app
npm install
npm run start
```

Then scan the QR code with Expo Go. You need a real phone to test the barcode scanner, since a simulator has no camera to read a barcode with.

## Tests and checks

All three pass on `main`. Run them from the `app/` folder.

```bash
npm test          # 94 unit tests
npm run typecheck # TypeScript, strict mode
npm run lint
```

The tests cover the storage layer, the expiry date handling, the reminder scheduling rules, the shelf-life estimates and the Open Food Facts response parsing.

## Project structure

```
app/                  Expo project
  src/app/            screens and routes
  src/components/     shared UI
  src/context/        inventory state and saving to the device
  src/services/       local expiry reminder scheduling
  src/utils/          expiry dates, shelf-life estimates, Open Food Facts lookup
  src/types/          the food item data model
  assets/             icons and splash images
```
