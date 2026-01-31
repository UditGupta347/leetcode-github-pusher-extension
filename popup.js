// Popup script for configuration

document.addEventListener('DOMContentLoaded', function() {
  const usernameInput = document.getElementById('githubUsername');
  const tokenInput = document.getElementById('githubToken');
  const saveBtn = document.getElementById('saveBtn');
  const testBtn = document.getElementById('testBtn');
  const statusDiv = document.getElementById('status');

  // Load saved settings
  loadSettings();

  // Save settings when button is clicked
  saveBtn.addEventListener('click', saveSettings);

  // Test connection when button is clicked
  testBtn.addEventListener('click', testConnection);

  // Also save on Enter key
  [usernameInput, tokenInput].forEach(input => {
    input.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        saveSettings();
      }
    });
  });
});

async function loadSettings() {
  try {
    const { githubToken, githubUsername, openrouterKey } = await chrome.storage.sync.get(['githubToken', 'githubUsername', 'openrouterKey']);

    if (githubUsername) {
      document.getElementById('githubUsername').value = githubUsername;
    }

    if (githubToken) {
      document.getElementById('githubToken').value = githubToken;
    }

    if (openrouterKey) {
      document.getElementById('openrouterKey').value = openrouterKey;
    }
  } catch (error) {
    console.error('Error loading settings:', error);
    showStatus('Error loading settings', 'error');
  }
}

async function saveSettings() {
  const username = document.getElementById('githubUsername').value.trim();
  const token = document.getElementById('githubToken').value.trim();
  const openrouterKey = document.getElementById('openrouterKey').value.trim();

  if (!username || !token) {
    showStatus('Please fill in both username and token', 'error');
    return;
  }

  if (!token.startsWith('ghp_') && !token.startsWith('github_pat_')) {
    showStatus('Invalid token format. Token should start with "ghp_" or "github_pat_"', 'error');
    return;
  }

  // OpenRouter key is optional, but validate format if provided
  if (openrouterKey && !openrouterKey.startsWith('sk-or-v1-') && !openrouterKey.startsWith('sk-or-')) {
    showStatus('Invalid OpenRouter key format. Key should start with "sk-or-v1-" or "sk-or-"', 'error');
    return;
  }

  try {
    // Save to storage
    const settings = {
      githubUsername: username,
      githubToken: token
    };
    
    if (openrouterKey) {
      settings.openrouterKey = openrouterKey;
    } else {
      // Remove key if empty
      await chrome.storage.sync.remove('openrouterKey');
    }
    
    await chrome.storage.sync.set(settings);

    // Test the configuration
    const testResult = await testGitHubConnection(username, token);

    if (testResult.success) {
      showStatus('Settings saved successfully!', 'success');
    } else {
      showStatus(`Settings saved, but connection test failed: ${testResult.error}`, 'error');
    }

  } catch (error) {
    console.error('Error saving settings:', error);
    showStatus('Error saving settings', 'error');
  }
}

async function testGitHubConnection(username, token) {
  try {
    // Test API access by getting user info
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 401) {
        return {
          success: false,
          error: 'Invalid token. Please check your GitHub Personal Access Token.'
        };
      }
      return {
        success: false,
        error: `Token validation failed: ${response.status} ${errorData.message || response.statusText}`
      };
    }

    const userData = await response.json();

    if (userData.login !== username) {
      return {
        success: false,
        error: `Token belongs to "${userData.login}", but you entered "${username}". Please use the correct username.`
      };
    }

    // Test repository access
    const repoResponse = await fetch(`https://api.github.com/repos/${username}/leetcode`, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!repoResponse.ok) {
      const error = await repoResponse.json().catch(() => ({}));
      let errorMessage = error.message || repoResponse.statusText;
      
      if (repoResponse.status === 404) {
        errorMessage = `Repository "leetcode" not found. Please create it at https://github.com/new (name it exactly "leetcode")`;
      } else if (repoResponse.status === 403) {
        if (errorMessage.includes('Resource not accessible')) {
          errorMessage = 'Token does not have "repo" scope. Please regenerate your token with "repo" permissions at https://github.com/settings/tokens';
        } else {
          errorMessage = `Access denied: ${errorMessage}. Check token permissions.`;
        }
      } else if (repoResponse.status === 401) {
        errorMessage = 'Invalid or expired token. Please regenerate your token.';
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }

    return { success: true };

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

async function testConnection() {
  const username = document.getElementById('githubUsername').value.trim();
  const token = document.getElementById('githubToken').value.trim();

  if (!username || !token) {
    showStatus('Please enter username and token first', 'error');
    return;
  }

  // Save temporarily for testing
  await chrome.storage.sync.set({
    githubUsername: username,
    githubToken: token
  });

  showStatus('Testing connection...', 'info');
  testBtn.disabled = true;

  try {
    const result = await chrome.runtime.sendMessage({ action: 'test_connection' });
    
    if (result.success) {
      showStatus('✅ Connection successful! Repository is accessible.', 'success');
    } else {
      showStatus(`❌ Connection failed: ${result.error}`, 'error');
    }
  } catch (error) {
    showStatus(`❌ Error: ${error.message}`, 'error');
  } finally {
    testBtn.disabled = false;
  }
}

function showStatus(message, type) {
  const statusDiv = document.getElementById('status');
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;
  statusDiv.style.display = 'block';

  // Hide after 5 seconds for success messages
  if (type === 'success') {
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 5000);
  }
}
