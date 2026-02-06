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

// Function to extract problem description
function getProblemDescription() {
  try {
    // Try different selectors for problem description
    const descriptionSelectors = [
      '[data-track-load="description_content"]',
      '.question-content__JfgR',
      '.content__u4I7',
      '.question-description'
    ];
    
    for (const selector of descriptionSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        // Get text and clean it up (remove excessive whitespace)
        const text = element.innerText || element.textContent;
        if (text && text.trim().length > 0) {
          console.log(`✅ [LeetCode Pusher] Description extracted (${text.trim().length} chars)`);
          return text.trim();
        }
      }
    }
  } catch (e) {
    console.log('⚠️ [LeetCode Pusher] Error extracting problem description:', e);
  }
  return '';
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

// Function to get the submitted code - focuses on reliable methods
function getSubmittedCode() {
  let allExtractedCodes = [];
  
  // Method 1: Try to access Monaco editor directly (BEST - gets full code)
  // This works if the Monaco editor is exposed on the window object
  try {
    if (window.monaco && window.monaco.editor) {
      const editors = window.monaco.editor.getEditors();
      if (editors && editors.length > 0) {
        let bestCode = '';
        let bestLength = 0;
        
        for (const editor of editors) {
          try {
            const model = editor.getModel();
            if (model && model.getValue) {
              const code = model.getValue();
              if (code && code.trim().length > bestLength) {
                bestCode = code;
                bestLength = code.trim().length;
              }
            }
          } catch (e) {}
        }
        
        if (bestCode && bestCode.trim().length > 20) {
          console.log(`✅ [LeetCode Pusher] Code extracted from Monaco model (${bestLength} chars)`);
          return cleanCode(bestCode);
        }
      }
    }
  } catch (e) {
    console.log('⚠️ [LeetCode Pusher] Monaco editor model access failed:', e);
  }

  // Method 2: Try hidden textareas - LeetCode often keeps the full code in a hidden textarea
  try {
    const textareas = document.querySelectorAll('textarea');
    let bestTextarea = null;
    let maxLength = 0;
    
    for (const textarea of textareas) {
      const val = textarea.value || '';
      const len = val.trim().length;
      
      // Specifically check for code-related textareas first
      if (textarea.name === 'code' || 
          textarea.getAttribute('data-cy') === 'code-area' ||
          (textarea.id && textarea.id.includes('code'))) {
        if (len > 20) {
          console.log(`✅ [LeetCode Pusher] Code extracted from targeted textarea (${len} chars)`);
          return cleanCode(val);
        }
      }
      
      if (len > maxLength) {
        bestTextarea = textarea;
        maxLength = len;
      }
    }
    
    if (bestTextarea && maxLength > 20) {
      console.log(`✅ [LeetCode Pusher] Code extracted from longest textarea (${maxLength} chars)`);
      return cleanCode(bestTextarea.value);
    }
  } catch (e) {
    console.log('⚠️ [LeetCode Pusher] Textarea extraction failed:', e);
  }

  // Method 3: Try CodeMirror/Ace fallbacks
  try {
    const codeMirror = document.querySelector('.CodeMirror');
    if (codeMirror && codeMirror.CodeMirror) {
      const cmCode = codeMirror.CodeMirror.getValue();
      if (cmCode && cmCode.trim().length > 20) {
        console.log('✅ [LeetCode Pusher] Code extracted from CodeMirror');
        return cleanCode(cmCode);
      }
    }

    const aceEditor = document.querySelector('.ace_editor');
    if (aceEditor && aceEditor.env && aceEditor.env.editor) {
      const aceCode = aceEditor.env.editor.getValue();
      if (aceCode && aceCode.trim().length > 20) {
        console.log('✅ [LeetCode Pusher] Code extracted from Ace editor');
        return cleanCode(aceCode);
      }
    }
  } catch (e) {}

  console.warn('⚠️ [LeetCode Pusher] No full code found using reliable methods');
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
    
    // Check for success indicators in the DOM
    const successIndicators = [
      '.success__3Ai7', 
      '[data-cy="submission-result-success"]',
      '.ant-alert-success',
      '.text-green-500',
      '.text-green-600'
    ];

    const hasSuccessElement = successIndicators.some(selector => {
      const el = document.querySelector(selector);
      return el && (el.innerText.includes('Accepted') || el.textContent.includes('Accepted'));
    });

    // Fallback text-based check
    const acceptedText = document.body.textContent.includes('Accepted');

    if (hasSuccessElement || acceptedText) {
      if (isProcessing) return;

      const problemName = getProblemName();
      if (!problemName || problemName === 'unknown_problem') return;
      
      const language = detectLanguage();
      // Only track one submission per problem+language per short period
      const submissionKey = `${problemName}_${language}`;
      
      // Prevent duplicates: must be a new submission or significantly later
      if (submittedProblems.has(submissionKey) && (now - lastSubmissionTime < 30000)) {
        return;
      }
      
      console.log('✅ [LeetCode Pusher] Successful submission detected for:', problemName);
      isProcessing = true;
      lastSubmissionTime = now;
      submittedProblems.add(submissionKey);

      // Brief delay to ensure state is updated
      setTimeout(() => {
        const code = getSubmittedCode();
        
        if (code && code.trim().length > 20) {
          console.log('✅ [LeetCode Pusher] Full code extracted, sending to background...');
          
          chrome.runtime.sendMessage({
            action: 'submission_success',
            problemName: problemName,
            problemDescription: getProblemDescription(),
            code: code,
            language: language
          }, (response) => {
            isProcessing = false;
            if (chrome.runtime.lastError) {
              console.error('❌ [LeetCode Pusher] Message error:', chrome.runtime.lastError);
              submittedProblems.delete(submissionKey); // Allow retry on error
            }
          });
        } else {
          console.warn('⚠️ [LeetCode Pusher] Could not extract valid code');
          isProcessing = false;
          submittedProblems.delete(submissionKey);
        }
      }, 1000);
    }
  } catch (error) {
    console.error('❌ [LeetCode Pusher] Detection error:', error);
    isProcessing = false;
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
