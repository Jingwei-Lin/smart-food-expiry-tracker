# Smart Food Expiry Tracker

Phase 2 Google Doc
https://docs.google.com/document/d/1S_IpMp2xptf4Oh0YMWcR6BJcfedkQhdb/edit


**Goal 12: Responsible consumption and production**

This is a mobile app that helps university students waste less food by taking the effort out of tracking groceries, built with Expo SDK 57.

- Scan a product's barcode when you unpack your shopping, and the app fills in the product and works out when it will go off. 

- It reminds you before food spoils and suggests recipes for whatever needs using up.

- For anything you can't finish in time, it points you to a nearby donation point. A weekly summary shows what you ate against what you threw away.


## Features

- **Barcode scanning**: add a grocery item by scanning it, with the product name and typical shelf life looked up automatically from Open Food Facts
- **Expiry reminders**: a notification before each item is likely to spoil
- **Manual entry**: for loose produce, anything without a barcode, and correcting a suggested date
- **Recipe suggestions**: simple meal ideas built around the ingredients closest to expiring
- **Donation point finder**: the nearest food donation drop-offs, ordered by distance
- **Weekly summary**: what was eaten, donated and discarded, week by week

## Mobile technologies

| Technology                                | Used for                                       |
| ----------------------------------------- | ---------------------------------------------- |
| Camera (`expo-camera`)                    | Scanning product barcodes                      |
| Push notifications (`expo-notifications`) | Locally scheduled expiry reminders             |
| GPS / geolocation (`expo-location`)       | Locating nearby food donation points           |
| Mobile data networks                      | Open Food Facts lookups and recipe suggestions |

## Getting started

Install Node.js 20 or newer, then run the commands below.

```bash
git clone git@github.sydney.edu.au:COMP5216-2026-S2/COMP5216-2026-GP-23.git
cd COMP5216-2026-GP-23/app
npm install
npm run start
```

## Project structure

```
app/                  Expo project
  src/app/            screens and navigation
  src/components/     shared UI
  assets/             icons and splash images
```