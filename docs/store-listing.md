# Store listing text

Copy and paste into Google Play Console and App Store Connect. Character limits are in brackets.

## Google Play

**App name** [30]: `MediKeeper: Pill Reminder`

**Short description** [80]:
`Medication reminders that keep at it. Offline, private, no account needed.`

**Full description** [4000]:

```
MediKeeper reminds you to take your medication, and keeps reminding you until you do.

No account. No internet needed. No limit on medications. Your health information never leaves your phone.

REMINDERS THAT KEEP AT IT
• A notification at every dose time, with Take and Snooze buttons right on it
• Missed it? MediKeeper reminds you again every 5 to 30 minutes until you mark the dose
• Works offline, even in airplane mode

ANY SCHEDULE
• Every day, specific days of the week, every few days, or as needed
• As many reminder times a day as you need
• Pills, capsules, liquids, injections, inhalers, drops

SEE HOW YOU'RE DOING
• Today list with one-tap Take, Skip and Undo
• Calendar history coloured by day, with your 30-day score and streak
• Refill tracking that warns you before you run out

YOUR DATA IS YOURS
• Everything is stored only on your phone
• No ads, no tracking, no selling your data
• Export your full history as a spreadsheet (CSV), free, any time

MEDIKEEPER PLUS
• Family profiles: look after a parent, partner or child, each with their own list and reminders
• Report for your doctor: a clear PDF of medications and doses taken or missed
Plus is optional: monthly, yearly or a one-time lifetime purchase. Everything else is free.

MediKeeper is a reminder and tracking tool. It doesn't give medical advice and doesn't replace your doctor or pharmacist.
```

**Category**: Medical · **Tags**: medication reminder, pill tracker, health
**Contact email**: your support email · **Privacy policy URL**: https://github.com/Milsbloom/MediKeeper/blob/main/docs/privacy.md

### Data safety form
- Does your app collect or share user data? **Yes** (only for purchases).
- Data type: **Financial info → Purchase history**. Collected, not shared. Purpose: **App functionality**. Required.
  Processed by RevenueCat to confirm Plus purchases.
- Is data encrypted in transit? **Yes**.
- Can users request deletion? **Yes**, by emailing support (RevenueCat customer records can be deleted from the dashboard).
- Health info, location, contacts, personal info: **not collected** (stays on the device only).

### Other Play Console declarations
- **Health apps declaration**: medication management / reminders. Not a medical device.
- **Ads**: no ads. **Target audience**: 18 and over. **Content rating**: answer "no" to all content questions (rated Everyone).
- **Alarms & reminders permission** (SCHEDULE_EXACT_ALARM): used so medication reminders fire on time.

## App Store

**Name** [30]: `MediKeeper: Pill Reminder`
**Subtitle** [30]: `Offline medication reminders`
**Keywords** [100]: `pill,medicine,medication,tracker,dose,alarm,refill,meds,schedule,caregiver,family,health,log`
**Promotional text** [170]: `Reminders that keep at it until you take your dose. No account, no internet, no limits. Your data never leaves your phone.`
**Description**: use the Google Play full description above.
**Category**: Medical (secondary: Health & Fitness) · **Age rating**: 4+ (answer "none" to all; medical info is "infrequent/mild")
**Privacy policy URL**: as above · **Support URL**: https://github.com/Milsbloom/MediKeeper

### App Privacy ("nutrition label")
- **Purchases → Purchase history**: collected, used for App Functionality, not linked to identity, not used for tracking.
- **Identifiers → User ID** (RevenueCat's anonymous ID): App Functionality, not linked to identity, not used for tracking.
- Everything else: **not collected**.

### Subscription review notes
In-app purchase group "MediKeeper Plus" with `medikeeper_plus_monthly` and `medikeeper_plus_yearly`, plus non-consumable
`medikeeper_plus_lifetime`. Review note: "Plus unlocks family profiles (Settings → People → Add a person) and the doctor
report PDF (History tab). No account is needed."
