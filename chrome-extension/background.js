// Listen for any request to headers related to Trae API
chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    for (const header of details.requestHeaders) {
      if (header.name.toLowerCase() === 'authorization') {
        const token = header.value.replace('Cloud-IDE-JWT ', '');
        if (token && token.length > 50) {
          // Save the fresh token to storage
          chrome.storage.local.set({ traeToken: token }, () => {
            console.log("Trae Token captured and updated!");
          });
        }
      }
    }
  },
  { urls: ["https://*.trae.ai/*"] },
  ["requestHeaders"]
);
