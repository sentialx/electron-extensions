console.log('Sending and receiving response from background');
chrome.runtime.sendMessage('test', res => {
  if (res === 'test') console.log('PASS');
  else console.log('FAIL');
});
