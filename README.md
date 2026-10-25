# Smart Food Expiry Tracker

**Group:** COMP5216-2026-GP-23 · **Release:** `v2.0`, the final submission (`v1.0` was the Phase 2 mid-progress release)

**SDG Goal 12: Responsible consumption and production**

An app that helps university students waste less food by taking the effort out of tracking groceries. Built with Expo SDK 58, React Native 0.88 and React 19.3. The app is currently supported on iOS; Android has not been tested.

You scan a product's barcode when you unpack your shopping, and the app fills in the product and estimates when it will go off. It reminds you before the food spoils and suggests recipes for whatever needs using up. For anything you can't finish in time, it points you to a nearby donation point, and a weekly summary shows what you ate, donated and threw away.

**New to the app?** The [user guide](userguide/README.md) shows how to use it, step by step, with screenshots.

**Contents:**

- [Key features](#key-features)
- [Getting started](#getting-started)
- [Fonts and icons](#fonts-and-icons)
- [Demo account and test data](#demo-account-and-test-data)
- [How the app is built](#how-the-app-is-built)
- [Data formats](#data-formats)
- [External services and configuration](#external-services-and-configuration)
- [Libraries used](#libraries-used)
- [Extending the app](#extending-the-app)
- [Tests and checks](#tests-and-checks)
- [Project structure](#project-structure)
- [Mobile technologies](#mobile-technologies)
- [Your data and security](#your-data-and-security)
- [Changes from our user testing](#changes-from-our-user-testing)
- [Known limitations and TODO](#known-limitations-and-todo)
- [Team](#team)

## Key features

| Feature                   | What it does                                                                                                                                                                                                                                                         | Status                                                               |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| **Barcode scanning**      | Scan a product and look up its name in Open Food Facts. The app provides a guessed expiry estimate that you can correct                                                                                                                                                | iOS; Android not tested                                               |
| **Manual entry**          | Add, edit and delete items by hand, for loose produce or anything without a barcode. The expiry date is picked from a calendar. Swipe a row left to edit or delete it straight from the list                                                                         | iOS; Android not tested                                               |
| **Expiry reminders**      | Choose 1 to 7 days' notice and get a second reminder on the expiry day, at 9 am. Reminders follow every edit, resolve and delete, and tapping one opens the item. The item's screen says which reminders are actually set                                            | iOS; Android not tested                                               |
| **Donation point finder** | Food banks, soup kitchens and community pantries within 10 km of you, or of any suburb you type, closest first. "Find donation point" on an item opens it, and "Mark as donated" counts the item in the summary                                                      | iOS; Android not tested                                               |
| **Weekly waste summary**  | Counts the food you marked eaten, donated or thrown out in each of the last three weeks (Monday to Sunday)                                                                                                                                                           | iOS; Android not tested                                               |
| **Recipe suggestions**    | Tick the food you want to cook with (food expiring within 3 days is ticked for you) and get simple recipes from an AI model you choose, using your own API key. Save the ones you like, ask for different ideas, and your last suggestions come back after a restart | iOS; Android not tested; Gemini, Matilda and DeepSeek tested          |

Also worth knowing:

- **Your inventory stays put.** Items are written to the phone's storage before the screen updates, and read back and checked when the app starts.
- **Nothing crashes when something goes wrong.** If the camera is blocked, the barcode isn't in the database, or there is no internet, you get the manual form with a message saying why.
- **You can tell two of the same product apart.** Each item's screen shows the day it was added.
- **Deleting asks first**, on the item's screen and from the list.

## Getting started

### What you need

- A computer with [Node.js](https://nodejs.org) 20 or newer (which includes npm), and [Git](https://git-scm.com) if you clone rather than download.
- An iPhone with **Expo Go** installed from the [App Store](https://apps.apple.com/app/expo-go/id982107779). It needs the Expo Go release for SDK 58.
- The phone and the computer on the same Wi-Fi network. For another network, see "If it doesn't connect" below.

### Step by step

1. **Get the code.** Either:
   - download the source zip from the `v2.0` release on the repository's **Releases** page, and unzip it; or
   - clone it:
     ```bash
     git clone git@github.sydney.edu.au:COMP5216-2026-S2/COMP5216-2026-GP-23.git
     ```
2. **Open the app folder.** Run the following commands from `app/`, not the repository root:
   ```bash
   cd COMP5216-2026-GP-23/app
   ```
3. **Install the dependencies** (a few minutes the first time):
   ```bash
   npm install
   ```
4. **Start the development server:**
   ```bash
   npm run start
   ```
   A QR code appears in the terminal. If the QR code does not appear, press `i` to open the iOS simulator.
5. **Open the app on your phone:**
   - Scan the QR code with the Camera app, then tap the banner to open it in Expo Go.
6. **Allow what it asks for.**
   - **Camera:** scanning barcodes.
   - **Notifications:** asked on your first saved item.
   - **Location:** asked when you open Donation Points.

   Saying no to any of them is fine: the app explains how to manage without it.

### If it doesn't connect

| Problem                                                         | Fix                                                                                                                                           |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| The phone is on a different network                             | `npx expo start --tunnel`                                                                                                                     |
| Old code keeps showing, or an error mentions a missing function | Stop the server and run `npx expo start -c`, which clears the bundler cache                                                                   |
| No phone to hand                                                | `npm run ios` (iOS simulator, on a Mac). The simulator has no camera to scan with, so add items by hand                                      |

The app's own launcher icon and splash screen only show in a development build (`npx expo run:ios`, which needs Xcode). Expo Go shows its own icon. The app itself can be run in Expo Go.

## Fonts and icons

The app already includes the Fredoka font, Expo's Ionicons, and Lucide icons. You do not need to install them again to run the app. When adding a different font or icon library, install its packages from `app/` and register/use them in the source:

### Adding a Google font

Install Expo's font loader and the font package. For example, to add Fredoka to a new project:

```bash
npx expo install expo-font @expo-google-fonts/fredoka
```

Import the font weights you need in `src/app/_layout.tsx`, add them to the `useFonts` map, and wait for the fonts to load before rendering screens. Then use the corresponding family name in a component's `fontFamily` style. Fredoka is already configured this way in this app.

For another Google font, replace `fredoka` with that font's package name and import the font weights exported by that package.

### Adding icons

- **Ionicons:** `@expo/vector-icons` is already installed. Import `Ionicons` from `@expo/vector-icons` and use an icon name from the Ionicons set.
- **Lucide:** this project uses `lucide-react-native` for outline icons. For a new project, install it and its native SVG peer dependency:
  ```bash
  npm install lucide-react-native
  npx expo install react-native-svg
  ```
  Import the required icon component from `lucide-react-native` and render it with `size` and `color` props. Expo may require a development build to use native modules not included in Expo Go.

After adding native dependencies, restart Expo. If Metro still reports a missing module, clear its cache with `npx expo start -c`.

## Demo account and test data

**There are no accounts and no login.** Everything is stored on the phone, so a fresh install starts with an empty inventory and you can try every feature straight away.

**A test API key is in our Canvas submission.** Recipe suggestions are the only feature that needs one; the key is for Gemini Flash. To enter it:

1. Open the **Recipes** tab and tap **Set up**.
2. Choose **Gemini Flash** and paste the key.
3. Tap **Save and check**.

The key is never stored in this repository.

**A quick tour of every feature:**

1. **Scan:** tap the round scan button in the middle of the tab bar and scan any packaged grocery. If Open Food Facts doesn't know it, the add form opens empty with a message saying so.
2. **Add by hand:** fill in a name and pick an expiry date one or two days away. The item appears under **Eat soon** on Home.
3. **Reminder:** an item that expires today, saved after 9 am, gets its reminder about a minute later. Tap the reminder to open the item.
4. **Resolve:** open an item and tap **Mark as eaten**, **Mark as thrown out** or **Mark as donated**. The **Summary** tab counts it under this week.
5. **Donate:** on an active item, tap **Find donation point**.
   - If you deny location, search a suburb with its state, e.g. "Newtown NSW".
   - Most listed places are in the state capitals.
6. **Recipes:** with the test key saved, tick some food on the **Recipes** tab and tap **Suggest recipes**. Star one to save it.

## How the app is built

The app is a single Expo project in `app/`, written in TypeScript (strict mode), with no backend server. Screens are React components. Logic that can be tested without a screen lives in `src/utils/`, and each file there has a test beside it.

### Screens and navigation

Navigation uses [Expo Router](https://docs.expo.dev/router/introduction/): every file in `src/app/` is a route.

| Route           | File                         | What it is                                                  |
| --------------- | ---------------------------- | ----------------------------------------------------------- |
| Home            | `(tabs)/index.tsx`           | The inventory, grouped into Expired, Eat soon and Later     |
| Summary         | `(tabs)/summary.tsx`         | The weekly waste summary                                    |
| Donation Points | `(tabs)/donation-points.tsx` | Nearby donation points                                      |
| Recipes         | `(tabs)/recipes.tsx`         | Ingredient checklist, suggestions and the saved recipes box |
| Scanner         | `scan.tsx`                   | The camera, opened by the centre button in the tab bar      |
| Add item        | `add.tsx`                    | The add form, pre-filled from a scan when there is one      |
| Item            | `item/[id].tsx`              | One item: details, reminders and its actions                |
| Edit item       | `item/edit/[id].tsx`         | The same form as Add, for an existing item                  |
| Recipe settings | `recipe-settings.tsx`        | Choose a model and manage API keys                          |
| Saved recipes   | `saved-recipes.tsx`          | Every starred recipe                                        |

- **Tabs:** `(tabs)/_layout.tsx` draws the custom tab bar.
- **Root layout:** `_layout.tsx` wraps the app in the inventory provider. It also opens the right item when a reminder is tapped, including when the tap starts the app.

### The inventory: `src/context/inventory-context.tsx`

One React context owns the food items. Screens read and change them only through `useInventory()`:

| Member                                        | Purpose                                                                                   |
| --------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `items`, `activeItems`                        | Every item, and those not yet eaten, thrown out or donated                                |
| `isLoading`, `isStorageReady`, `storageError` | Loading state. Nothing can be saved until the stored inventory has been read              |
| `addItem(input)`                              | Saves a new item and schedules its reminders                                              |
| `updateItem(id, input)`                       | Saves an edit. Reschedules only if the name, date or notice changed, or the item had none |
| `resolveItem(id, status)`                     | Marks it `eaten`, `discarded` or `donated` with the time, and cancels its reminders       |
| `deleteItem(id)`                              | Removes it and cancels its reminders                                                      |
| `reminderNotice`                              | A message when reminders could not be set, e.g. notifications are off                     |

Every change is written to storage first and only then shown. The stored list is checked item by item when it loads, so one bad entry can't lose the rest.

### How each feature works

- **Scanning.**
  1. `utils/open-food-facts.ts` looks the product up.
  2. `utils/shelf-life.ts` estimates how long it keeps.
  3. The add form opens pre-filled, with the estimate labelled as a guess.
- **Reminders.**
  - `services/expiry-notifications.ts` plans an advance reminder and an expiry-day reminder at 9 am, and schedules them locally. A time that has already passed becomes a reminder one minute from now.
  - It imports `expo-notifications` only through `services/local-notifications.ts`.
- **Expiry dates.** `utils/expiry-date.ts` reads and writes the stored `YYYY-MM-DD` dates, counts the days left in local calendar days, and produces the badges and labels. `utils/inventory-sections.ts` groups the Home list.
- **Weekly summary.** `utils/weekly-summary.ts` counts resolved items into Monday-to-Sunday weeks by `statusUpdatedAt`, and is correct in the week the clocks change. `hooks/use-today.ts` moves the tabs on to a new day when they come back into view.
- **Donation points.**
  - The places ship with the app in `src/data/donation-points-au.json`.
  - `utils/donation-snapshot.ts` reads that file and keeps the places within 10 km.
  - `utils/overpass.ts` turns the OpenStreetMap data into cards, with distances and readable opening hours.
  - The screen gets the phone's position with `expo-location`, or geocodes a typed suburb. It fills in missing addresses with the phone's reverse geocoder, one request at a time.
- **Recipes.**
  1. `utils/recipe-ingredients.ts` builds the checklist (eat-soon food ticked, at most 10).
  2. `utils/recipe-prompt.ts` writes the prompt and validates the reply. A recipe that uses food you didn't tick is dropped.
  3. `utils/recipe-client.ts` calls the provider: an OpenAI-style chat request in JSON mode, 30-second timeout. `utils/matilda.ts` adapts Matilda's own streaming API.
  - Results and saved recipes are kept by `utils/recipe-storage.ts`. Keys are kept by `utils/recipe-credentials.ts`.

## Data formats

Everything is stored on the phone. There is no database server.

### AsyncStorage (plain JSON)

| Key                                            | Contents                                                                                                                                          |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@smart-food-expiry-tracker/inventory-v1`      | The whole inventory, as an array of food items (below)                                                                                            |
| `@smart-food-expiry-tracker/recipes-screen-v1` | The Recipes tab's ticks and last suggestions: `{ selectedIds: string[], lastResult: { recipes: SuggestedRecipe[], forNames: string[] } \| null }` |
| `@smart-food-expiry-tracker/recipes-saved-v1`  | Saved recipes: `{ id, savedAt, recipe }[]`                                                                                                        |

A food item, as stored (`src/types/food-item.ts`):

```json
{
  "id": "1792310400000-k3x9q2ab",
  "name": "Greek yoghurt",
  "quantity": "1 tub",
  "expiryDate": "2026-10-24",
  "reminderDaysBefore": 2,
  "reminderRuleVersion": 2,
  "notes": "Opened on Monday",
  "createdAt": "2026-10-18T09:12:00.000Z",
  "status": "active",
  "barcode": "9300633600000",
  "notificationIds": ["advance-id", "expiry-day-id"]
}
```

| Field                 | Meaning                                                                                                               |
| --------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `status`              | `active`, `eaten`, `discarded` or `donated`                                                                           |
| `statusUpdatedAt`     | Set when an item is resolved; the summary counts by it                                                                |
| `barcode`             | Only on scanned items                                                                                                 |
| `notificationIds`     | The scheduled reminders, absent when none are set                                                                     |
| `reminderRuleVersion` | 1 marks an item saved by `v1.0`, whose reminders are scheduled at the next launch                                     |

A recipe is `{ title, minutes, usesIngredients: string[], extraIngredients: string[], steps: string[] }`.

### SecureStore (the iPhone's Keychain)

| Key                     | Contents                                                      |
| ----------------------- | ------------------------------------------------------------- |
| `recipe.provider`       | The chosen model: `gemini`, `matilda`, `openai` or `deepseek` |
| `recipe.key.<provider>` | That provider's API key, e.g. `recipe.key.gemini`             |

### The bundled donation points

`src/data/donation-points-au.json` holds the OpenStreetMap elements, cut down to the tags a card uses:

```json
{
  "fetchedAt": "2026-10-16T13:12:44.696Z",
  "elements": [
    {
      "type": "node",
      "id": 441159092,
      "lat": -32.9009205,
      "lon": 151.6691067,
      "tags": {
        "name": "Food 4 Life",
        "amenity": "social_facility",
        "social_facility": "food_bank"
      }
    }
  ]
}
```

### Reminders

Each reminder is a local notification. Its data is `{ itemId, reminderKind: "advance" | "expiry-day" }`, which the root layout uses to open the item.

## External services and configuration

There is no backend, no Firebase and nothing to set up on a server. The only configuration is an optional API key for recipes, entered in the app.

| Service                                                             | Used for                                    | How                                                                                                                                                                                          | Key                                                                         |
| ------------------------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| [Open Food Facts](https://world.openfoodfacts.org/data)             | Product details from a barcode               | `GET https://world.openfoodfacts.org/api/v2/product/<barcode>.json`, with an app User-Agent and an 8-second timeout                                                                       | None                                                                        |
| [OpenStreetMap](https://www.openstreetmap.org) via the Overpass API | The bundled list of donation points         | **Only the developer script below** calls it; the app never does                                                                                                                             | None                                                                        |
| Google Gemini (`gemini-3.8-flash`)                                  | Recipe suggestions (free tier, the default) | `POST https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`, JSON mode                                                                                                   | The user's, from [Google AI Studio](https://aistudio.google.com/app/apikey) |
| Maincode Matilda                                                    | Recipe suggestions (free, early access)     | `POST https://matilda.maincode.com/api/chat`, a server-sent event stream                                                                                                                     | The user's, from the [Maincode dashboard](https://maincode.com/dashboard)   |
| OpenAI (`gpt-5.4-mini`)                                             | Recipe suggestions (needs prepaid credit)   | `POST https://api.openai.com/v1/chat/completions`, JSON mode                                                                                                                                 | The user's, from [OpenAI](https://platform.openai.com/api-keys)             |
| DeepSeek (`deepseek-flash`)                                         | Recipe suggestions (needs a balance)        | `POST https://api.deepseek.com/chat/completions`, JSON mode                                                                                                                                  | The user's, from [DeepSeek](https://platform.deepseek.com/api_keys)         |

**Recipe keys:**

- A key is checked with the provider before it is saved (`GET /models`, or a one-line chat for Matilda).
- It is kept in SecureStore and sent only to that provider.
- Only the names and dates of the ticked food are sent, and only when **Suggest recipes** is tapped.
- Never put a key in the code or a `.env` file. An `EXPO_PUBLIC_` variable is built into the app, where anyone could read it.

**App configuration (`app/app.json`):**

- the camera and location permission texts;
- the config plugins (`expo-router`, `expo-notifications`, `expo-camera`, `expo-location`, `expo-secure-store`, the date picker and the splash screen);
- the icons;
- React Compiler is turned on.

### Refreshing the donation points

The list was taken on 16 Oct 2026: 37 places, © OpenStreetMap contributors under the [ODbL](https://opendatacommons.org/licenses/odbl/). It covers every food bank, soup kitchen and community pantry OpenStreetMap lists in Australia, without:

- shelters, which don't take food from the public;
- Meals on Wheels, which delivers meals rather than taking food in.

To refresh it, run this from `app/` with **Node.js 22.18 or newer** (it runs the TypeScript script directly), then commit the new `src/data/donation-points-au.json`:

```bash
npm run snapshot:donation-points
```

The script is `scripts/update-donation-snapshot.ts`, and it uses `src/utils/overpass-download.ts`.

- If every server is busy, wait a couple of minutes and try again.
- It keeps the current file when a download fails, comes back empty, or has fewer than half the current number of places.

## Libraries used

| Library                                                                                     | Used for                                                  |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `expo` (SDK 58), `react-native` 0.88, `react` 19.3                                          | The app framework                                         |
| `expo-router`                                                                               | File-based navigation and the tab bar                     |
| `expo-camera`                                                                               | Barcode scanning                                          |
| `expo-notifications`                                                                        | Local expiry reminders                                    |
| `expo-location`                                                                             | The phone's position, and geocoding suburbs and addresses |
| `expo-secure-store`                                                                         | Recipe API keys                                           |
| `@react-native-async-storage/async-storage`                                                 | The inventory and recipes                                 |
| `@react-native-community/datetimepicker`                                                    | The expiry date calendar                                  |
| `react-native-gesture-handler`, `react-native-reanimated`, `react-native-worklets`          | Swipe actions on inventory rows                           |
| `react-native-safe-area-context`, `react-native-screens`                                    | Safe areas and native screens                             |
| `@expo/vector-icons`                                                                        | Ionicons                                                  |
| `lucide-react-native`, `react-native-svg`                                                   | Lucide outline icons and their SVG rendering              |
| `@expo-google-fonts/fredoka`, `expo-font`                                                   | Fredoka font files and font loading                       |
| `expo-splash-screen`, `expo-status-bar`, `expo-system-ui`, `expo-constants`, `expo-linking` | Standard Expo app plumbing                                |
| `react-native-web`, `react-dom`                                                             | The best-effort web build                                 |
| Dev: `jest`, `jest-expo`, `@testing-library/react-native`                                   | Unit and screen tests                                     |
| Dev: `typescript`, `eslint` (`eslint-config-expo`), `prettier`                              | Type checking, linting and formatting                     |

## Extending the app

- **Add an AI model.**
  - Add an entry to `RECIPE_PROVIDERS` in `src/utils/recipe-providers.ts`, with its id, label, model, `baseUrl`, key link and any request options, and add the id to `RecipeProviderId`.
  - An OpenAI-compatible provider with JSON mode needs nothing else. Others need an adapter like `matilda.ts`.
- **Improve shelf-life estimates.** Add a rule to `SHELF_LIFE_RULES` in `src/utils/shelf-life.ts`, with a test.
- **Add a font or icon set.** Follow [Fonts and icons](#fonts-and-icons); use `npx expo install` for Expo/native packages and keep font registration in the root layout.
- **Add a tab.** Add a file to `src/app/(tabs)/`, and add it to `TABS` in `(tabs)/_layout.tsx`.
- **Change what an item stores.**
  - Update `FoodItem` in `src/types/food-item.ts` and `normalizeFoodItem` in the inventory context, which validates stored items.
  - Keep accepting the old shape, or the next launch will drop items saved before the change.
- **Anything that depends on today's date on a tab:** use `useToday()` rather than `new Date()` during rendering. Tabs stay mounted, and React Compiler would keep yesterday's date.
- **Conventions:**
  - logic goes in `src/utils/` with tests before any screen uses it;
  - comments explain why, not what;
  - all four checks below must pass before a commit.

## Tests and checks

Run these checks from `app/`:

```bash
npm test             # Unit and screen tests
npm run typecheck    # TypeScript, strict mode
npm run lint         # ESLint (Expo config)
npm run format:check # Prettier
```

The tests cover:

- the storage layer, expiry dates and the date picker on the add and edit form;
- the reminder scheduling rules and the shelf-life estimates;
- the Open Food Facts response parsing;
- the OpenStreetMap snapshot: its download, the server fallback, the kinds of place, the opening hours and the distance filter;
- the recipe prompt and the checks on every AI reply;
- each AI provider's replies and errors, and key storage;
- the Home, Recipes, recipe settings, saved recipes, item, weekly summary and donation points screens;
- the tabs moving on to a new day after midnight;
- the weekly summary's counts and week boundaries, including the week the clocks change.

None of the tests need an API key or an internet connection.

## Project structure

```
userguide/            the user guide, with its screenshots in userguide/images/
app/                  Expo project (run every command from here)
  src/app/            screens and routes
  src/components/     shared UI: the item form, inventory row, recipe cards
  src/context/        the inventory: state, saving and reminders
  src/hooks/          useToday, which moves the tabs on to a new day
  src/services/       local expiry reminder scheduling
  src/utils/          expiry dates, shelf-life estimates, Open Food Facts lookup,
                      OpenStreetMap donation points, recipe prompts, AI providers,
                      saved recipes
  src/data/           the bundled list of donation points
  src/types/          the food item data model
  src/__tests__/      screen tests (kept out of src/app/, where every file becomes a route)
  scripts/            npm run snapshot:donation-points, which regenerates that list
  assets/             the app icon and splash image (icon.svg is the icon's source)
  app.json            Expo configuration: permissions, plugins, icons
```

## Mobile technologies

| Technology                                 | Used for                                       | Status                        |
| ------------------------------------------ | ---------------------------------------------- | ----------------------------- |
| Camera (`expo-camera`)                     | Scanning product barcodes                      | iOS; Android not tested       |
| Local notifications (`expo-notifications`) | Scheduled expiry reminders                     | iOS; Android not tested       |
| GPS / geolocation (`expo-location`)        | Finding donation points near you               | iOS; Android not tested       |
| Mobile data networks                       | Open Food Facts lookups and recipe suggestions | iOS; Android not tested       |

## Your data and security

- **Inventory:** everything you track stays on your phone. There are no accounts and no server of ours.
- **Leaves the phone:**
  - a scanned barcode goes to Open Food Facts;
  - the food you tick for recipes goes to the AI provider you chose.
- **Location:** used only on the phone to sort the bundled list of donation points.
- **API keys:**
  - kept in the phone's secure storage and only ever shown masked;
  - no key is built into the app or stored in this repository;
  - `.env*` files are git-ignored as a safety net.

## Changes from our user testing

We ran a Think Aloud study with four students on our paper prototype in Phase 2. These are the changes we made because of it:

| What we heard                                                | What we changed                                               |
| ------------------------------------------------------------ | ------------------------------------------------------------- |
| Picking an exact reminder date is awkward (P1)               | You choose how many days before expiry to be reminded, 1 to 7 |
| It was hard to find where to set the reminder (P3)           | The reminder setting is on the add form itself                |
| Two tubs of the same yoghurt are hard to tell apart (P2, P4) | Each item's screen shows the day it was added                 |
| A mistakenly added item should be easy to delete (P4)        | Swipe a row left to delete it, with a confirmation            |

Two suggestions were not adopted:

- **A photo of each item (P4).** Photos of two identical products look the same, and the added date answers the same question.
- **A dietary option (P3).** It is outside our SDG 12 goal.

## Known limitations and TODO

- **Recipes are untested with OpenAI**, which needs prepaid credit before it answers. Gemini, Matilda and DeepSeek were tested on both platforms.
- **Not yet done:** a full accessibility pass (screen reader labels and large text on every screen), and a check that every screen has a clear empty, loading and error state.
- **Platform support:** The app is currently supported on iOS only. Android and web have not been tested.
- **Your data stays on one phone.** With no accounts, it doesn't follow you to another device.
- **Donation points are sparse:** OpenStreetMap lists few places outside the state capitals, and the list is only as fresh as its last refresh. The screen shows its date.
- **Shelf life is a guess.** Always check the date on the packet.
- **The AI providers all behave differently.** Gemini's free model is often briefly overloaded, OpenAI answers nothing without prepaid credit, and Matilda has its own API. The app shows each case as its own message.

## Team

<!-- prettier-ignore -->
| Member | Main areas |
| --- | --- |
| Hanchen Wang | Barcode scanning, recipe suggestions (first half), donation point data, donated food, the Think Aloud changes |
| Jingwei Lin | Expiry reminders, recipe suggestions (second half, Gemini and Matilda), weekly summary fixes |
| Angel Huang | Donation point finder, navigation bar |
| Yuna Chuang | Weekly waste summary |
