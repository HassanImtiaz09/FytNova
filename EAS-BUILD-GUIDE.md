# FytNova EAS builds

Use [the preview setup guide](docs/PREVIEW_SETUP.md) for the current browser and
Android development-build instructions, account setup, backend connectivity and
validation limits.

FytNova uses a custom Expo development client for its native modules. The
`development` and `development-simulator` profiles already exist in `eas.json`,
but an Expo account/project link and successful native builds are still required.

| Profile | Purpose |
| --- | --- |
| development | Android APK or provisioned physical iOS development build |
| development-simulator | iOS Simulator build (requires macOS/Xcode to run) |
| preview | Internal release-mode build with embedded JavaScript |
| production | Store build; store credentials and release checks required |

For iOS physical-device builds, complete Apple signing and device registration
through EAS. Store-submission identifiers in `eas.json` remain placeholders and
must be configured before submission. Build duration and account quotas depend
on the current Expo service and plan.

VisionCamera 5 and TrackPlayer 4 do not provide Expo config plugins in the
installed packages. They use native autolinking; camera permissions are declared
in `app.config.ts` and playback options in `services/track-player-service.ts`.
The setup includes VisionCamera's Nitro peer dependencies. Android compile and
target SDK versions use Expo SDK 54 defaults.

A development build enables native modules to load; it does not prove that the
app's form analysis, background audio or health sync works. Validate those flows
on physical iOS/Android devices before making feature claims.
