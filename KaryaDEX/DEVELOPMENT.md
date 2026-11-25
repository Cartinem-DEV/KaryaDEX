# KaryaDEX — Development Guide & Workflow

This document outlines the professional daily development workflow for **KaryaDEX** using Expo SDK 58, Metro Bundler, Expo Go, and Expo Web.

---

## Quick Reference Commands

| Goal | Command | Description |
|---|---|---|
| **Primary Mobile Dev** | `npm run start` | Starts Metro bundler in **LAN** mode with QR code for Expo Go |
| **Explicit LAN** | `npm run start:lan` | Explicitly binds to local network IP |
| **Desktop Web Dev** | `npm run web` | Opens app in desktop browser (`http://localhost:8081`) |
| **Tunnel Fallback** | `npm run tunnel` | Connects via tunnel (use on college/hostel Wi-Fi with isolation) |
| **Android Device** | `npm run android` | Connects to Android device or emulator directly |
| **Clear Metro Cache** | `npm run clear` | Clears Metro bundler cache (`expo start -c`) |
| **Run Unit Tests** | `npm test` | Runs Jest test suite (36 tests) |

---

## 1. Primary Workflow: LAN + Expo Go (Recommended)

This is the fastest, smoothest development path for daily coding.

```mermaid
graph LR
    IDE[Antigravity IDE] -->|Save File| Metro[Expo Metro Bundler]
    Metro -->|LAN / Wi-Fi| Phone[Android Phone (Expo Go)]
    Metro -->|Instant Update| Refresh[Fast Refresh]
```

### Steps:
1. Ensure your **PC and Android phone are connected to the same Wi-Fi network**.
2. Run in terminal:
   ```bash
   npm run start
   ```
3. A large QR code and Metro server details will appear in your terminal.
4. Open the **Expo Go** app on your Android phone.
5. Tap **Scan QR code** and point your camera at the terminal QR code.
6. The KaryaDEX app bundle will download and launch on your phone.
7. Edit any component, screen, or style in Antigravity IDE and press **Save** (`Ctrl + S`).
8. **Fast Refresh** updates your phone screen in milliseconds without losing your app state.

### Interactive Terminal Shortcuts (while Metro is running):
- Press `a` — Open on connected Android device/emulator
- Press `w` — Open web version in default browser
- Press `r` — Reload app bundle on all connected devices
- Press `m` — Toggle developer menu on connected devices
- Press `c` — Show project terminal shortcuts
- Press `j` — Open debugger in Chrome DevTools

---

## 2. Desktop Web Development

To test and develop on your desktop browser alongside or instead of a phone:

```bash
npm run web
```
*(or press `w` in the terminal while `npm run start` is already running).*

- Opens `http://localhost:8081` in your browser.
- Shares the identical React Native Web code, Zustand store, and business logic as mobile.
- Supports instant Fast Refresh and browser developer tools inspection (F12).

---

## 3. Tunnel Mode Fallback (College / Hostel Wi-Fi)

When your PC and phone are on a network where devices cannot talk to each other (common on **university campus Wi-Fi**, **hostels**, or **guest networks** with Client/AP Isolation):

```bash
npm run tunnel
```

### How it works:
- Expo opens a secure tunnel using `@expo/ngrok`.
- The terminal generates a tunnel URL (e.g., `exp://u.expo.dev/...`).
- Scan the QR code in Expo Go as usual. The connection routes over the internet, bypassing any local router blocking.

---

## 4. USB / ADB Fallback (Optional)

If Wi-Fi is unavailable or unstable, you can develop over a standard USB cable using Android Debug Bridge (ADB).

### Prerequisites:
1. Enable **Developer Options** and **USB Debugging** on your Android phone.
2. Connect your phone to your PC with a USB cable.

### Check device connection:
```bash
adb devices
```
*(Should list your device ID with status `device`).*

### Forward the Metro port:
```bash
adb reverse tcp:8081 tcp:8081
```

### Start Expo:
```bash
npm run android
```
or connect via `localhost:8081` in Expo Go.

> [!NOTE]
> `adb` is currently not configured in your Windows system PATH. If you install Android Studio or the Android SDK platform-tools in the future, add the path (typically `%LOCALAPPDATA%\Android\Sdk\platform-tools`) to your Windows User Environment Variables `PATH` to enable ADB. USB is completely optional; LAN and Tunnel work without ADB.

---

## 5. Clearing Metro Cache

If you experience unexpected bundling errors, stale assets, or strange TypeScript resolution:

```bash
npm run clear
```
*(This executes `npx expo start -c`, which flushes the Metro cache safely).*

---

## 6. Fast Refresh Troubleshooting Checklist

If code changes do not update automatically on your device:

1. **Verify Metro is running**: Check the terminal to confirm the Metro bundler is active and has not crashed or paused.
2. **Check device connection**: Ensure your phone hasn't gone to sleep or disconnected from Wi-Fi.
3. **Trigger manual reload**: Press `r` in the Metro terminal to push a full reload.
4. **Check Expo Go Dev Menu**:
   - Shake your Android phone (or press `m` in terminal) to open the Expo Developer Menu.
   - Confirm that **"Fast Refresh"** is set to **Enabled**.
5. **Clear Cache**: Run `npm run clear` to reset Metro cache.
6. **Restart Expo Go**: Swipe away the Expo Go app on your phone and re-scan the QR code.
