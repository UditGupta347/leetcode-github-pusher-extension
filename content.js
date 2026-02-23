// Content script to detect successful LeetCode submissions

let lastSubmissionTime = 0;
const SUBMISSION_COOLDOWN = 15000; // 15 seconds to prevent duplicate submissions
let submittedProblems = new Set(); // Track submitted problem+language combinations
let isProcessing = false; // Flag to prevent multiple simultaneous processing
let lastSubmissionKey = ''; // Track the last submission to prevent immediate duplicates

// Function to extract problem name from URL
function getProblemName() {
  const url = window.location.href;
  const match = url.match(/\/problems\/([^\/]+)/);
  const problemName = match ? match[1].replace(/-/g, '_') : 'unknown_problem';
  
  // Validate that we're on a LeetCode problem page
  if (problemName === 'unknown_problem' || !url.includes('leetcode.com/problems/')) {
    console.warn('⚠️ [LeetCode Pusher] Not on a valid LeetCode problem page');
    return null;
  }
  
  return problemName;
}

// Function to clean and normalize code formatting
function cleanCode(code) {
  if (!code) return code;
  
  const lines = code.split('\n');
  const cleanedLines = [];
  let lastWasEmpty = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const isEmpty = trimmed === '';
    
    // Skip excessive consecutive empty lines (max 1 empty line)
    if (isEmpty) {
      if (!lastWasEmpty && i > 0 && i < lines.length - 1) {
        // Allow one empty line, but not at the very start or end
        cleanedLines.push('');
        lastWasEmpty = true;
      }
      // Skip additional empty lines
      continue;
    }
    
    // Preserve the line with its original indentation (trimmed of trailing whitespace)
    const preservedLine = line.replace(/\s+$/, ''); // Remove trailing whitespace but keep leading
    cleanedLines.push(preservedLine);
    lastWasEmpty = false;
  }
  
  // Remove empty lines from the very start
  while (cleanedLines.length > 0 && cleanedLines[0].trim() === '') {
    cleanedLines.shift();
  }
  
  // Remove empty lines from the very end
  while (cleanedLines.length > 0 && cleanedLines[cleanedLines.length - 1].trim() === '') {
    cleanedLines.pop();
  }
  
  return cleanedLines.join('\n');
}

// Function to get the submitted code - tries multiple methods, returns FIRST successful one
function getSubmittedCode() {
  let allExtractedCodes = [];
  
  // Method 1: Try to access Monaco editor directly (BEST - gets full code, no duplicates)
  try {
    if (window.monaco && window.monaco.editor) {
      const editors = window.monaco.editor.getEditors();
      if (editors && editors.length > 0) {
        // Try all editors and get the one with the most code
        let bestCode = '';
        let bestLength = 0;
        
        for (const editor of editors) {
          try {
            const model = editor.getModel();
            if (model && model.getValue) {
              const code = model.getValue();
              allExtractedCodes.push({ source: 'Monaco model', code, length: code.trim().length });
              if (code && code.trim().length > bestLength) {
                bestCode = code;
                bestLength = code.trim().length;
              }
            }
          } catch (e) {
            console.log('⚠️ [LeetCode Pusher] Error accessing Monaco editor:', e);
          }
        }
        
        if (bestCode && bestCode.trim().length > 20) {
          console.log(`✅ [LeetCode Pusher] Code extracted from Monaco model (${bestLength} chars)`);
          return cleanCode(bestCode);
        }
      }
    }
  } catch (e) {
    console.log('⚠️ [LeetCode Pusher] Could not access Monaco editor model:', e);
  }

  // Method 2: Try textarea (including hidden ones) - often has full code, no duplicates
  try {
    const textareas = document.querySelectorAll('textarea');
    let bestTextarea = null;
    let maxLength = 0;
    
    // First pass: look for specifically named textareas
    for (const textarea of textareas) {
      if (textarea.value && textarea.value.trim().length > 0) {
        const style = window.getComputedStyle(textarea);
        // Prefer textareas that are likely to contain the code
        if (textarea.name === 'code' || 
            textarea.getAttribute('data-cy') === 'code-area' ||
            (textarea.id && textarea.id.includes('code'))) {
          if (textarea.value.trim().length > maxLength) {
            bestTextarea = textarea;
            maxLength = textarea.value.trim().length;
          }
        }
      }
    }
    
    // If we found a good textarea, use it
    if (bestTextarea && bestTextarea.value.trim().length > 20) {
      allExtractedCodes.push({ source: 'textarea', code: bestTextarea.value, length: bestTextarea.value.trim().length });
      console.log(`✅ [LeetCode Pusher] Code extracted from textarea (${bestTextarea.value.trim().length} chars)`);
      return cleanCode(bestTextarea.value);
    }
    
    // Second pass: get the longest textarea (fallback)
    for (const textarea of textareas) {
      if (textarea.value && textarea.value.trim().length > maxLength) {
        bestTextarea = textarea;
        maxLength = textarea.value.trim().length;
      }
    }
    
    if (bestTextarea && bestTextarea.value.trim().length > 20) {
      allExtractedCodes.push({ source: 'fallback textarea', code: bestTextarea.value, length: bestTextarea.value.trim().length });
      console.log(`✅ [LeetCode Pusher] Code extracted from fallback textarea (${bestTextarea.value.trim().length} chars)`);
      return cleanCode(bestTextarea.value);
    }
  } catch (e) {
    console.log('⚠️ [LeetCode Pusher] Could not extract from textarea:', e);
  }

  // Method 3: Extract from Monaco editor view lines (LAST RESORT - may have duplicates)
  // Only use this if other methods failed, and deduplicate
  try {
    const viewLines = document.querySelectorAll('.monaco-editor .view-lines .view-line');
    if (viewLines && viewLines.length > 0) {
      const seenLines = new Set();
      const uniqueLines = [];
      
      // Extract lines and remove duplicates
      for (const line of viewLines) {
        const spans = line.querySelectorAll('span');
        let lineText = '';
        
        if (spans.length > 0) {
          lineText = Array.from(spans).map(span => span.textContent || '').join('');
        } else {
          lineText = line.textContent || '';
        }
        
        const trimmed = lineText.trim();
        // Only add if not a duplicate (allow empty lines)
        if (trimmed === '' || !seenLines.has(trimmed)) {
          uniqueLines.push(lineText);
          if (trimmed !== '') {
            seenLines.add(trimmed);
          }
        }
      }
      
      const extractedCode = uniqueLines.join('\n');
      if (extractedCode && extractedCode.trim().length > 10) {
        console.log('✅ [LeetCode Pusher] Code extracted from Monaco view-lines (deduplicated)');
        return cleanCode(extractedCode);
      }
    }
  } catch (e) {
    console.log('⚠️ [LeetCode Pusher] Could not extract from view-lines:', e);
  }

  // Method 4: Try CodeMirror
  try {
    const codeMirror = document.querySelector('.CodeMirror');
    if (codeMirror && codeMirror.CodeMirror) {
      const cmCode = codeMirror.CodeMirror.getValue();
      if (cmCode && cmCode.trim().length > 10) {
        console.log('✅ [LeetCode Pusher] Code extracted from CodeMirror');
        return cleanCode(cmCode);
      }
    }
  } catch (e) {
    console.log('⚠️ [LeetCode Pusher] Could not extract from CodeMirror:', e);
  }

  // Method 5: Try Ace editor
  try {
    const aceEditor = document.querySelector('.ace_editor');
    if (aceEditor && aceEditor.env && aceEditor.env.editor) {
      const aceCode = aceEditor.env.editor.getValue();
      if (aceCode && aceCode.trim().length > 10) {
        console.log('✅ [LeetCode Pusher] Code extracted from Ace editor');
        return cleanCode(aceCode);
      }
    }
  } catch (e) {
    console.log('⚠️ [LeetCode Pusher] Could not extract from Ace editor:', e);
  }

  // Log all extraction attempts for debugging
  if (allExtractedCodes.length > 0) {
    console.warn('⚠️ [LeetCode Pusher] Found code but too short:', allExtractedCodes.map(e => ({
      source: e.source,
      length: e.length,
      preview: e.code.substring(0, 50)
    })));
  } else {
    console.warn('⚠️ [LeetCode Pusher] No code found with any method');
  }
  
  return '';
}

// Helper function to safely check if extension context is valid
function isExtensionContextValid() {
  try {
    return chrome && chrome.runtime && chrome.runtime.id;
  } catch (e) {
    return false;
  }
}

// Function to detect successful submission
function detectSuccessfulSubmission() {
  try {
    const now = Date.now();
    if (now - lastSubmissionTime < SUBMISSION_COOLDOWN) {
      return; // Prevent duplicate submissions
    }

    // Check for success indicators
    const successIndicators = [
      '.success__3Ai7', // LeetCode success class
      '[data-cy="submission-result"]', // New LeetCode UI
      '.ant-alert-success', // Ant Design success alert
      '.text-green-500', // Tailwind success text
      '.text-green-600'
    ];

    // Check for "Accepted" text
    const acceptedText = document.body.textContent.includes('Accepted') ||
                        document.body.textContent.includes('accepted');

    // Check for success elements
    const hasSuccessElement = successIndicators.some(selector => {
      return document.querySelector(selector) !== null;
    });

    // Also check for submission success message
    const successMessage = document.querySelector('.success-message') ||
                          document.querySelector('[class*="success"]') ||
                          document.querySelector('[class*="accepted"]');

    if ((hasSuccessElement || acceptedText || successMessage) && acceptedText) {
      // Prevent multiple simultaneous processing
      if (isProcessing) {
        console.log('⏭️ [LeetCode Pusher] Already processing a submission, skipping');
        return;
      }

      const problemName = getProblemName();
      
      // Validate problem name
      if (!problemName || problemName === 'unknown_problem') {
        console.warn('⚠️ [LeetCode Pusher] Invalid problem name, skipping');
        return;
      }
      
      const language = detectLanguage();
      // Use more precise timestamp to avoid collisions
      const submissionKey = `${problemName}_${language}_${now}`;
      
      // Check if this is the exact same submission as last time
      if (submissionKey === lastSubmissionKey) {
        console.log('⏭️ [LeetCode Pusher] Exact duplicate submission detected, skipping');
        return;
      }
      
      // Check if we already submitted this problem+language combination recently
      if (submittedProblems.has(submissionKey)) {
        console.log('⏭️ [LeetCode Pusher] Already submitted this problem, skipping duplicate');
        return;
      }
      
      // Check cooldown period
      if (now - lastSubmissionTime < SUBMISSION_COOLDOWN) {
        console.log(`⏭️ [LeetCode Pusher] Too soon after last submission (${Math.floor((now - lastSubmissionTime) / 1000)}s ago), skipping`);
        return;
      }

      console.log('✅ [LeetCode Pusher] Submission successful detected!');
      isProcessing = true;

      // Try multiple times with increasing delays to ensure code is available
      let attempts = 0;
      const maxAttempts = 5;
      const attemptDelay = 300; // Start with 300ms, increase each attempt
      
      const tryExtractCode = () => {
        attempts++;
        const code = getSubmittedCode();
        
        // Log code preview for debugging
        const codePreview = code.substring(0, 200).replace(/\n/g, '\\n');
        const lineCount = code.split('\n').length;
        const firstLines = code.split('\n').slice(0, 5).join('\\n');

        console.log(`📝 [LeetCode Pusher] Extraction attempt ${attempts}/${maxAttempts}:`, {
          problemName,
          language,
          codeLength: code.length,
          lineCount: lineCount,
          hasCode: !!code.trim(),
          firstLines: firstLines,
          codePreview: codePreview + (code.length > 200 ? '...' : '')
        });

        // Check if we have valid code and it's not extension code
        if (code.trim() && code.trim().length > 20) {
          // Validate that this is actual LeetCode code, not extension code
          const codeLower = code.toLowerCase();
          if (codeLower.includes('chrome.runtime') || 
              codeLower.includes('content.js') || 
              codeLower.includes('background.js') ||
              codeLower.includes('leetcode github pusher') ||
              codeLower.includes('extension context')) {
            console.warn('⚠️ [LeetCode Pusher] Detected extension code, skipping');
            isProcessing = false;
            return;
          }
          
          // We have good code, proceed
          console.log('✅ [LeetCode Pusher] Valid code extracted!');
          const currentTime = Date.now();
          lastSubmissionTime = currentTime;
          lastSubmissionKey = submissionKey;
          submittedProblems.add(submissionKey);
          
          // Clean up old entries (keep only last 20)
          if (submittedProblems.size > 20) {
            const entries = Array.from(submittedProblems);
            submittedProblems = new Set(entries.slice(-20));
          }

          // Check if extension context is still valid (safe check)
          if (!isExtensionContextValid()) {
            console.warn('⚠️ [LeetCode Pusher] Extension context invalidated. Please reload the page.');
            isProcessing = false;
            return;
          }

          // Send message to background script with error handling
          try {
            chrome.runtime.sendMessage({
              action: 'submission_success',
              problemName: problemName,
              code: code,
              language: language
            }, (response) => {
              // Check for errors in the callback
              if (chrome.runtime.lastError) {
                const error = chrome.runtime.lastError.message;
                if (error && error.includes('Extension context invalidated')) {
                  console.warn('⚠️ [LeetCode Pusher] Extension was reloaded. Please refresh the page to continue.');
                } else {
                  console.error('❌ [LeetCode Pusher] Error sending message:', chrome.runtime.lastError);
                }
                // Remove from set on error so it can retry
                submittedProblems.delete(submissionKey);
              } else {
                console.log('✅ [LeetCode Pusher] Message sent to background script:', response);
              }
              isProcessing = false; // Reset processing flag
            });
          } catch (error) {
            if (error && error.message && error.message.includes('Extension context invalidated')) {
              console.warn('⚠️ [LeetCode Pusher] Extension context invalidated. Please reload the page.');
            } else {
              console.error('❌ [LeetCode Pusher] Error sending message:', error);
            }
            // Remove from set on error so it can retry
            submittedProblems.delete(submissionKey);
            isProcessing = false; // Reset processing flag
          }
        } else {
          // Code not ready yet, try again
          if (attempts < maxAttempts) {
            console.log(`⏳ [LeetCode Pusher] Code not ready (${code.trim().length} chars), retrying in ${attemptDelay * attempts}ms...`);
            setTimeout(tryExtractCode, attemptDelay * attempts);
          } else {
            console.warn('⚠️ [LeetCode Pusher] Could not extract valid code after all attempts');
            isProcessing = false; // Reset processing flag
          }
        }
      };
      
      // Start first attempt after initial delay
      setTimeout(tryExtractCode, 500);
    }
  } catch (error) {
    // Catch any errors that might occur, especially extension context errors
    if (error && error.message && error.message.includes('Extension context invalidated')) {
      console.warn('⚠️ [LeetCode Pusher] Extension context invalidated. Please reload the page.');
    } else {
      console.error('❌ [LeetCode Pusher] Error in detectSuccessfulSubmission:', error);
    }
  }
}

// Function to detect programming language
function detectLanguage() {
  // Method 1: Check URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const lang = urlParams.get('lang');
  if (lang) {
    console.log('🌐 [LeetCode Pusher] Language from URL:', lang);
    return normalizeLanguage(lang);
  }

  // Method 2: Check Monaco editor language (MOST RELIABLE for LeetCode)
  try {
    if (window.monaco && window.monaco.editor) {
      const editors = window.monaco.editor.getEditors();
      if (editors && editors.length > 0) {
        for (const editor of editors) {
          try {
            const model = editor.getModel();
            if (model && model.getLanguageId) {
              const langId = model.getLanguageId();
              if (langId && langId !== 'plaintext') {
                console.log('🌐 [LeetCode Pusher] Language from Monaco:', langId);
                return normalizeLanguage(langId);
              }
            }
          } catch (e) {
            // Continue to next editor
          }
        }
      }
    }
  } catch (e) {
    console.log('⚠️ [LeetCode Pusher] Error checking Monaco language:', e);
  }

  // Method 3: Check LeetCode's language selector (new UI)
  try {
    // Try multiple selectors for language dropdown
    const langSelectors = [
      '[data-cy="lang-select"]',
      'select[data-cy="lang-select"]',
      '.language-select',
      'select.language-select'
    ];
    
    for (const selector of langSelectors) {
      const langSelect = document.querySelector(selector);
      if (langSelect) {
        // Check for selected option
        const selectedOption = langSelect.querySelector('option[selected]') || 
                             langSelect.querySelector('option:checked') ||
                             langSelect.querySelector('option[value]:checked');
        if (selectedOption) {
          const lang = selectedOption.value || selectedOption.getAttribute('value') || selectedOption.textContent.trim().toLowerCase();
          if (lang) {
            console.log('🌐 [LeetCode Pusher] Language from lang-select option:', lang);
            return normalizeLanguage(lang);
          }
        }
        // Check current value
        if (langSelect.value) {
          console.log('🌐 [LeetCode Pusher] Language from lang-select value:', langSelect.value);
          return normalizeLanguage(langSelect.value);
        }
      }
    }
  } catch (e) {
    console.log('⚠️ [LeetCode Pusher] Error checking lang-select:', e);
  }

  // Method 4: Check language dropdown button (LeetCode UI)
  try {
    const langButtonSelectors = [
      'button[data-cy="lang-select"]',
      '.lang-select-button',
      '[class*="lang-select"]',
      '[aria-label*="language"]',
      '[aria-label*="Language"]'
    ];
    
    for (const selector of langButtonSelectors) {
      const langButton = document.querySelector(selector);
      if (langButton) {
        const langText = langButton.textContent.trim().toLowerCase() || 
                        langButton.getAttribute('aria-label')?.toLowerCase() ||
                        langButton.title?.toLowerCase();
        if (langText && langText !== 'select language' && langText.length < 20) {
          console.log('🌐 [LeetCode Pusher] Language from button:', langText);
          const detected = normalizeLanguage(langText);
          if (detected !== 'javascript') { // Only use if not default
            return detected;
          }
        }
      }
    }
  } catch (e) {
    console.log('⚠️ [LeetCode Pusher] Error checking lang button:', e);
  }

  // Method 5: Try to detect from code content (IMPORTANT FALLBACK)
  try {
    const code = getSubmittedCode();
    if (code && code.trim().length > 10) {
      const codeUpper = code.toUpperCase();
      const codeLower = code.toLowerCase();
      
      // Java detection (more specific)
      if (code.includes('public class Solution') || 
          code.includes('class Solution') && (code.includes('public static void main') || code.includes('public int') || code.includes('public String'))) {
        console.log('🌐 [LeetCode Pusher] Language detected from code: Java');
        return 'java';
      }
      
      // C++ detection (more specific)
      if (code.includes('#include') || 
          code.includes('using namespace std') ||
          code.includes('vector<') || 
          code.includes('std::') ||
          (code.includes('class Solution') && code.includes('public:'))) {
        console.log('🌐 [LeetCode Pusher] Language detected from code: C++');
        return 'cpp';
      }
      
      // Python detection
      if (code.includes('def ') || code.includes('class Solution:') || code.includes('import ')) {
        console.log('🌐 [LeetCode Pusher] Language detected from code: Python');
        return 'python';
      }
      
      // JavaScript/TypeScript detection
      if (code.includes('function ') || code.includes('const ') || code.includes('let ') || code.includes('var ')) {
        if (code.includes('interface ') || code.includes(': string') || code.includes(': number')) {
          console.log('🌐 [LeetCode Pusher] Language detected from code: TypeScript');
          return 'typescript';
        }
        console.log('🌐 [LeetCode Pusher] Language detected from code: JavaScript');
        return 'javascript';
      }
      
      // C detection
      if (code.includes('#include') && !code.includes('using namespace') && !code.includes('vector<')) {
        console.log('🌐 [LeetCode Pusher] Language detected from code: C');
        return 'c';
      }
      
      // Go detection
      if (code.includes('func ') && code.includes('package ')) {
        console.log('🌐 [LeetCode Pusher] Language detected from code: Go');
        return 'go';
      }
    }
  } catch (e) {
    console.log('⚠️ [LeetCode Pusher] Error in code-based detection:', e);
  }

  // Method 6: Check for language indicators in the page
  try {
    const langIndicators = [
      '[data-lang]',
      '[class*="language-"]',
      '[class*="lang-"]'
    ];
    
    for (const selector of langIndicators) {
      const element = document.querySelector(selector);
      if (element) {
        const lang = element.getAttribute('data-lang') || 
                    element.className.match(/language-(\w+)/)?.[1] ||
                    element.className.match(/lang-(\w+)/)?.[1];
        if (lang) {
          console.log('🌐 [LeetCode Pusher] Language from indicator:', lang);
          return normalizeLanguage(lang);
        }
      }
    }
  } catch (e) {
    console.log('⚠️ [LeetCode Pusher] Error checking language indicators:', e);
  }

  console.warn('⚠️ [LeetCode Pusher] Could not detect language, defaulting to javascript');
  return 'javascript'; // default fallback
}

// Normalize language name to match our mapping
function normalizeLanguage(lang) {
  if (!lang) return 'javascript';
  
  const normalized = lang.toLowerCase().trim();
  
  // Map common variations (including Monaco language IDs)
  const langMap = {
    'javascript': 'javascript',
    'js': 'javascript',
    'typescript': 'typescript',
    'ts': 'typescript',
    'python': 'python',
    'python3': 'python',
    'py': 'python',
    'java': 'java',
    'cpp': 'cpp',
    'c++': 'cpp',
    'cplusplus': 'cpp',
    'cpp17': 'cpp',
    'cpp14': 'cpp',
    'c': 'c',
    'csharp': 'csharp',
    'c#': 'csharp',
    'csharp': 'csharp',
    'php': 'php',
    'ruby': 'ruby',
    'rb': 'ruby',
    'swift': 'swift',
    'go': 'go',
    'golang': 'go',
    'scala': 'scala',
    'kotlin': 'kotlin',
    'kt': 'kotlin',
    'rust': 'rust',
    'rs': 'rust'
  };

  // Check direct match
  if (langMap[normalized]) {
    return langMap[normalized];
  }

  // Check partial matches
  for (const [key, value] of Object.entries(langMap)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return value;
    }
  }

  // Return as-is if no mapping found
  return normalized;
}

// Monitor for submission results using MutationObserver
// Use debouncing to prevent multiple rapid calls
let observerTimeout = null;
const observer = new MutationObserver((mutations) => {
  try {
    // Check if extension context is still valid before processing
    if (!isExtensionContextValid()) {
      console.warn('⚠️ [LeetCode Pusher] Extension context invalidated. Stopping observer.');
      observer.disconnect();
      return;
    }
    
    // Debounce: only process after mutations stop for 500ms
    if (observerTimeout) {
      clearTimeout(observerTimeout);
    }
    
    observerTimeout = setTimeout(() => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' || mutation.type === 'subtree') {
          detectSuccessfulSubmission();
        }
      });
    }, 500);
  } catch (error) {
    if (error && error.message && error.message.includes('Extension context invalidated')) {
      console.warn('⚠️ [LeetCode Pusher] Extension context invalidated. Stopping observer.');
      observer.disconnect();
    } else {
      console.error('❌ [LeetCode Pusher] Observer error:', error);
    }
  }
});

// Start observing when page loads
function initializeObserver() {
  const targetNode = document.body;
  const config = {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style']
  };

  observer.observe(targetNode, config);
  console.log('LeetCode GitHub Pusher: Observer initialized');
}

// Also check periodically for submissions (fallback)
// Wrap in try-catch to handle extension reloads
// Increased interval to reduce duplicate triggers
let intervalId = setInterval(() => {
  try {
    // Check if extension context is still valid (safe check)
    if (!isExtensionContextValid()) {
      console.warn('⚠️ [LeetCode Pusher] Extension context invalidated. Stopping interval.');
      clearInterval(intervalId);
      return;
    }
    
    // Only check if not currently processing
    if (!isProcessing) {
      detectSuccessfulSubmission();
    }
  } catch (error) {
    if (error && error.message && error.message.includes('Extension context invalidated')) {
      console.warn('⚠️ [LeetCode Pusher] Extension context invalidated. Stopping interval.');
      clearInterval(intervalId);
    } else {
      console.error('❌ [LeetCode Pusher] Interval error:', error);
    }
  }
}, 3000); // Increased from 2000ms to 3000ms to reduce frequency

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeObserver);
} else {
  initializeObserver();
}
