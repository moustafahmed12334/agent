# HelperHub — Chrome Extension

Break reminders with a live countdown, plus quick local access to your work
tool logins. Everything is stored locally in your browser — no server, no
cloud, no account.

## Install (Developer mode)

1. Unzip this folder somewhere permanent (don't delete it after installing —
   Chrome loads the extension directly from these files).
2. Open Chrome and go to `chrome://extensions`.
3. Turn on **Developer mode** (top-right toggle).
4. Click **Load unpacked**.
5. Select this folder (the one containing `manifest.json`).
6. HelperHub's icon (a purple "H") will appear in your toolbar.

## First use

1. Click the icon, go to the **Breaks** tab, and tap **+ Add break**. Enter
   a name, a start time, and pick a duration (15 or 30 minutes) — the end
   time is calculated for you. They repeat automatically every day — you
   never need to re-enter them. A **Reset all breaks** button sits right
   under the breaks list if you ever want to clear them all at once.
2. Tap the gear icon (top-right) to open **Settings**: darker theme, test
   mode, and the dhikr/istighfar reminder — all as simple on/off switches,
   the same style as the dark-mode toggle.
3. If you actually leave for a break before or after its scheduled time,
   tap **Start this break now** on the Next Break card. It shifts that
   break to start right at that moment for today only (same duration,
   e.g. 15 min stays 15 min) — the original 5/2/0-minute alerts for it are
   silently skipped since you're already on it. Tomorrow it's back to its
   normal scheduled time automatically.
4. Settings also has a **Language** switch (English/Arabic) that translates
   the whole interface, including the right-to-left layout for Arabic.
5. A new **IVR** tab (between Breaks and Tools) holds the transfer-code
   list with one-tap copy.
6. A fourth tab, **Quick Ref**, holds two side-by-side reference cards:
   **TTS** (a list of sub-sections — Iu, mcu, cc-follow up — each opening
   its own popup with details) and **Concession** (a warning reminder to
   check the customer hasn't already been compensated, then reference
   cards — including a nested "WE Mobile Line Adjustment" group). The
   extension remembers whichever tab you had open last time, and reopens
   on that one.
7. A small WhatsApp icon sits next to the credit line at the bottom —
   hover to see the number, tap to open a chat.
8. A small purple circle labeled **"Quick"** sits fixed in the bottom-right
   corner of every page you browse, with a gentle breathing glow. It never
   moves — tap it and three small circles (TTS, Prices, IVR) pop out
   around it. Tap one to open its details in a small panel near the
   circle; IVR already shows the real transfer-code list with one-tap
   copy (which closes everything afterward); TTS and Prices are
   placeholders for now. Tapping anywhere else on the page, or the circle
   itself again, closes it — the circle itself never disappears, only
   what's open around it does. It can be turned off entirely from
   Settings (gear icon) → "Floating 'Quick' button on pages".
3. Turn on **Test mode** (in Settings) to make a break's alert fire
   immediately at its start time, so you can confirm notifications work.
   Turn it back off for normal 5/2/0-minutes-before alerts.
4. Go to the **Tools** tab and tap **+ Add tool** to save a username/password
   for any work tool you use often. Use the copy icons to paste them
   straight into that tool.

## What fires, and when

- **Chrome notification** at 5, 2, and 0 minutes before a break starts (or a
  single alert at the exact start time while Test mode is on).
- **In-page banner** appears at the top of whatever site you're currently
  on, at the same moments, with a Dynamic-Island-style animation: it opens
  from a small pill into the full message, holds, then contracts back into
  a pill before disappearing (~6 seconds total). Tap the × to dismiss early.
- **Toolbar badge**: shows minutes remaining to the next break; in the
  final ~60 seconds it switches to a live seconds countdown and turns red.
- **Dhikr & istighfar reminder**: every 2 minutes, the same island-style
  banner (not a Chrome notification) appears on whatever tab you're on,
  cycling through a short list of remembrance phrases. Can be turned off
  entirely from Settings (gear icon).

## A couple of honest limitations

- Chrome's extension APIs don't allow turning off Windows' own notifications
  or other extensions' notifications — no extension can do that. This is
  why HelperHub leans on its own in-page banner and toolbar badge instead,
  which work regardless of your Windows notification settings.
- Background badge updates are accurate to the minute at all times; the
  live-seconds/red state in the last minute is a best-effort burst that
  runs while the browser keeps the extension's background worker awake
  (standard Chrome behavior — this is not something an extension can force).
  The **popup itself** always shows a fully live, per-second countdown
  whenever it's open.
- Chrome must be running for any of this to fire. There's no way around
  that — it's a notification from a browser extension, not a system-level
  app.

## Data & privacy

- All breaks and tool credentials are stored with `chrome.storage.local`,
  scoped to your browser profile on this device only.
- Nothing is sent anywhere. There is no backend, no analytics, no account.
- Uninstalling the extension deletes this data (Chrome's normal behavior
  for local extension storage).

## Files

- `manifest.json` — extension configuration (Manifest V3)
- `popup.html` — the popup UI, with its CSS inlined in the file
- `popup.js` — all popup logic (breaks, tools, modals, live countdown)
- `background.js` — alarms, badge updates, notification/banner firing
  (the in-page banners are injected directly from here — no separate
  content-script file is needed)
- `icons/` — toolbar icons
