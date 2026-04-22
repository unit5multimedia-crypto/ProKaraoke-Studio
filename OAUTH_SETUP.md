# OAUTH_SETUP.md

# 🔑 ProKaraoke Studio: OAuth Setup Guide

To use the **Unified Library** (YouTube Search & Google Drive) and enable **Studio Login**, you must configure OAuth Client IDs in the Google Cloud Console.

## 1. Create a Project
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project named ``ProKaraoke Studio``.

## 2. Enable APIs
Enable the following APIs for your project:
- **YouTube Data API v3**
- **Google Drive API**
- **Google People API** (Optional, for profile info)

## 3. Configure OAuth Consent Screen
1. Go to **APIs & Services > OAuth consent screen**.
2. Select **External**.
3. Fill in the App Name (`ProKaraoke Studio`) and your developer email.
4. **Scopes:** Add `./auth/youtube.readonly` and `./auth/drive.readonly`.
5. **Test Users:** Add your email as a test user if you are in "Testing" mode.

## 4. Create Client IDs (CRITICAL)

### A. Web Client ID (For Web/Preview)
1. Go to **APIs & Services > Credentials**.
2. Click **Create Credentials > OAuth client ID**.
3. Select **Web application**.
4. **Name:** `ProKaraoke Web`.
5. **Authorized JavaScript origins:**
   - `https://ais-dev-qqit6p4dybyf2rnzy52mlt-29548617324.asia-east1.run.app` (Your Dev URL)
   - `https://ais-pre-qqit6p4dybyf2rnzy52mlt-29548617324.asia-east1.run.app` (Your Shared URL)
6. **Authorized redirect URIs:**
   - `https://ais-dev-qqit6p4dybyf2rnzy52mlt-29548617324.asia-east1.run.app/__/auth/handler`
7. Click **Create** and copy the **Client ID**.

### B. Desktop Client ID (For Electron App)
1. Go to **APIs & Services > Credentials**.
2. Click **Create Credentials > OAuth client ID**.
3. Select **Desktop app**.
4. **Name:** `ProKaraoke Desktop`.
5. Click **Create** and copy the **Client ID**.

## 5. Update Your App
Add these IDs to your `.env` file (or provide them to the AI Studio system instructions):

```env
GOOGLE_CLIENT_ID_WEB="your-web-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_ID_DESKTOP="your-desktop-client-id.apps.googleusercontent.com"
```

> **Note:** Firebase Authentication typically uses the auto-generated "Web client ID". If you are using the `signInWithPopup` method in this app, ensure you have enabled **Google** in the **Firebase Console > Authentication > Sign-in method** and added these Client IDs to the whitelist there.

---
**THANKS BE TO GOD!** Your studio is now professionally configured for the Sunday gathering.
