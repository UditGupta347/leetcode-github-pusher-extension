# Fix: "Resource not accessible by personal access token"

## Problem
You're seeing this error: `Resource not accessible by personal access token`

This means your GitHub token doesn't have the required permissions to access your repository.

## Solution

### Step 1: Generate a New Token with Correct Permissions

1. **Go to GitHub Token Settings**:
   - Visit: https://github.com/settings/tokens
   - Or: GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)

2. **Generate New Token**:
   - Click "Generate new token" → "Generate new token (classic)"
   - Give it a name like "LeetCode Pusher"

3. **Select Required Scopes**:
   - ✅ **Check `repo`** - This is the most important one!
     - This gives "Full control of private repositories"
     - This includes read/write access to your repositories

4. **Generate and Copy**:
   - Click "Generate token" at the bottom
   - **IMPORTANT**: Copy the token immediately - you won't see it again!
   - It will look like: `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### Step 2: Update Extension Settings

1. **Click the extension icon** in your browser
2. **Paste the new token** in the "GitHub Personal Access Token" field
3. **Click "Test Connection"** to verify it works
4. **Click "Save Settings"** if the test succeeds

### Step 3: Verify Repository Exists

Make sure you have a repository named exactly `leetcode`:
- Go to: https://github.com/new
- Repository name: `leetcode` (case-sensitive, must be exactly this)
- Choose Public or Private (both work)
- Click "Create repository"

## Quick Checklist

- [ ] Token has `repo` scope checked
- [ ] Token is copied correctly (starts with `ghp_`)
- [ ] Repository named `leetcode` exists
- [ ] Username matches your GitHub username
- [ ] Test Connection button shows success

## Still Having Issues?

### Check Token Permissions
1. Go to https://github.com/settings/tokens
2. Find your token
3. Click on it to see its scopes
4. Make sure `repo` is listed

### Verify Repository Access
1. Go to https://github.com/YOUR_USERNAME/leetcode
2. Make sure the repository exists and you can access it
3. If it's private, make sure your token has access

### Test Manually
You can test your token manually:
```bash
curl -H "Authorization: token YOUR_TOKEN" https://api.github.com/user
```

If this works, try:
```bash
curl -H "Authorization: token YOUR_TOKEN" https://api.github.com/repos/YOUR_USERNAME/leetcode
```

## Common Mistakes

❌ **Token doesn't have `repo` scope** - Most common issue!
❌ **Repository doesn't exist** - Create it first
❌ **Wrong username** - Use your exact GitHub username
❌ **Token expired** - Generate a new one
❌ **Token copied incorrectly** - Make sure there are no extra spaces

## Need Help?

If you're still having issues:
1. Check the browser console for detailed error messages
2. Use the "Test Connection" button in the extension popup
3. Verify your token at https://github.com/settings/tokens
