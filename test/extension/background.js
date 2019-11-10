const tests = [
  {
    status: false,
    msg: 'Sending and receiving response from content script',
  },
  {
    status: false,
    msg: 'Receiving message from content script',
  },
];

setTimeout(() => {
  chrome.tabs.query({}, tabs => {
    chrome.tabs.sendMessage(tabs[0].id, 'test', res => {
      if (res === 'test') tests[0].status = true;
    });
  });
}, 50);

chrome.runtime.onMessage.addListener((res, sender, sendResponse) => {
  if (res === 'test' && sender.tab.id === 1) tests[1].status = true;
  sendResponse('test');
});

setTimeout(() => {
  for (const test of tests) {
    console.log(`${test.msg}: ${test.status}`);
  }
}, 1000);
