# Skipark

Skipark is a web app built with React, Vite, Firebase, and Cloud Functions. It combines a personal ski park, Strava-backed activity syncing, weather lookups, and an AI-assisted "Ask Bjorn" flow, that aids the user in keeping track of their ski park.

## Current Scope

The app currently includes:

- Google sign-in with Firebase Authentication
- Personal ski park storage in Firestore
- Strava OAuth and Nordic activity sync through Firebase Functions
- Weather lookups via backend integrations
- "Ask Bjorn" backend logic powered by Gemini

Routes currently wired in the frontend:

- `/` home
- `/sign-in`
- `/ask-bjorn`
- `/park`
- `/statistics`
- `/ski-tests`
- `/profile`
- `/strava/callback`

## Tech Stack

- React 19
- TypeScript
- Vite
- Firebase Authentication
- Cloud Firestore
- Firebase Hosting
- Firebase Functions v2

## Project Structure

```text
.
├── src/                 Frontend app
├── functions/           Firebase Cloud Functions
├── firebase.json        Firebase hosting, functions, firestore, emulators
├── .firebaserc          Default Firebase project mapping
└── package.json         Frontend scripts
```

## Requirements

- Node.js 22 for `functions/`
- npm
- Firebase CLI

## Local Development

Install dependencies:

```bash
npm install
cd functions && npm install
```

Start the frontend dev server:

```bash
npm run dev
```

Useful emulator commands from the repo root:

```bash
npm run emulators
npm run emulators:hosting
npm run emulators:strava
npm run emulators:strava:isolated
```

## Environment Variables

Frontend local env files such as `.env.local` and `.env.development.local` are ignored by Git.

Backend local secrets should live in `functions/.env.local`. An example file already exists at [functions/.env.example](/Users/henrikaas/Library/CloudStorage/OneDrive-NTNU/Dokumenter/Orientering/Skipark/functions/.env.example).

Expected backend variables:

```env
STRAVA_CLIENT_ID=
STRAVA_CLIENT_SECRET=
STRAVA_REDIRECT_URI=
STRAVA_STATE_SECRET=
FRONTEND_URL=http://localhost:5173
STRAVA_SCOPE=read,activity:read_all
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
```

Optional frontend variables used by the app:

```env
VITE_STRAVA_API_BASE=/api/strava
VITE_USE_FIRESTORE_EMULATOR=true
```

## Security Notes

- Do not commit `.env.local`, `.env.development.local`, or `functions/.env.local`
- Do not hardcode backend secrets into source files
- The Firebase web config in `src/firebase.ts` is client config, not a server secret

## Scripts

Frontend scripts from [package.json](/Users/henrikaas/Library/CloudStorage/OneDrive-NTNU/Dokumenter/Orientering/Skipark/package.json):

```bash
npm run dev
npm run build
npm run lint
npm run preview
```

Functions script from [functions/package.json](/Users/henrikaas/Library/CloudStorage/OneDrive-NTNU/Dokumenter/Orientering/Skipark/functions/package.json):

```bash
cd functions
npm run serve
npm run deploy
```

## Firebase

This repo is configured for the Firebase project `skipark-5f8bf` in [.firebaserc](/Users/henrikaas/Library/CloudStorage/OneDrive-NTNU/Dokumenter/Orientering/Skipark/.firebaserc).

`firebase.json` currently defines:

- Functions source in `functions/`
- Firestore rules
- Hosting from `dist/`
- Rewrites for `/api/strava/**` to the `stravaApi` function

## Push Checklist

Before pushing the repo:

- Confirm no local env files are staged
- Confirm `node_modules/` and `dist/` are not staged
- Review `git status --short`
- Make the first commit and add the GitHub remote

## Status

This is an active project. Some routes are implemented as placeholders, but the core app structure, auth setup, Firebase wiring, and backend integrations are already in place.
