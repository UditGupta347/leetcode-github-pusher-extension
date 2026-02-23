# LeetCode GitHub Pusher

A browser extension that automatically pushes your successful LeetCode submissions to a GitHub repository.

## Features

- Automatically detects successful LeetCode submissions
- Extracts the problem name and submitted code
- **AI-Powered Code Formatting** (Optional) - Formats code and adds explanations, approach, and complexity analysis
- Pushes code to a GitHub repository named "leetcode"
- Supports multiple programming languages
- Simple configuration via extension popup

## Installation

### Chrome/Edge
1. Download or clone this repository
2. Open Chrome/Edge and go to `chrome://extensions/` (or `edge://extensions/`)
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked" and select the extension folder
5. The extension should now appear in your extensions list

### Firefox
1. Download or clone this repository
2. Open Firefox and go to `about:debugging`
3. Click "This Firefox" in the left sidebar
4. Click "Load Temporary Add-on"
5. Select the `manifest.json` file from the extension folder

## Setup

### 1. Create GitHub Repository
Create a new repository on GitHub named exactly `leetcode` (case-sensitive).

### 2. Generate GitHub Personal Access Token
1. Go to [GitHub Settings → Personal Access Tokens](https://github.com/settings/tokens)
2. Click "Generate new token (classic)"
3. Give it a descriptive name like "LeetCode Pusher"
4. Select the `repo` scope (full control of private repositories)
5. Click "Generate token"
6. **Important:** Copy the token immediately - you won't be able to see it again!

### 3. (Optional) Get OpenRouter API Key for AI Formatting
1. Go to [OpenRouter Keys](https://openrouter.ai/keys)
2. Sign up or log in
3. Create a new API key
4. Copy the key (starts with `sk-or-v1-`)

### 4. Configure the Extension
1. Click the extension icon in your browser toolbar
2. Enter your GitHub username
3. Enter your GitHub personal access token
4. (Optional) Enter your OpenRouter API key for AI formatting
5. Click "Save Settings"
6. The extension will test your connection and show a success message

## How It Works

1. **Detection**: The extension monitors LeetCode problem pages for successful submissions
2. **Extraction**: When a submission succeeds, it extracts:
   - Problem name (from URL slug)
   - Your submitted code
   - Programming language
3. **AI Formatting** (Optional): If OpenRouter API key is configured:
   - Code is sent to AI for formatting and documentation
   - AI adds approach explanation, time/space complexity analysis
   - Code is properly formatted with comments
4. **Upload**: The code is automatically uploaded to your `leetcode` repository in a `solutions/` folder
5. **Naming**: Files are named like `two_sum.py`, `reverse_string.java`, etc.

## Supported Languages

The extension automatically detects and handles these languages:
- JavaScript (.js)
- Python (.py)
- Java (.java)
- C++ (.cpp)
- C (.c)
- C# (.cs)
- PHP (.php)
- Ruby (.rb)
- Swift (.swift)
- Go (.go)
- Scala (.scala)
- Kotlin (.kt)
- Rust (.rs)
- TypeScript (.ts)

## File Structure in Repository

After successful submissions, your repository will look like:
```
leetcode/
├── solutions/
│   ├── two_sum.py
│   ├── valid_parentheses.java
│   ├── merge_two_sorted_lists.cpp
│   └── ...
└── README.md
```

## Troubleshooting

### Extension Not Detecting Submissions
- Make sure you're on a LeetCode problem page (`https://leetcode.com/problems/*`)
- Try refreshing the page after installing the extension
- Check that the extension has permission to access LeetCode

### GitHub Upload Failing
- Verify your GitHub token is correct and has `repo` scope
- Ensure you have a repository named exactly `leetcode`
- Check that your username is spelled correctly
- Try regenerating your token if it's expired

### Code Not Extracting Properly
- The extension works with LeetCode's default code editors
- Some custom themes or browser extensions might interfere
- Try using the default LeetCode interface

## Development

### Files Overview
- `manifest.json` - Extension configuration
- `content.js` - Detects submissions on LeetCode pages
- `background.js` - Handles GitHub API interactions
- `popup.html/js` - Configuration interface
- `icon48.png/icon128.png` - Extension icons

### Testing
1. Load the extension in developer mode
2. Open a LeetCode problem
3. Submit a solution
4. Check browser console for debug messages
5. Verify the file appears in your GitHub repository

## Privacy & Security

- Your GitHub token is stored locally in browser storage
- The extension only accesses LeetCode and GitHub APIs
- No data is sent to third-party servers
- Code is only uploaded to your specified GitHub repository

## Contributing

Feel free to open issues or submit pull requests to improve the extension!

## License

This project is open source. Use at your own risk.
