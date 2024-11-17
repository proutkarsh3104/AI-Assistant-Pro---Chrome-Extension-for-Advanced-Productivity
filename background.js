
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'generateAI',
    title: 'Generate AI Response',
    contexts: ['selection']
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'generateAI') {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: getSelectedText
    });
  }
});

function getSelectedText() {
  const selectedText = window.getSelection().toString();
  if (selectedText) {
    chrome.runtime.sendMessage({
      action: 'processText',
      text: selectedText
    });
  }
}