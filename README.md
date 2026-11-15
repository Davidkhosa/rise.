# Rise

A personal life planner: daily blocks, goals, habits to break, finance, fitness, learning, business, reminders and progress. Built with React and Vite. Installable on Android and iPhone as a PWA.

## Run it on your computer

You need Node.js 20 or newer.

```
npm install
npm run dev
```

Open the address it prints (usually http://localhost:5173). To try it on your phone, connect the phone to the same Wi-Fi and open the "Network" address.

## Build

```
npm run build
npm run preview
```

The finished site is written to `dist/`. Install-to-home-screen and offline mode only work in the built version, not in `npm run dev`.

## Put it online free with Vercel

1. Create a free account at vercel.com and at github.com.
2. Put this folder in a new GitHub repository.
3. In Vercel choose "Add New Project", pick the repository and press Deploy. The settings in `vercel.json` are picked up automatically (framework Vite, output `dist`).
4. Vercel gives you an https address. Share that address with your users.

Without GitHub: run `npx vercel` inside this folder and follow the questions, then `npx vercel --prod`.

## Install on a phone

- Android (Chrome): open the address, tap the menu, then "Install app" or "Add to Home screen".
- iPhone (Safari): open the address, tap Share, then "Add to Home Screen".

## Where the data lives

Everything a user enters, including proof photos, is saved on their own device (IndexedDB). Nothing is sent to a server, and there are no accounts. Clearing the browser's site data or uninstalling the app deletes it, and data does not move between devices.

## Reminders

Reminders appear inside the app with a sound. After the user taps "Turn on phone alerts", they also appear as phone notifications while Rise is open or running in the background. On iPhone this needs iOS 16.4 or newer and the app added to the Home Screen. Reminders cannot be delivered when the app is fully closed; that needs a push server, which this project does not include.

## AI coach (optional)

"Review my week" works out of the box with a review calculated on the device. To get AI-written reviews:

1. Get an API key from console.anthropic.com (paid, billed per use).
2. In Vercel open Project, Settings, Environment Variables and add `ANTHROPIC_API_KEY`.
3. Optional: add `COACH_MODEL` to choose the model. The default is in `api/coach.js`.
4. Redeploy.

The key stays on the server in `api/coach.js`. Anyone who can open your site can use the coach, so set a spending limit on the key.

## Files

```
index.html            page shell, PWA and iPhone tags
vite.config.js        Vite setup
vercel.json           Vercel build and caching settings
api/coach.js          optional AI coach (Vercel serverless function)
public/manifest.json  app name, colours and icons for installing
public/sw.js          offline support and notification taps
public/icons/         app icons
src/main.jsx          starts the app, loads the font, registers the service worker
src/App.jsx           the whole app
src/storage.js        on-device storage
src/index.css         all styles
```

To change the app after it is live, edit, deploy again, and raise `VERSION` in `public/sw.js` so installed copies refresh their saved files.
