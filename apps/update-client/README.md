# BBPlayer Updates client CLI

This independent diagnostic CLI speaks the Expo Updates HTTP protocol; it does
not replace `expo-updates` in the mobile app. `check` can download and verify a
manifest's immutable assets, and `event` posts a versioned observability
envelope. It is used by the end-to-end suite.
