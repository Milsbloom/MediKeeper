# Launch guide: getting MediKeeper into the stores

Do these in order. Google Play comes first because it's cheaper and you test on Android.
Everything runs from your Windows PC in Git Bash; no Mac is needed, even for iPhone.

Support email used in the privacy policy, terms and store listings: chris@chanzotech.com.

## 1. One-time EAS setup (Expo's build service, free tier is enough)

```bash
npm install -g eas-cli
eas login                 # your Expo account
eas init                  # links the project; commit the projectId it adds to app.json
```

Add the RevenueCat **public** keys as EAS environment variables (from RevenueCat → Project settings → API keys):

```bash
eas env:create --name EXPO_PUBLIC_REVENUECAT_ANDROID_KEY --value goog_xxx --environment preview --environment production --visibility plaintext
```

## 2. Google Play

1. **Developer account**: play.google.com/console, $25 once, plus identity verification (can take a few days).
2. **Create the app**: name "MediKeeper: Pill Reminder", app (not game), free, accept declarations.
3. **Build** the store version (an `.aab` file, about 15 minutes in the cloud):
   ```bash
   eas build --platform android --profile production
   ```
   Download the `.aab` from the link it prints.
4. **Closed testing** (required for new personal accounts): Testing → Closed testing → create a track, upload the `.aab`,
   and add at least **12 testers** (their Gmail addresses; friends and family are fine). They must stay opted in for
   **14 days in a row** before Google lets you apply for production. Start this as early as possible.
5. **Products** (possible only after the first upload): Monetize → Products.
   - Subscriptions: `medikeeper_plus_monthly` ($2.99, monthly base plan) and `medikeeper_plus_yearly` ($19.99, yearly).
   - In-app product: `medikeeper_plus_lifetime` ($39.99).
6. **RevenueCat**: add a Play Store app with package `com.milsbloom.medikeeper`, upload the Google service account
   JSON (RevenueCat's "Google Play service credentials" guide walks through it), import the three products, and
   attach them to the `plus` entitlement and the `default` offering, alongside the Test Store ones.
7. **Store listing**: paste the text from `docs/store-listing.md`. Upload the icon (`store-assets/play-icon-512.png`, 512×512),
   the feature graphic `store-assets/play-feature-graphic.png`, and the phone screenshots `store-assets/play-*.png`.
8. **App content**: privacy policy URL, ads (none), content rating, target audience (18+), data safety and
   health apps declarations. Answers are in `docs/store-listing.md`.
9. **Test real purchases**: in Play Console → Settings → License testing, add your Gmail. Install from the closed
   testing link and buy Plus; license testers aren't charged.
10. After 14 days with 12 testers: **Apply for production**, then Production → Create release with the same `.aab`.

## 3. App Store (iPhone)

1. **Apple Developer Program**: developer.apple.com, $99 a year.
2. **Build and upload to TestFlight** (EAS creates the certificates for you):
   ```bash
   eas build --platform ios --profile production
   eas submit --platform ios --latest
   ```
3. **App Store Connect**: create the app (bundle ID `com.milsbloom.medikeeper`), then In-App Purchases and
   Subscriptions with the same three product IDs and prices.
4. **RevenueCat**: add an App Store app, upload an In-App Purchase key (.p8), import the products, attach to `plus`.
   Add the iOS key with `eas env:create --name EXPO_PUBLIC_REVENUECAT_IOS_KEY ...` and rebuild.
5. **Listing**: text from `docs/store-listing.md`, screenshots `store-assets/appstore-*.png` (6.5" size),
   App Privacy answers, then submit for review with the review note.

## 4. Updates later

Change the code, then `eas build` again (the build number goes up automatically) and upload or `eas submit`.
