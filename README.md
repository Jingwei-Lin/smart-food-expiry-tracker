# Smart Food Expiry Tracker

**Group:**  COMP5216-2026-GP-23


**SDG Goal 12: Responsible consumption and production**

An app that helps university students waste less food by taking the effort out of tracking groceries. We built it with Expo SDK 57.

The idea is that you scan a product's barcode when you unpack your shopping, and the app fills in the product and works out when it will go off. It reminds you before the food spoils and suggests recipes for whatever needs using up. For anything you can't finish in time, it points you to a nearby donation point, and a waste summary shows what you ate against what you threw away.

## Key Features

Our Phase 2 mid-progress submission is tagged `v1.0`, and not everything we proposed is finished yet. The table below is what `main` does now. "Partly working" means you can open the screen and use it, but part of it is not finished or is not reading real data yet.

| Feature | Status | What that means right now |
| --- | --- | --- |
| **Barcode scanning** | Working | Scan a product barcode, the app looks it up in Open Food Facts and fills in the name and a guessed expiry date, which you can correct |
| **Manual entry** | Working | Add, edit and delete items by hand, for loose produce or anything without a barcode |
| **Waste summary** | Working | Counts the food you marked eaten, donated or thrown out in each of the last three weeks (Monday to Sunday) |
| **Donation point finder** | Working, needs a device test | Food banks, soup kitchens and community pantries from OpenStreetMap within 10 km of you, or of any suburb you type (with its state, e.g. "Newtown NSW"), in one list with the closest first. The list for all of Australia ships with the app, so it opens instantly and works offline. "Find donation point" on an item opens it, and "Mark as donated" counts the item in the waste summary. Added after `v1.0` |
| **Expiry reminders** | Working | Choose 1 to 7 days' notice (1 by default) and get a second reminder on the expiry day. Reminders are rescheduled or cancelled when you edit, resolve or delete an item, and tapping one opens that item. Added after `v1.0` |
| **Recipe suggestions** | Working, needs a full device test on iOS | Tick the food you want to cook with (food expiring within 3 days is ticked for you) and get simple recipes from an AI model you choose, using your own API key. Star a recipe to keep it in Saved recipes, ask for different ideas, and your last suggestions come back after a restart. "Find recipes" on an item opens the tab with that item ticked. Added after `v1.0` |


- **The inventory saves properly.** Items are written to storage on the device before the screen updates, then read back and checked when the app starts. They are still there after you close the app.
- **The expiry date field is built for a phone.** It uses a number keypad and puts the dashes in as you type, because the phone keypad has no dash key.
- **You can mark an item eaten, donated or thrown out.** This saves the date as well, which the waste summary counts by.
- **Nothing crashes when something goes wrong.** If the camera is blocked, the barcode isn't in the database, or there is no internet, you get the manual form with a message saying why.

## TODO for Phase 3

- Test expiry notifications on real Android and iOS devices
- Test recipe suggestions with each AI model on real Android and iOS devices
- Empty, loading and error states on every screen, plus an accessibility pass

## Current Challenges

- Open Food Facts does not actually store shelf life. Its `expiration_date` field is whatever was printed on the packet a contributor photographed, so it is usually already in the past and we could not use it. We estimate shelf life from the product's category tags instead, and always show it as a guess for the user to correct.
- `expo-notifications` starts registering for push tokens as soon as you import it, which crashes Expo Go on Android in SDK 57 even though we only want local notifications. We got around it by importing the local-only parts of the library directly.
- Notifications depend on the phone's permission and battery settings, so we can unit test the timing rules but we can't prove delivery without a real device.
- Everything is stored on the phone, so there are no accounts and your data does not follow you to another device. We decided this was an acceptable trade-off to keep the project in scope.
- With no backend, there is nowhere to hide an API key: any key built into the app could be pulled out of it. So each person brings their own key, which the app keeps in the phone's secure storage and sends only to the provider they chose. The catch is that anyone trying the recipes, including markers, needs a key, so we offer free options.
- Asking OpenStreetMap for donation points live was too slow to use. Its free public servers queued our request for 27 to 40 seconds, and the backup server returned errors. Since OpenStreetMap only lists a few dozen food banks, soup kitchens and community pantries in Australia, we bundle that list with the app instead and find the nearby ones on the phone. The catch is that the list is only as fresh as the last time we regenerated it, so the screen shows its date. It also lists few places outside the state capitals.
- The AI providers behave differently even through the same OpenAI-style API. Gemini answers a bad key with 400 instead of 401, and its free model is often briefly overloaded (503). OpenAI needs prepaid credit before it answers at all. Matilda has its own streaming API, so it needed a small adapter. The app turns each of these into its own clear message instead of a generic "couldn't connect".

## Mobile technologies

| Technology                                 | Used for                                       | Status                                     |
| ------------------------------------------ | ---------------------------------------------- | ------------------------------------------ |
| Camera (`expo-camera`)                     | Scanning product barcodes                      | Working                                    |
| Local notifications (`expo-notifications`) | Scheduled expiry reminders                     | Working, needs a real-device test pass     |
| GPS / geolocation (`expo-location`)        | Locating nearby food donation points           | Working, needs a real-device test pass     |
| Mobile data networks                       | Open Food Facts lookups and recipe suggestions | Working                                    |

The notifications are scheduled locally on the phone. We don't use a push server or an Expo push token.

## Recipe suggestions and API keys

Recipes come from an AI model you choose, using your own API key. Only the names and dates of the food you tick are sent, and a request is only made when you tap **Suggest recipes**.

| Model          | Company  | Cost                                                                          | Get a key                                        |
| -------------- | -------- | ----------------------------------------------------------------------------- | ------------------------------------------------ |
| Gemini Flash   | Google   | Free tier (the default). Google may use free-tier requests to improve its products | [Google AI Studio](https://aistudio.google.com/app/apikey) |
| Matilda        | Maincode | Early access. Maincode says it does not train its models on your prompts     | [Maincode dashboard](https://maincode.com/dashboard) |
| GPT-5.4 mini   | OpenAI   | Needs prepaid credit on your OpenAI account                                  | [OpenAI API keys](https://platform.openai.com/api-keys) |
| DeepSeek Flash | DeepSeek | Needs a balance on your DeepSeek account                                     | [DeepSeek API keys](https://platform.deepseek.com/api_keys) |

To set one up, open the **Recipes** tab, tap **Set up**, choose a model, paste your key and tap **Save and check**. The key is checked with the provider before it is saved, kept in the phone's secure storage, and only ever shown masked. You can save a key for more than one model and switch between them in recipe settings.

Anyone trying the app, including markers, needs their own key: Gemini's is free. At the demo we enter the group's key live. Never put a key in the code or a `.env` file.

## Donation points

The places come from [OpenStreetMap](https://www.openstreetmap.org): every food bank, soup kitchen and community pantry or fridge it lists in Australia, 37 places as of 17 Oct 2026, © OpenStreetMap contributors under the [ODbL](https://opendatacommons.org/licenses/odbl/). We leave out shelters, which don't take food from the public, and Meals on Wheels, which OpenStreetMap often tags as a food bank but which delivers meals rather than taking food in. Opening hours are shown as OpenStreetMap lists them, with the days spelled out.

The list ships with the app, so nothing is downloaded when you open the tab and your location never leaves your phone. To refresh it, run this from `app/` and commit the new `src/data/donation-points-au.json`:

```bash
npm run snapshot:donation-points
```

The script needs Node.js 22.18 or newer, which runs TypeScript directly; older versions stop with `ERR_UNKNOWN_FILE_EXTENSION`. The public servers limit how often one computer can ask, so if it says every server is busy, wait a couple of minutes and run it again. A failed run leaves the current list alone, and so does a download with no places or fewer than half the current number, which usually means the server's data was out of date.

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

All four pass on `main`. Run them from the `app/` folder.

```bash
npm test             # 387 unit tests
npm run typecheck    # TypeScript, strict mode
npm run lint
npm run format:check # Prettier
```

The tests cover:

- the storage layer and the expiry date handling;
- the reminder scheduling rules and the shelf-life estimates;
- the Open Food Facts response parsing;
- the OpenStreetMap snapshot: its download, the server fallback, the kinds of place, the opening hours and the distance filter;
- the recipe prompt and the checks on every AI reply;
- each AI provider's replies and errors, and key storage;
- the Recipes, recipe settings, saved recipes, item, weekly summary and donation points screens;
- the weekly summary's counts and week boundaries, including the week the clocks change.

None of the tests need an API key or an internet connection.

## Project structure

```
app/                  Expo project
  src/app/            screens and routes
  src/components/     shared UI
  src/context/        inventory state and saving to the device
  src/services/       local expiry reminder scheduling
  src/utils/          expiry dates, shelf-life estimates, Open Food Facts lookup,
                      OpenStreetMap donation points, recipe prompts, AI providers,
                      saved recipes
  src/data/           the bundled list of donation points
  src/types/          the food item data model
  src/__tests__/      screen tests (kept out of src/app/, where every file becomes a route)
  scripts/            npm run snapshot:donation-points, which regenerates that list
  assets/             icons and splash images
```
