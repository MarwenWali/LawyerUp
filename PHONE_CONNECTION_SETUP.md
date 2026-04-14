# Phone Connection Setup Guide

## Problem
When scanning the QR code from your phone, the app gets stuck on the loading page because it cannot reach the backend.

## Root Causes
1. **Wrong Backend URL** - The app tries to derive the backend URL but may fail on physical devices
2. **No Timeout** - Before my fixes, requests would hang indefinitely if the backend wasn't reachable
3. **Network Unreachable** - Physical phones can't reach `localhost:3000` on your development machine

## Solution: Set EXPO_PUBLIC_API_URL

### For Local Network (Phone + Computer on same WiFi)

### Step 1: Find Your Computer's IP Address

**Windows:**
```powershell
ipconfig
```
Look for "IPv4 Address" under your active network connection. It will look like `192.168.x.x`

### Step 2: Ensure Backend is Running

Make sure your backend is running on port 3000:
```bash
cd backend
npm run dev
```

### Step 3: Create/Update .env.local in frontend folder

Create a file `frontend/.env.local`:
```env
EXPO_PUBLIC_API_URL=http://YOUR_COMPUTER_IP:3000
```

Example:
```env
EXPO_PUBLIC_API_URL=http://192.168.1.100:3000
```

### Step 4: Restart the Expo App

1. Stop the Expo server (Ctrl+C in the terminal)
2. Start it again:
   ```bash
   cd frontend
   npm start
   ```
3. Scan the new QR code from your phone

### For Remote Connection (Different Networks / Ngrok Tunnel)

If your phone is on a different network, use **ngrok** to create a tunnel:

```bash
# Install ngrok if you haven't already
npm install -g ngrok

# Expose your backend to the internet
ngrok http 3000
```

This will give you a URL like: `https://xxxx-xx-xxx-xxx-xx.ngrok.io`

Then set:
```env
EXPO_PUBLIC_API_URL=https://xxxx-xx-xxx-xxx-xx.ngrok.io
```

## Debugging Steps

1. **Check Logs** - When the app loads, watch the console for messages like:
   - `📱 App initialized with BASE_URL: http://192.168.1.100:3000`
   - `⏱️ Request timeout after 15 seconds` - Backend is unreachable
   - `❌ Network error: ...` - Connection issue

2. **Test Backend Connectivity** - From your phone, try opening:
   ```
   http://YOUR_COMPUTER_IP:3000/api/auth/verify
   ```
   It should return an error about missing auth token (meaning it's reachable)

3. **Check Firewall** - Windows Firewall might block connections. Allow Node.js:
   - Go to Windows Defender Firewall → Allow an app through firewall
   - Make sure Node.js is checked

4. **Same Network** - Ensure phone and computer are on the same WiFi network

## After Fixes

The app now has:
- ✅ **15-second timeout** on API requests (prevents indefinite hanging)
- ✅ **Better error logging** to know what's failing
- ✅ **Graceful degradation** - app loads login screen even if verification fails
- ✅ **Better URL detection** for Expo's tunnel mode

## Common Issues

### "Request timed out after 15 seconds"
- Backend is not running or not reachable
- Check that `npm run dev` is running in the backend folder
- Verify the IP address is correct
- Check firewall settings

### "Failed to reach backend at http://10.0.2.2:3000"
- This is for Android emulators only
- For physical devices, set `EXPO_PUBLIC_API_URL` to your computer's IP

### "Network is unreachable"
- Phone is not on the same WiFi as your computer
- Try disconnecting and reconnecting to WiFi
- Or use ngrok tunnel for remote debugging

