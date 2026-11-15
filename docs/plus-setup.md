# Setting up MediKeeper Plus payments

MediKeeper sells Plus through [RevenueCat](https://www.revenuecat.com), which handles the App Store and
Google Play for us, works out who has paid, and is free until the app earns $2,500 a month.

| Plan | Price | Store product ID |
|------|-------|------------------|
| Monthly | $2.99 | `medikeeper_plus_monthly` |
| Yearly | $19.99 | `medikeeper_plus_yearly` |
| Lifetime | $39.99 | `medikeeper_plus_lifetime` |

Plus unlocks: more than one person (family profiles) and the PDF doctor report.
Everything else stays free.

## Step 0: try Plus without any setup

Run the app in Expo Go, open **Settings → Get MediKeeper Plus**. With no RevenueCat key set, the screen shows
**Unlock Plus for testing (developer only)**. That button only exists in development, never in a store build.

## Step 1: RevenueCat Test Store (works in Expo Go, no real money)

1. Create a free account at revenuecat.com and a project called **MediKeeper**.
2. In the project, open the **Test Store** app (RevenueCat creates it for you).
3. Add three products with the IDs and prices in the table above (monthly, yearly, lifetime/non-subscription).
4. **Entitlements** → create one with the identifier `plus` and attach all three products.
5. **Offerings** → the `default` offering → add three packages: Monthly, Annual and Lifetime, each with its product.
6. **API keys** → copy the **Test Store** public key (starts with `test_`).
7. In the project folder, copy `.env.example` to `.env.local` and paste the key after
   `EXPO_PUBLIC_REVENUECAT_TEST_KEY=`.
8. Restart with `npx expo start --tunnel --clear`. The Plus screen now lists the three plans, and buying one
   shows RevenueCat's test purchase sheet.

## Step 2: real stores (week 5)

1. Developer accounts: Google Play Console ($25 once) and Apple Developer Program ($99 a year).
2. Create the three products in each store with the IDs above (two auto-renewing subscriptions in one group,
   plus a one-time purchase for lifetime).
3. In RevenueCat, add the Android and iOS apps (package / bundle ID `com.milsbloom.medikeeper`), connect the
   store credentials, and attach the store products to the same `plus` entitlement and `default` offering.
4. Put the public Android and iOS keys in EAS so builds get them:
   ```bash
   npx eas-cli env:create --name EXPO_PUBLIC_REVENUECAT_ANDROID_KEY --value goog_xxx --environment preview --environment production --visibility plaintext
   npx eas-cli env:create --name EXPO_PUBLIC_REVENUECAT_IOS_KEY --value appl_xxx --environment preview --environment production --visibility plaintext
   ```
5. Build a test app: `npx eas-cli build --profile preview --platform android` and install the APK from the link.

The bundle / package ID `com.milsbloom.medikeeper` is set in `app.json`. It can't be changed after the
app is published, so change it before the first store upload if you want a different one.
