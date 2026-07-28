# Project reminders / notifications (temporarily disabled)

Progression’s reminder system uses **local scheduled notifications** via
`expo-notifications` (not remote APNs push server-side). Apple still requires a
**paid Apple Developer Program** membership to ship apps that use the Push
Notifications capability / notification entitlements in production.

Notifications are **temporarily disabled** with a feature flag so builds do not
request that capability.

## Current state

| Item | Status |
|------|--------|
| Feature flag | `NOTIFICATIONS_ENABLED = false` in [`src/constants/featureFlags.ts`](../src/constants/featureFlags.ts) |
| UI | Project reminder section hidden on the project dashboard |
| Runtime | Scheduling, permission prompts, and notification routing are no-ops |
| Expo config | `expo-notifications` plugin removed from [`app.json`](../app.json) |

Reminder **settings data** on projects is still stored (`reminderSettings` on
`Project`); it just is not scheduled or shown while the flag is off.

## How to re-enable (exact same behavior)

### 1. Flip the feature flag

In [`src/constants/featureFlags.ts`](../src/constants/featureFlags.ts):

```ts
export const NOTIFICATIONS_ENABLED = true;
```

### 2. Restore the Expo config plugin

In [`app.json`](../app.json), add `"expo-notifications"` back to `expo.plugins`
(same place it was before — next to the other plugins):

```json
"plugins": [
  "expo-router",
  "expo-dev-client",
  ["expo-camera", { "...": "..." }],
  ["react-native-vision-camera", { "...": "..." }],
  "expo-notifications",
  "@react-native-community/datetimepicker",
  ["expo-build-properties", { "ios": { "deploymentTarget": "15.5" } }]
]
```

Keep `expo-notifications` in `package.json` dependencies (it was left installed).

### 3. Rebuild the native app

Config plugin / entitlement changes require a native rebuild (not Expo Go):

```bash
npx expo prebuild --clean
npx expo run:ios
# or
npx expo run:android
```

Or an EAS production / TestFlight build after you have a paid Apple Developer
account and Push Notifications enabled for the App ID.

### 4. Confirm UI and behavior

After rebuild, on a project dashboard you should again see:

- Reminders on/off switch
- Interval / time pickers
- Next-reminder copy
- Debug actions (test notification, list scheduled, cancel all, reset)

Startup should again:

- Call `configureNotificationHandler()` from [`src/app/_layout.tsx`](../src/app/_layout.tsx)
- Refresh rolling reminders via `refreshRollingReminders()`
- Route taps into capture via [`src/hooks/useNotificationRouting.ts`](../src/hooks/useNotificationRouting.ts)

### 5. Apple / App Store checklist (when shipping)

1. Enroll in [Apple Developer Program](https://developer.apple.com/programs/) (paid).
2. In Apple Developer → Identifiers → your App ID, enable **Push Notifications**.
3. Ensure the App Store / Ad Hoc provisioning profile includes that capability.
4. Rebuild and submit; notification permission strings come from `expo-notifications`.

## Code map (what was gated)

These paths early-return or skip UI when `NOTIFICATIONS_ENABLED` is `false`:

- [`src/data/notificationService.ts`](../src/data/notificationService.ts) — schedule / cancel / permissions / refresh
- [`src/hooks/useNotificationRouting.ts`](../src/hooks/useNotificationRouting.ts) — tap → navigate
- [`src/app/_layout.tsx`](../src/app/_layout.tsx) — startup configure + refresh
- [`src/app/projects/[projectId]/index.tsx`](../src/app/projects/[projectId]/index.tsx) — reminder UI
- [`src/data/projectStorage.ts`](../src/data/projectStorage.ts) — `updateProjectReminderSettings` refuses to enable while disabled

No reminder business logic was deleted; only gated.
