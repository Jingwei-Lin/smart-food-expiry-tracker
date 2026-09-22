# Smart Food Expiry Tracker

Group:  COMP5216-2026-GP-23


**SDG Goal 12: Responsible consumption and production**

An app that helps university students waste less food by taking the effort out of tracking groceries. We built it with Expo SDK 57.

The idea is that you scan a product's barcode when you unpack your shopping, and the app fills in the product and works out when it will go off. It reminds you before the food spoils and suggests recipes for whatever needs using up. For anything you can't finish in time, it points you to a nearby donation point, and a waste summary shows what you ate against what you threw away.

##Key  Features

- **Barcode scanning**: add a grocery item by scanning it, with the product name and typical shelf life looked up automatically from Open Food Facts
- **Expiry reminders**: a notification before each item is likely to spoil
- **Manual entry**: for loose produce, anything without a barcode, and correcting a suggested date
- **Recipe suggestions**: simple meal ideas built around the ingredients closest to expiring
- **Donation point finder**: the nearest food donation drop-offs, ordered by distance
- **Waste summary**: totals for what was eaten, donated and discarded

## What works so far

This is our Phase 2 mid-progress submission, so the six features above are not all finished. Below is what the code on `main` actually does right now.

### Working

- **The inventory saves properly.** Items are written to storage on the device before the screen updates, then read back and checked when the app starts. They are still there after you close the app.
- **Adding, editing and deleting items by hand.** The expiry date field uses a number keypad and puts the dashes in as you type, because the phone keypad has no dash key.
- **The list is sorted by what expires first.** Items are grouped by how many days they have left, so anything you need to deal with today sits at the top.
- **Marking an item eaten or thrown out.** This saves the date as well, which the waste summary will need later.
- **Barcode scanning.** The camera reads the barcode and the app looks the product up in Open Food Facts. It fills in the name and a guessed expiry date, and you can change both before saving.
- **Fallbacks when something goes wrong.** If the camera is blocked, the barcode isn't in the database, or there is no internet, you get the manual form with a message saying why. Nothing crashes or hangs.

### Finished but not merged yet

- **Expiry reminders** are done on the `feat/expiry-reminders` branch. They schedule a local notification 1 to 7 days before the expiry date plus one on the day itself, reschedule when you edit an item, and cancel when you delete it. We have not merged that branch into `main` yet, so the code in this submission does not schedule any notifications.

### Screens with no real data behind them yet

These three are in the tab bar so the navigation can be demonstrated, but the numbers on them are made up:

- **Waste summary** — example totals, not counted from the real inventory yet.
- **Donation points** — an invented list of places at fixed distances. It does not use GPS yet.
- **Recipes** — a placeholder screen.

## TODO for Phase 3

- Merge the expiry reminders branch, then test notifications on real Android and iOS devices
- Count the waste summary totals from real item outcomes, and add a `donated` outcome to the data model (at the moment you can only mark an item eaten or thrown out, but the summary counts donations)
- Replace the invented donation points with `expo-location` and a real data source
- Recipe suggestions from an LLM, built from the ingredients closest to expiring
- Empty, loading and error states on every screen, plus an accessibility pass

## Problems we ran into

- Open Food Facts does not actually store shelf life. Its `expiration_date` field is whatever was printed on the packet a contributor photographed, so it is usually already in the past and we could not use it. We estimate shelf life from the product's category tags instead, and always show it as a guess for the user to correct.
- `expo-notifications` starts registering for push tokens as soon as you import it, which crashes Expo Go on Android in SDK 57 even though we only want local notifications. We got around it by importing the local-only parts of the library directly.
- Notifications depend on the phone's permission and battery settings, so we can unit test the timing rules but we can't prove delivery without a real device.
- Everything is stored on the phone, so there are no accounts and your data does not follow you to another device. We decided this was an acceptable trade-off to keep the project in scope.

## Mobile technologies

| Technology                                 | Used for                                       | Status in this submission                 |
| ------------------------------------------ | ---------------------------------------------- | ----------------------------------------- |
| Camera (`expo-camera`)                     | Scanning product barcodes                      | Working                                    |
| Local notifications (`expo-notifications`) | Scheduled expiry reminders                     | On `feat/expiry-reminders`, not merged yet |
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
npm test          # 67 unit tests
npm run typecheck # TypeScript, strict mode
npm run lint
```

The tests cover the storage layer, the expiry date handling, the shelf-life estimates and the Open Food Facts response parsing.

## Project structure

```
app/                  Expo project
  src/app/            screens and routes
  src/components/     shared UI
  src/context/        inventory state and saving to the device
  src/utils/          expiry dates, shelf-life estimates, Open Food Facts lookup
  src/types/          the food item data model
  assets/             icons and splash images
```
