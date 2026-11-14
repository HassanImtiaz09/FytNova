# FytNova preview setup

The app uses Expo SDK 54. Use a browser to review screens, then an Android
development build to test native modules. The native build still needs validation
on a physical device; browser success does not establish camera/health support.

## Android APK through GitHub Actions

The **Android preview APK** workflow uses the repository Actions secret
`EXPO_TOKEN` to create/link the Expo project and build an installable APK with
embedded JavaScript. The token is only passed to the Expo steps. It is never
included in the mobile app or published artifacts.

On `codex/preview-setup`, changing `.github/android-preview-request.json` starts
one build request. Ordinary source commits do not trigger additional builds.
After the workflow is on the default branch, it can also be started manually
from the repository's Actions page.

The workflow summary provides the Expo build link and, on success, the APK
installation link. The `expo-android-build` and `expo-android-result` artifacts
contain only project/build metadata and the resulting APK URL. Cloud build logs
remain in Expo. The workflow never submits to an app store.

The `android-preview` profile builds a release-mode APK using the generated
Android template's debug signing key. It is for internal UI testing only; store
releases need their own signing configuration. This APK opens without Metro.
Online auth, AI and synced data still require a configured, reachable backend.
Native modules still need validation on a physical Android device.

## Browser preview

Use Node 22 LTS and the package manager declared in package.json (pnpm 9.12.0).
From this checkout:

```sh
pnpm install --frozen-lockfile
cp .env.example .env
pnpm dev
```

Open http://localhost:8081/login on the computer running these commands.
Choose **Skip — Continue as Guest**, then complete onboarding or choose **Skip**.
The local API runs on port 3000. Browser screens and local guest data can be
reviewed without AI, payment or auth credentials; those services need their own
configuration to work. Native camera, health sync and background audio must be
tested in the Android build.

Current guest-mode browser captures: [Home](previews/home.png),
[Train](previews/train.png), and [Nutrition](previews/nutrition.png).

## First Android development build

1. Create a free account at https://expo.dev/signup.
2. Run the following from the checkout and sign in through the CLI. Expo build
   quotas and pricing depend on the account's current plan.

```sh
pnpm exec eas login
pnpm exec eas whoami
pnpm exec eas init
```

Choose an existing FytNova project if there is one, or create a new project owned
by your account. `eas init` links its project ID into the app configuration; do not
replace a previously linked project with a second one.

3. Set `EXPO_PUBLIC_API_BASE_URL` in `.env` to the API's reachable address. For a
   local backend, use the computer's LAN IP and port 3000, not localhost (which
   would refer to the phone). For a hosted backend, use its HTTPS URL.
4. Build the Android development client:

```sh
pnpm eas:build:dev:android
```

5. Open the completed build's installation link/QR code on the Android phone.
   Install the APK and allow installation from that source when Android asks.
   This installs **FytNova**, the development client for this project.
6. Start the API and Metro in separate terminals:

```sh
pnpm dev:server
```

```sh
pnpm dev:client
```

Keep the phone and computer on the same reachable Wi-Fi network. Open FytNova
and scan the Metro QR code. If Metro requires a tunnel, use
`pnpm dev:client --tunnel`; this exposes Metro only. The backend must still be
reachable separately at `EXPO_PUBLIC_API_BASE_URL`.

Screen/JavaScript changes normally refresh through Metro. Changes to native
dependencies, permissions or config plugins require another APK build. A later
`preview` EAS build embeds its JS and can run without Metro; it still needs a
reachable backend for online functionality.

## Current validation boundary

This setup repair removes invalid VisionCamera 5/TrackPlayer 4 Expo plugin entries,
adds the development client and required dependencies, and aligns Expo packages
with SDK 54. It does not establish that pose detection or native health features
are complete. EAS compilation and physical-device camera, video, audio and health
permission checks are the next native gates. No database migration is needed for
this preview setup.
