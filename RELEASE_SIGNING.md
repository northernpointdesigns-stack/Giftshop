# Release signing

The desktop workflow signs and notarizes only version-tag releases such as `v1.0.1`. Pull requests and normal `main` pushes remain unsigned validation builds.

## GitHub Actions secrets

Add these repository secrets under **Settings > Secrets and variables > Actions**:

### macOS

- `MAC_CERTIFICATE_BASE64`: base64 of a Developer ID Application `.p12`
- `MAC_CERTIFICATE_PASSWORD`: password for that `.p12`
- `MAC_KEYCHAIN_PASSWORD`: any temporary keychain password
- `APPLE_ID`: Apple Developer account email
- `APPLE_APP_SPECIFIC_PASSWORD`: app-specific password generated at appleid.apple.com
- `APPLE_TEAM_ID`: Apple Developer Team ID

Export the certificate from Keychain Access, then encode it without committing the file:

```bash
base64 -i DeveloperIDApplication.p12 | pbcopy
```

### Windows

- `WINDOWS_CERTIFICATE_BASE64`: base64 of the code-signing `.p12`
- `WINDOWS_CERTIFICATE_PASSWORD`: password for that `.p12`

```bash
base64 -i windows-code-signing.p12 | pbcopy
```

## Publishing

Push a version tag after the secrets are configured:

```bash
git tag v1.0.1
git push giftshop v1.0.1
```

The release job publishes the signed macOS DMG/ZIP and signed Windows installer. A Mac app that is not signed and notarized can still show the “damaged” Gatekeeper message after download.

## iOS and Android

The current Android artifact is a debug APK and the iOS artifact is an unsigned simulator app. They are for testing only. Customer distribution needs an Android upload keystore or Play App Signing, and iOS distribution needs an Apple distribution certificate, provisioning profile, and App Store Connect/TestFlight upload credentials.