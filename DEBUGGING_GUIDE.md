# Debugging Guide - LeetCode GitHub Pusher

This guide will help you check if the extension is working correctly and troubleshoot any issues.

## 🔍 How to Check if Extension is Working

### Step 1: Check Browser Console (Content Script Logs)

1. **Open LeetCode problem page** (e.g., `https://leetcode.com/problems/two-sum/`)
2. **Open Developer Tools**:
   - Press `F12` or `Ctrl+Shift+I` (Windows/Linux)
   - Press `Cmd+Option+I` (Mac)
3. **Go to Console tab**
4. **Look for these messages**:
   - ✅ `LeetCode GitHub Pusher: Observer initialized` - Extension is loaded
   - ✅ `[LeetCode Pusher] Submission successful detected!` - Submission detected
   - ✅ `[LeetCode Pusher] Extracted data:` - Shows problem name, language, code length
   - ✅ `[LeetCode Pusher] Message sent to background script` - Data sent successfully

### Step 2: Check Background Script Logs

1. **Open Extension Management**:
   - Chrome/Edge: Go to `chrome://extensions/`
   - Firefox: Go to `about:debugging`
2. **Find "LeetCode GitHub Pusher"** extension
3. **Click "Inspect views: service worker"** (Chrome) or "Inspect" (Firefox)
4. **Check Console tab** for these messages:
   - ✅ `[Background] Received message:` - Message received from content script
   - ✅ `[Background] Processing submission:` - Processing started
   - ✅ `[Background] Credentials found for user:` - GitHub credentials loaded
   - ✅ `[Background] Upload successful!` - File uploaded to GitHub
   - ❌ Any error messages will show what went wrong

### Step 3: Test Connection Manually

1. **Click the extension icon** in your browser toolbar
2. **Enter your GitHub username and token**
3. **Click "Test Connection" button**
4. **Check the status message**:
   - ✅ Green: Connection successful
   - ❌ Red: Connection failed (check error message)

### Step 4: Test with a Real Submission

1. **Go to any LeetCode problem** (e.g., Two Sum)
2. **Write and submit a solution**
3. **After getting "Accepted"**, check:
   - Browser console for detection messages
   - Background script console for upload messages
   - Browser notifications (should show success/error)
   - Your GitHub repository at `https://github.com/YOUR_USERNAME/leetcode/tree/main/solutions`

## 🐛 Common Issues and Solutions

### Issue 1: Extension Not Detecting Submissions

**Symptoms:**
- No console messages when submission succeeds
- Extension seems inactive

**Solutions:**
1. **Reload the extension**:
   - Go to `chrome://extensions/`
   - Click reload icon on the extension
   - Refresh LeetCode page
2. **Check if you're on correct page**:
   - URL should be `leetcode.com/problems/*`
   - Not on submission history or other pages
3. **Check browser console for errors**:
   - Look for red error messages
   - Check if content script is blocked

### Issue 2: Code Not Extracting

**Symptoms:**
- Submission detected but code is empty
- Console shows `No code found to submit`

**Solutions:**
1. **Check code editor type**:
   - Extension supports CodeMirror, Monaco, Ace editors
   - If LeetCode uses a different editor, we may need to add support
2. **Try different problem**:
   - Some problems may have different page structure
3. **Check console for extraction attempts**:
   - Look for which selectors are being tried

### Issue 3: GitHub Upload Failing

**Symptoms:**
- Error notification: "Failed to push to GitHub"
- Background script shows error

**Solutions:**
1. **Check GitHub credentials**:
   - Verify username is correct
   - Verify token is valid and not expired
   - Token must have `repo` scope
2. **Check repository exists**:
   - Repository must be named exactly `leetcode`
   - Must be accessible with your token
3. **Check network/API errors**:
   - Look in background script console for detailed error
   - Common errors:
     - `401 Unauthorized` - Invalid token
     - `404 Not Found` - Repository doesn't exist
     - `403 Forbidden` - Token doesn't have permissions

### Issue 4: File Created but Wrong Location/Name

**Symptoms:**
- File appears in wrong folder
- File has wrong extension

**Solutions:**
1. **Check problem name extraction**:
   - Console should show extracted problem name
   - Should match URL slug (e.g., `two_sum` from `/problems/two-sum/`)
2. **Check language detection**:
   - Console shows detected language
   - Verify it matches your selected language
3. **File location**:
   - Files go to `solutions/` folder
   - Format: `solutions/problem_name.extension`

## 📊 Understanding Console Messages

### Content Script Messages (LeetCode Page Console)

```
✅ LeetCode GitHub Pusher: Observer initialized
   → Extension loaded and monitoring page

✅ [LeetCode Pusher] Submission successful detected!
   → Found successful submission

📝 [LeetCode Pusher] Extracted data: {problemName: "two_sum", language: "cpp", ...}
   → Successfully extracted problem data

✅ [LeetCode Pusher] Message sent to background script
   → Data sent to background for processing

⚠️ [LeetCode Pusher] No code found to submit
   → Couldn't extract code (check editor type)
```

### Background Script Messages (Service Worker Console)

```
📨 [Background] Received message: {action: "submission_success", ...}
   → Message received from content script

🚀 [Background] Processing submission: {problemName: "two_sum", ...}
   → Starting upload process

✅ [Background] Credentials found for user: your-username
   → GitHub credentials loaded

📁 [Background] Target file: solutions/two_sum.cpp
   → File path determined

🔍 [Background] Checking if file exists...
   → Checking GitHub for existing file

🌐 [Background] GET request to: https://api.github.com/...
   → API request to check file

🌐 [Background] PUT request to: https://api.github.com/...
   → API request to upload file

✅ [Background] Upload successful!
   → File uploaded successfully

❌ [Background] Error pushing to GitHub: ...
   → Error occurred (check details)
```

## 🧪 Manual Testing Steps

### Test 1: Extension Loading
1. Open LeetCode problem page
2. Open console (F12)
3. Should see: `LeetCode GitHub Pusher: Observer initialized`

### Test 2: Configuration
1. Click extension icon
2. Enter GitHub credentials
3. Click "Test Connection"
4. Should see green success message

### Test 3: Submission Detection
1. Submit a solution on LeetCode
2. Get "Accepted" result
3. Check console for detection messages
4. Check background script console for processing messages

### Test 4: GitHub Upload
1. After successful submission
2. Check GitHub repository: `https://github.com/YOUR_USERNAME/leetcode/tree/main/solutions`
3. File should appear within a few seconds

## 🔧 Advanced Debugging

### Enable Verbose Logging

All console messages are already enabled. If you want more details:

1. **Check Network Tab**:
   - Open DevTools → Network tab
   - Filter by "github.com"
   - See actual API requests/responses

2. **Check Storage**:
   - DevTools → Application → Storage → Extension Storage
   - Verify `githubToken` and `githubUsername` are saved

3. **Check Permissions**:
   - Extension should have access to:
     - `https://leetcode.com/*`
     - `https://api.github.com/*`

## 📝 Reporting Issues

If you encounter issues, please check:

1. ✅ Browser console messages (content script)
2. ✅ Background script console messages
3. ✅ Extension popup test connection result
4. ✅ GitHub repository exists and is accessible
5. ✅ Token has correct permissions (`repo` scope)

Include these details when reporting:
- Browser and version
- Extension version
- Console error messages
- Steps to reproduce
- Screenshots if helpful

## ✅ Success Checklist

Your extension is working correctly if:

- [ ] Extension loads on LeetCode problem pages
- [ ] Console shows "Observer initialized"
- [ ] Test Connection button works
- [ ] Submission detection messages appear in console
- [ ] Background script processes submissions
- [ ] Files appear in GitHub repository
- [ ] Browser notifications show success

If all checkboxes are checked, your extension is working perfectly! 🎉
