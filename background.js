// Background script for GitHub API integration

const GITHUB_API_BASE = 'https://api.github.com';
const REPO_OWNER = 'devang-kumar'; // This will be configurable
const REPO_NAME = 'leetcode';

// Language extension mapping
const LANGUAGE_EXTENSIONS = {
  'javascript': 'js',
  'java': 'java',
  'python': 'py',
  'python3': 'py',
  'cpp': 'cpp',
  'c': 'c',
  'csharp': 'cs',
  'php': 'php',
  'ruby': 'rb',
  'swift': 'swift',
  'go': 'go',
  'scala': 'scala',
  'kotlin': 'kt',
  'rust': 'rs',
  'typescript': 'ts'
};

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 [Background] Received message:', request);
  
  if (request.action === 'submission_success') {
    console.log('🚀 [Background] Processing submission:', {
      problemName: request.problemName,
      language: request.language,
      codeLength: request.code?.length
    });
    
    handleSuccessfulSubmission(request.problemName, request.code, request.language)
      .then(() => {
        sendResponse({status: 'success'});
      })
      .catch((error) => {
        console.error('❌ [Background] Error in handleSuccessfulSubmission:', error);
        sendResponse({status: 'error', error: error.message});
      });
    
    return true; // Keep channel open for async response
  }
  
  if (request.action === 'test_connection') {
    testGitHubConnection()
      .then((result) => {
        sendResponse(result);
      })
      .catch((error) => {
        sendResponse({success: false, error: error.message});
      });
    return true;
  }
});

// Format code using OpenRouter AI
async function formatCodeWithAI(code, language, problemName) {
  try {
    // Hardcoded OpenRouter API key
    const apiKey = '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';

    console.log('🤖 [Background] Formatting code with AI...');
    
    const prompt = `Format this ${language} code solution for LeetCode problem "${problemName}". 

CRITICAL: DO NOT CHANGE THE CODE LOGIC, STRUCTURE, OR ANY FUNCTIONALITY. ONLY FORMAT IT.

Requirements:
1. Format code with proper indentation, spacing, and style conventions for ${language}
2. Add a comment block at the TOP explaining:
   - Approach/Algorithm used
   - Time Complexity: O(...)
   - Space Complexity: O(...)
3. Add brief inline comments for complex logic
4. DO NOT modify, remove, or add any code logic
5. DO NOT change variable names, function signatures, or any code structure
6. DO NOT remove or add any code statements
7. ONLY fix indentation, spacing, and formatting
8. Ensure proper formatting (no extra blank lines, consistent spacing)

Return ONLY the formatted code with comments. Do not include markdown, explanations, or anything outside the code itself.

Original code:
\`\`\`${language}
${code}
\`\`\`

Return the formatted code (logic must remain EXACTLY the same):`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com', // Optional: for analytics
        'X-Title': 'LeetCode GitHub Pusher' // Optional: for analytics
      },
      body: JSON.stringify({
        model: 'mistralai/devstral-2512:free',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(`OpenRouter API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const formattedCode = data.choices?.[0]?.message?.content || '';

    if (!formattedCode || formattedCode.trim().length === 0) {
      console.warn('⚠️ [Background] AI returned empty response, using original code');
      return code;
    }

    // Extract code from markdown code blocks if present
    let extractedCode = formattedCode;
    const codeBlockMatch = formattedCode.match(/```(?:\w+)?\n([\s\S]*?)```/);
    if (codeBlockMatch) {
      extractedCode = codeBlockMatch[1];
    }

    console.log('✅ [Background] Code formatted successfully by AI');
    return extractedCode.trim();

  } catch (error) {
    console.error('❌ [Background] Error formatting code with AI:', error);
    console.log('ℹ️ [Background] Falling back to original code');
    return code; // Return original code on error
  }
}

// Handle successful submission
async function handleSuccessfulSubmission(problemName, code, language) {
  try {
    console.log('🔍 [Background] Starting submission process...');
    
    // Get GitHub token from storage
    const { githubToken, githubUsername } = await chrome.storage.sync.get(['githubToken', 'githubUsername']);

    if (!githubToken || !githubUsername) {
      console.error('❌ [Background] GitHub token or username not configured');
      showNotification('GitHub token or username not configured. Please check extension settings.', 'error');
      return;
    }

    console.log('✅ [Background] Credentials found for user:', githubUsername);

    // Check if repository exists, create if it doesn't
    console.log('🔍 [Background] Checking if repository exists...');
    const repoExists = await checkRepositoryExists(githubUsername, githubToken);
    if (!repoExists) {
      console.log('📦 [Background] Repository does not exist, creating it...');
      await createRepository(githubUsername, githubToken);
      console.log('✅ [Background] Repository created successfully!');
    } else {
      console.log('✅ [Background] Repository exists');
    }

    // Format code with AI if API key is available
    let finalCode = code;
    try {
      finalCode = await formatCodeWithAI(code, language, problemName);
    } catch (error) {
      console.warn('⚠️ [Background] AI formatting failed, using original code:', error);
      // Continue with original code
    }

    const fileName = `${problemName}.${LANGUAGE_EXTENSIONS[language] || 'txt'}`;
    const filePath = `solutions/${fileName}`;

    console.log('📁 [Background] Target file:', filePath);

    // Check if file exists
    console.log('🔍 [Background] Checking if file exists...');
    const existingFile = await getFileContent(githubUsername, filePath, githubToken);

    // Prepare file content
    const fileContent = {
      message: `Add solution for ${problemName}`,
      content: btoa(finalCode),
      branch: 'main'
    };

    if (existingFile) {
      console.log('📝 [Background] File exists, will update');
      // Update existing file
      fileContent.sha = existingFile.sha;
      fileContent.message = `Update solution for ${problemName}`;
    } else {
      console.log('✨ [Background] New file, will create');
    }

    // Create or update file
    console.log('🚀 [Background] Uploading to GitHub...');
    const result = await createOrUpdateFile(githubUsername, filePath, fileContent, githubToken);
    console.log('✅ [Background] Upload successful!', result);

    showNotification(`Successfully pushed ${problemName} to GitHub!`, 'success');

  } catch (error) {
    console.error('❌ [Background] Error pushing to GitHub:', error);
    console.error('❌ [Background] Error details:', {
      message: error.message,
      stack: error.stack,
      response: error.response
    });
    showNotification(`Failed to push to GitHub: ${error.message}`, 'error');
    throw error; // Re-throw for caller to handle
  }
}

// Check if repository exists
async function checkRepositoryExists(owner, token) {
  try {
    const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${REPO_NAME}`, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (response.status === 404) {
      return false; // Repository doesn't exist
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error('❌ [Background] Error checking repository:', error);
      return false;
    }

    return true; // Repository exists
  } catch (error) {
    console.error('❌ [Background] Error checking repository existence:', error);
    return false;
  }
}

// Create repository on GitHub
async function createRepository(owner, token) {
  try {
    const response = await fetch(`${GITHUB_API_BASE}/user/repos`, {
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: REPO_NAME,
        description: 'LeetCode solutions - automatically pushed from browser extension',
        private: false, // Set to true if you want private repo
        auto_init: true, // Initialize with README
        license_template: 'mit' // Optional: add MIT license
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({message: response.statusText}));
      console.error('❌ [Background] Error creating repository:', error);
      
      let errorMessage = error.message || response.statusText;
      if (response.status === 422) {
        // Repository might already exist or name is invalid
        if (errorMessage.includes('already exists') || errorMessage.includes('name already exists')) {
          console.log('ℹ️ [Background] Repository might already exist, continuing...');
          return; // Repository might have been created between check and creation
        }
        errorMessage = `Cannot create repository: ${errorMessage}. Repository name might be invalid or already exists.`;
      } else if (response.status === 401 || response.status === 403) {
        errorMessage = 'Token does not have permission to create repositories. Please ensure your token has "repo" scope.';
      }
      
      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log('✅ [Background] Repository created:', result.full_name);
    return result;
  } catch (error) {
    console.error('❌ [Background] Error creating repository:', error);
    throw error;
  }
}

// Get file content from GitHub
async function getFileContent(owner, path, token) {
  const url = `${GITHUB_API_BASE}/repos/${owner}/${REPO_NAME}/contents/${path}`;
  console.log('🌐 [Background] GET request to:', url);
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json'
    }
  });

  console.log('📡 [Background] Response status:', response.status);

  if (response.status === 404) {
    console.log('ℹ️ [Background] File does not exist (404)');
    return null; // File doesn't exist
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('❌ [Background] GET error:', errorData);
    
    // Provide more helpful error messages
    let errorMessage = errorData.message || response.statusText;
    if (response.status === 401 || response.status === 403) {
      if (errorMessage.includes('Resource not accessible') || errorMessage.includes('Bad credentials')) {
        errorMessage = 'Token does not have required permissions. Please ensure your token has the "repo" scope and access to the repository.';
      } else if (errorMessage.includes('Bad credentials')) {
        errorMessage = 'Invalid token. Please check your GitHub Personal Access Token.';
      }
    } else if (response.status === 404) {
      errorMessage = `Repository "${REPO_NAME}" not found. Please create it first.`;
    }
    
    throw new Error(errorMessage);
  }

  return await response.json();
}

// Create or update file on GitHub
async function createOrUpdateFile(owner, path, fileData, token) {
  const url = `${GITHUB_API_BASE}/repos/${owner}/${REPO_NAME}/contents/${path}`;
  console.log('🌐 [Background] PUT request to:', url);
  
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(fileData)
  });

  console.log('📡 [Background] PUT response status:', response.status);

  if (!response.ok) {
    const error = await response.json().catch(() => ({message: response.statusText}));
    console.error('❌ [Background] PUT error:', error);
    
    // Provide more helpful error messages
    let errorMessage = error.message || response.statusText;
    if (response.status === 401 || response.status === 403) {
      if (errorMessage.includes('Resource not accessible') || errorMessage.includes('Bad credentials')) {
        errorMessage = 'Token does not have required permissions. Please ensure your token has the "repo" scope and access to the repository.';
      } else if (errorMessage.includes('Bad credentials')) {
        errorMessage = 'Invalid token. Please check your GitHub Personal Access Token.';
      } else if (errorMessage.includes('Resource not accessible')) {
        errorMessage = 'Token lacks repository access. Make sure:\n1. Token has "repo" scope\n2. Repository exists and is accessible\n3. Token is not expired';
      }
    } else if (response.status === 404) {
      errorMessage = `Repository "${REPO_NAME}" not found. Please create it first at https://github.com/new`;
    }
    
    throw new Error(errorMessage);
  }

  const result = await response.json();
  console.log('✅ [Background] PUT successful:', result);
  return result;
}

// Test GitHub connection
async function testGitHubConnection() {
  const { githubToken, githubUsername } = await chrome.storage.sync.get(['githubToken', 'githubUsername']);
  
  if (!githubToken || !githubUsername) {
    return { success: false, error: 'GitHub credentials not configured' };
  }

  try {
    // First test token validity by getting user info
    const userResponse = await fetch(`${GITHUB_API_BASE}/user`, {
      headers: {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!userResponse.ok) {
      const userError = await userResponse.json().catch(() => ({}));
      if (userResponse.status === 401) {
        return { 
          success: false, 
          error: 'Invalid token. Please check your GitHub Personal Access Token.' 
        };
      }
      return { 
        success: false, 
        error: `Token validation failed: ${userResponse.status} ${userError.message || ''}` 
      };
    }

    // Test repository access
    const response = await fetch(`${GITHUB_API_BASE}/repos/${githubUsername}/${REPO_NAME}`, {
      headers: {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      let errorMessage = error.message || response.statusText;
      
      if (response.status === 404) {
        errorMessage = `Repository "${REPO_NAME}" not found. Please create it at https://github.com/new (name it exactly "leetcode")`;
      } else if (response.status === 403) {
        if (errorMessage.includes('Resource not accessible')) {
          errorMessage = 'Token does not have "repo" scope. Please regenerate your token with "repo" permissions at https://github.com/settings/tokens';
        } else {
          errorMessage = `Access denied: ${errorMessage}. Check token permissions.`;
        }
      } else if (response.status === 401) {
        errorMessage = 'Invalid or expired token. Please regenerate your token.';
      }
      
      return { 
        success: false, 
        error: errorMessage
      };
    }

    return { success: true, message: 'Connection successful! Repository is accessible.' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Show notification
function showNotification(message, type = 'info') {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icon128.png',
    title: 'LeetCode GitHub Pusher',
    message: message
  });
}

// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('LeetCode GitHub Pusher extension installed');
});
