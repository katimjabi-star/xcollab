# XCollab Mobile (Android first)

Expo / React Native client for XCollab — same API, same login doors as the
web app (Katim ID device push + password fallback), EN/AR, dark theme.

Standalone npm project (NOT part of the pnpm workspace): `npm install` here.
Native dirs (`android/`, `ios/`) are prebuild output and gitignored — all
native customization lives in `plugins/` (Continuous Native Generation).

## Network / certificate model (learned from XMaps)

- `service8.nexedge.ae` serves a **public Sectigo wildcard cert** — stock
  system trust works; no custom CA, no MDM profile, no cleartext.
- `plugins/withXCollabNetwork.js` installs an OkHttp policy into every RN
  HTTP stack (fetch/XHR + WebSocket):
  - **Pinned-host DNS** from `expo.extra.pinnedHosts` in app.json — the
    mobile equivalent of the demo-laptop hosts line, because public DNS does
    not resolve service8 to the intranet edge yet. Loopback is tried first
    so a USB tunnel (below) wins when present. TLS always verifies against
    the real hostname. Delete the entry and rebuild once the public edge
    forwards service8.
  - **HTTP/1.1 only** — the nexedge.ae edge routes by TLS SNI; HTTP/2
    connection coalescing across the shared wildcard cert lands requests in
    the wrong Istio filter chain (404s XMaps hit in the field).
  - **IPv4-first DNS** for everything else (black-holed AAAA paths).

## Build (Android)

```sh
npm install
npx expo prebuild --platform android --no-install
cd android && JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home \
  ./gradlew assembleRelease
# → android/app/build/outputs/apk/release/app-release.apk
```

Corporate-proxy note: Gradle needs the KATIM corporate roots in its JVM
truststore (`~/.gradle/gradle.properties` → `~/.gradle/corp-cacerts.jks`,
already set up on the build Mac).

Endpoints are baked at bundle time via `EXPO_PUBLIC_API_URL`,
`EXPO_PUBLIC_KEYCLOAK_ISSUER`, `EXPO_PUBLIC_KEYCLOAK_CLIENT_ID`
(defaults: service8, `/auth/realms/xcollab`, `xcollab-web`).

## Running on a device

Two ways for the phone to reach the intranet edge:

1. **Corp-VPN network**: any network that routes to the edge — works as-is.
2. **USB tunnel** (demo desk setup, phone has no route):
   ```sh
   node scripts/usb-tunnel.mjs &          # Mac must be on the corporate VPN
   adb reverse tcp:443 tcp:8443           # re-run after replug/reinstall
   ```

Sign in: Katim ID door (username prefilled `demo`, mock push auto-approves)
or the password door.

## Gates

```sh
npm run typecheck && npm run lint && npm test
```
