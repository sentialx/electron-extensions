chrome.tabs.query({}, tabs => {
  chrome.tabs.sendMessage(tabs[0].id, 'test', response => {
    if (res === 'test') console.log('PASS');
    else console.log('FAIL');
  });
});

console.log('Receiving message from content script');
chrome.runtime.onMessage.addListener((res, sender, sendResponse) => {
  if (res === 'test') console.log('PASS');
  else console.log('FAIL');
  sendResponse('test');
});
