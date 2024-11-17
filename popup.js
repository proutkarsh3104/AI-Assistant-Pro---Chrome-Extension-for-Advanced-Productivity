// Constants
const API_KEY = 'YOUR-API-KEY';
const MAX_CHARS = 5000;

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
  // Initialize DOM elements
  const inputText = document.getElementById('inputText');
  const generateBtn = document.getElementById('generateBtn');
  const resultDiv = document.getElementById('result');
  const charCount = document.querySelector('.char-count');
  const modeBtns = document.querySelectorAll('.mode-btn');
  const historyPanel = document.getElementById('history-panel');
  const historyList = document.getElementById('history-list');
  const controls = document.querySelectorAll('.controls');

  let currentMode = 'generate';

  // Initialize mode buttons
  modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // Remove active class from all buttons
      modeBtns.forEach(b => b.classList.remove('active'));
      // Add active class to clicked button
      btn.classList.add('active');
      currentMode = btn.dataset.mode;

      // Update button text based on current mode
      updateButtonText();

      // Hide all controls first
      controls.forEach(control => control.style.display = 'none');
      
      // Show appropriate elements based on mode
      if (currentMode === 'history') {
        showHistory();
        document.querySelector('.input-container').style.display = 'none';
        document.querySelector('.settings-panel').style.display = 'none';
        generateBtn.style.display = 'none';
        resultDiv.style.display = 'none';
        historyPanel.style.display = 'block';
      } else {
        showMainInterface();
        const controlsDiv = document.querySelector(`.${currentMode}-controls`);
        if (controlsDiv) controlsDiv.style.display = 'block';
      }
    });
  });

  // Character count handler
  inputText.addEventListener('input', () => {
    const length = inputText.value.length;
    charCount.textContent = `${length}/${MAX_CHARS}`;
    generateBtn.disabled = length > MAX_CHARS;
    charCount.style.color = length > MAX_CHARS ? '#d32f2f' : '#666';
  });

  // Generate button handler
  generateBtn.addEventListener('click', async () => {
    const text = inputText.value.trim();
    if (!text) return;

    if (text.length > MAX_CHARS) {
      resultDiv.innerHTML = `
        <div class="error">
          <i class="fas fa-exclamation-circle"></i> Error: Text exceeds ${MAX_CHARS} characters limit
        </div>
      `;
      return;
    }

    try {
      // Show loading state
      generateBtn.disabled = true;
      
      // Updated loading animation
      generateBtn.innerHTML = `
        <div class="loading-spinner">
          <div class="spinner"></div>
        </div>
      `;
      
      resultDiv.textContent = 'Generating response...';

      // Get mode-specific parameters
      const params = getModeParameters();
      let finalPrompt = text;

      // Modify prompt based on mode
      switch (currentMode) {
        case 'translate':
          finalPrompt = `Translate the following text from ${params.fromLang} to ${params.toLang}:\n\n${text}`;
          break;
        case 'explain':
          finalPrompt = `Explain the following ${params.language} code ${params.detail === 'technical' ? 'with technical details' : 'in ' + params.detail + ' terms'}:\n\n${text}`;
          break;
        case 'brainstorm':
          finalPrompt = `Generate ${params.count} ${params.type} related to:\n\n${text}`;
          break;
      }

      // Call API and get response
      const response = await callGeminiAPI(finalPrompt);
      
      // Save to history
      await saveToHistory(text, response, currentMode);

      // Display result
      resultDiv.innerHTML = `
        <button class="copy-btn" onclick="copyToClipboard()">
          <i class="fas fa-copy"></i> Copy
        </button>
        <div class="response-text">${formatResponse(response)}</div>
        <div class="success-message">
          <i class="fas fa-check-circle"></i> Response generated successfully!
        </div>
      `;

    } catch (error) {
      console.error('Error:', error);
      resultDiv.innerHTML = `
        <div class="error">
          <i class="fas fa-exclamation-circle"></i> Error: ${error.message}
        </div>
      `;
    } finally {
      // Reset button state with correct text
      generateBtn.disabled = false;
      updateButtonText();
    }
  });

  // Helper Functions
  function updateButtonText() {
    const buttonText = getButtonText();
    generateBtn.innerHTML = `<i class="fas fa-robot"></i><span class="btn-text">${buttonText}</span>`;
  }

  function showMainInterface() {
    historyPanel.style.display = 'none';
    document.querySelector('.input-container').style.display = 'block';
    document.querySelector('.settings-panel').style.display = 'block';
    generateBtn.style.display = 'block';
    resultDiv.style.display = 'block';
  }

  async function showHistory() {
    try {
      // First, check if we're in a Chrome extension context
      if (typeof chrome !== 'undefined' && chrome.storage) {
        const history = await new Promise((resolve, reject) => {
          chrome.storage.local.get('aiHistory', (result) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(result);
            }
          });
        });
        
        const aiHistory = history.aiHistory || [];
        displayHistory(aiHistory);
      } else {
        // Fallback to localStorage if not in Chrome extension
        const historyString = localStorage.getItem('aiHistory');
        const aiHistory = historyString ? JSON.parse(historyString) : [];
        displayHistory(aiHistory);
      }
    } catch (error) {
      console.error('Error loading history:', error);
      historyList.innerHTML = `
        <div class="error">
          <i class="fas fa-exclamation-circle"></i> Error loading history: ${error.message}
        </div>
      `;
    }
  }

  function displayHistory(aiHistory) {
    if (aiHistory.length === 0) {
      historyList.innerHTML = `
        <div class="empty-history">
          <i class="fas fa-history"></i>
          <p>No history yet</p>
        </div>
      `;
      return;
    }

    historyList.innerHTML = aiHistory.map((item, index) => `
      <div class="history-item" data-index="${index}">
        <div class="history-header">
          <span class="mode-tag">${item.mode}</span>
          <span class="timestamp">${new Date(item.timestamp).toLocaleString()}</span>
        </div>
        <div class="prompt">${escapeHtml(item.prompt.substring(0, 50))}${item.prompt.length > 50 ? '...' : ''}</div>
        <div class="response preview">${escapeHtml(item.response.substring(0, 100))}${item.response.length > 100 ? '...' : ''}</div>
      </div>
    `).join('');

    // Add click handlers to history items
    document.querySelectorAll('.history-item').forEach(item => {
      item.addEventListener('click', () => {
        const index = parseInt(item.dataset.index);
        const historyItem = aiHistory[index];
        
        // Switch to the appropriate mode
        currentMode = historyItem.mode;
        modeBtns.forEach(btn => {
          btn.classList.toggle('active', btn.dataset.mode === currentMode);
        });
        
        // Show main interface with historical data
        showMainInterface();
        inputText.value = historyItem.prompt;
        resultDiv.innerHTML = `
          <button class="copy-btn" onclick="copyToClipboard()">
            <i class="fas fa-copy"></i> Copy
          </button>
          <div class="response-text">${formatResponse(historyItem.response)}</div>
        `;
        
        // Update character count
        const length = historyItem.prompt.length;
        charCount.textContent = `${length}/${MAX_CHARS}`;
        charCount.style.color = length > MAX_CHARS ? '#d32f2f' : '#666';
        
        // Update button text for the current mode
        updateButtonText();
      });
    });
  }

  async function saveToHistory(prompt, response, mode) {
    try {
      const historyItem = {
        prompt,
        response,
        mode,
        timestamp: Date.now()
      };

      if (typeof chrome !== 'undefined' && chrome.storage) {
        // Chrome extension storage
        const history = await new Promise((resolve) => {
          chrome.storage.local.get('aiHistory', resolve);
        });
        const aiHistory = history.aiHistory || [];
        aiHistory.unshift(historyItem);
        
        // Keep only last 20 items
        if (aiHistory.length > 20) {
          aiHistory.pop();
        }
        
        await new Promise((resolve, reject) => {
          chrome.storage.local.set({ aiHistory }, () => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve();
            }
          });
        });
      } else {
        // Fallback to localStorage
        const historyString = localStorage.getItem('aiHistory');
        const aiHistory = historyString ? JSON.parse(historyString) : [];
        aiHistory.unshift(historyItem);
        
        // Keep only last 20 items
        if (aiHistory.length > 20) {
          aiHistory.pop();
        }
        
        localStorage.setItem('aiHistory', JSON.stringify(aiHistory));
      }
    } catch (error) {
      console.error('Error saving to history:', error);
      throw new Error('Failed to save to history');
    }
  }

  function getModeParameters() {
    const params = {
      translate: {
        fromLang: document.getElementById('fromLanguage')?.value || 'auto',
        toLang: document.getElementById('toLanguage')?.value || 'en'
      },
      explain: {
        language: document.getElementById('codeLanguage')?.value || 'auto',
        detail: document.getElementById('explanationDetail')?.value || 'basic'
      },
      brainstorm: {
        type: document.getElementById('brainstormType')?.value || 'ideas',
        count: document.getElementById('ideaCount')?.value || 5
      }
    };
    return params[currentMode] || {};
  }

  function getButtonText() {
    const texts = {
      generate: 'Generate Response',
      translate: 'Translate Text',
      explain: 'Explain Code',
      brainstorm: 'Generate Ideas'
    };
    return texts[currentMode] || texts.generate;
  }

  function formatResponse(text) {
    if (currentMode === 'explain') {
      return text.replace(/```(\w+)?([\s\S]+?)```/g, 
        (_, lang, code) => `<pre><code class="${lang || ''}">${escapeHtml(code.trim())}</code></pre>`);
    }
    return text.split('\n').map(line => `<p>${escapeHtml(line)}</p>`).join('');
  }

  function escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
});

// API call function
async function callGeminiAPI(prompt) {
  const temperature = document.getElementById('temperatureSlider').value / 100;
  const lengthConfig = {
    short: 1024,
    medium: 2048,
    long: 4096
  }[document.getElementById('lengthSelect').value];

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: lengthConfig,
          stopSequences: []
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Failed to generate response');
    }

    const data = await response.json();
    if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error('Invalid response format from API');
    }

    return data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

// Copy to clipboard function (needs to be global)
window.copyToClipboard = function() {
  const responseText = document.querySelector('.response-text').textContent;
  navigator.clipboard.writeText(responseText).then(() => {
    const copyBtn = document.querySelector('.copy-btn');
    copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
    setTimeout(() => {
      copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy';
    }, 2000);
  }).catch(err => {
    console.error('Failed to copy:', err);
    alert('Failed to copy to clipboard');
  });
};