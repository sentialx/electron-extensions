const tests = [
  {
    status: false,
    msg: 'Sending and receiving response from background',
  },
  {
    status: false,
    msg: 'Receiving message from background',
  },
  {
    status: false,
    msg: 'Receiving port message from background',
  },
];

setTimeout(() => {
  chrome.runtime.sendMessage('test', res => {
    if (res === 'test') tests[0].status = true;
  });

  const port = chrome.runtime.connect({ name: 'testname' });
  port.postMessage('test');

  port.onMessage.addListener(msg => {
    if (msg === 'test') tests[2].status = true;
  });
}, 100);

chrome.runtime.onMessage.addListener((res, sender, sendResponse) => {
  if (res === 'test' && sender) tests[1].status = true;
  sendResponse('test');
});

setTimeout(() => {
  for (const test of tests) {
    console.log(`${test.msg}: ${test.status}`);
  }
}, 2000);
