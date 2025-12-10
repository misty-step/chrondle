after authenticating with google and navigating to the archive page the page hangs and i get a ton of browser console errors.

```
480-b3b34d8dcd40b8a6.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1 [WARN] Environment warnings {warnings: Array(1)}
warn @ 480-b3b34d8dcd40b8a6.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
(anonymous) @ layout-561c58cb89867c0f.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
52846 @ layout-561c58cb89867c0f.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
r @ webpack-225fb7f37d2d10b5.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
Promise.then
15075 @ layout-561c58cb89867c0f.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
r @ webpack-225fb7f37d2d10b5.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
r @ layout-561c58cb89867c0f.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
(anonymous) @ layout-561c58cb89867c0f.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
r.O @ webpack-225fb7f37d2d10b5.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
t @ webpack-225fb7f37d2d10b5.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
(anonymous) @ 473-c5159f7e6bbe67e2.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
content.js:1 User preferences loaded: {id: 'user-preferences', defaultCurrency: 'usd', displayMode: 'dual-display', denomination: 'dynamic', highlightBitcoinValue: false, …}
407-0bf128c862edcef4.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1 WebSocket reconnected
407-0bf128c862edcef4.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1 WebSocket reconnected
407-0bf128c862edcef4.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1 WebSocket reconnected
97-a97ecfd00b078dc0.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1 Failed to authenticate: "No auth provider found matching the given token", check your server auth config
window.console.error @ 97-a97ecfd00b078dc0.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
(anonymous) @ 407-0bf128c862edcef4.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
error @ 407-0bf128c862edcef4.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
tryToReauthenticate @ 407-0bf128c862edcef4.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:2
onAuthError @ 407-0bf128c862edcef4.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:2
onMessage @ 407-0bf128c862edcef4.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:2
e.onmessage @ 407-0bf128c862edcef4.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:2
407-0bf128c862edcef4.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1 Attempting reconnect in 1355.9367060095628ms
407-0bf128c862edcef4.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1 WebSocket reconnected
97-a97ecfd00b078dc0.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1 [CONVEX M(users:getOrCreateCurrentUser)] [Request ID: e4857d10ff562882] Server Error
window.console.error @ 97-a97ecfd00b078dc0.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
(anonymous) @ 407-0bf128c862edcef4.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
error @ 407-0bf128c862edcef4.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
c @ 407-0bf128c862edcef4.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
onResponse @ 407-0bf128c862edcef4.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:2
onMessage @ 407-0bf128c862edcef4.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:2
e.onmessage @ 407-0bf128c862edcef4.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:2
97-a97ecfd00b078dc0.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1 [UserCreationProvider] Retrying user creation (attempt 1/3): [CONVEX M(users:getOrCreateCurrentUser)] [Request ID: e4857d10ff562882] Server Error
  Called by client
window.console.error @ 97-a97ecfd00b078dc0.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
onRetry @ 736-4a4ba58c6edbaa88.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
(anonymous) @ 480-b3b34d8dcd40b8a6.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
await in (anonymous)
(anonymous) @ 736-4a4ba58c6edbaa88.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
(anonymous) @ 736-4a4ba58c6edbaa88.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
oq @ fdc226ae-2f6f8acabe58c470.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
uh @ fdc226ae-2f6f8acabe58c470.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
um @ fdc226ae-2f6f8acabe58c470.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
uh @ fdc226ae-2f6f8acabe58c470.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
um @ fdc226ae-2f6f8acabe58c470.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
uh @ fdc226ae-2f6f8acabe58c470.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
um @ fdc226ae-2f6f8acabe58c470.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
uh @ fdc226ae-2f6f8acabe58c470.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
um @ fdc226ae-2f6f8acabe58c470.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
uh @ fdc226ae-2f6f8acabe58c470.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
um @ fdc226ae-2f6f8acabe58c470.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
uh @ fdc226ae-2f6f8acabe58c470.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
um @ fdc226ae-2f6f8acabe58c470.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
uh @ fdc226ae-2f6f8acabe58c470.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
um @ fdc226ae-2f6f8acabe58c470.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
uh @ fdc226ae-2f6f8acabe58c470.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
um @ fdc226ae-2f6f8acabe58c470.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
uh @ fdc226ae-2f6f8acabe58c470.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
um @ fdc226ae-2f6f8acabe58c470.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
uh @ fdc226ae-2f6f8acabe58c470.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
um @ fdc226ae-2f6f8acabe58c470.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
uh @ fdc226ae-2f6f8acabe58c470.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
um @ fdc226ae-2f6f8acabe58c470.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
uh @ fdc226ae-2f6f8acabe58c470.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
...
um @ fdc226ae-2f6f8acabe58c470.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
uh @ fdc226ae-2f6f8acabe58c470.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
um @ fdc226ae-2f6f8acabe58c470.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
uh @ fdc226ae-2f6f8acabe58c470.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
iS @ fdc226ae-2f6f8acabe58c470.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
(anonymous) @ fdc226ae-2f6f8acabe58c470.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
w @ 97-a97ecfd00b078dc0.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
97-a97ecfd00b078dc0.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1 [CONVEX M(users:getOrCreateCurrentUser)] [Request ID: 28b53e60de7e67ae] Server Error
window.console.error @ 97-a97ecfd00b078dc0.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
(anonymous) @ 407-0bf128c862edcef4.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
error @ 407-0bf128c862edcef4.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
c @ 407-0bf128c862edcef4.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
onResponse @ 407-0bf128c862edcef4.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:2
onMessage @ 407-0bf128c862edcef4.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:2
e.onmessage @ 407-0bf128c862edcef4.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:2
97-a97ecfd00b078dc0.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1 [UserCreationHandler] Retrying user creation (attempt 2/3): [CONVEX M(users:getOrCreateCurrentUser)] [Request ID: 28b53e60de7e67ae] Server Error
  Called by client
window.console.error @ 97-a97ecfd00b078dc0.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
onRetry @ page-25d5eb4c6ee70ef9.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
(anonymous) @ 480-b3b34d8dcd40b8a6.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
await in (anonymous)
(anonymous) @ page-25d5eb4c6ee70ef9.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
(anonymous) @ page-25d5eb4c6ee70ef9.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
oq @ fdc226ae-2f6f8acabe58c470.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
uh @ fdc226ae-2f6f8acabe58c470.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
um @ fdc226ae-2f6f8acabe58c470.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
uh @ fdc226ae-2f6f8acabe58c470.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
um @ fdc226ae-2f6f8acabe58c470.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
uh @ fdc226ae-2f6f8acabe58c470.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
um @ fdc226ae-2f6f8acabe58c470.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
uh @ fdc226ae-2f6f8acabe58c470.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
um @ fdc226ae-2f6f8acabe58c470.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
uh @ fdc226ae-2f6f8acabe58c470.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
um @ fdc226ae-2f6f8acabe58c470.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
uh @ fdc226ae-2f6f8acabe58c470.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
um @ fdc226ae-2f6f8acabe58c470.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
uh @ fdc226ae-2f6f8acabe58c470.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
um @ fdc226ae-2f6f8acabe58c470.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
...
iS @ fdc226ae-2f6f8acabe58c470.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
(anonymous) @ fdc226ae-2f6f8acabe58c470.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
w @ 97-a97ecfd00b078dc0.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
97-a97ecfd00b078dc0.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1 [useMutationWithRetry] Retrying 2/3 after 1836ms
window.console.error @ 97-a97ecfd00b078dc0.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
(anonymous) @ 480-b3b34d8dcd40b8a6.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
await in (anonymous)
(anonymous) @ page-25d5eb4c6ee70ef9.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
(anonymous) @ page-25d5eb4c6ee70ef9.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
oq @ fdc226ae-2f6f8acabe58c470.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
uh @ fdc226ae-2f6f8acabe58c470.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
um @ fdc226ae-2f6f8acabe58c470.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
uh @ fdc226ae-2f6f8acabe58c470.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
um @ fdc226ae-2f6f8acabe58c470.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
uh @ fdc226ae-2f6f8acabe58c470.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
um @ fdc226ae-2f6f8acabe58c470.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
uh @ fdc226ae-2f6f8acabe58c470.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
um @ fdc226ae-2f6f8acabe58c470.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
...
(anonymous) @ fdc226ae-2f6f8acabe58c470.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
w @ 97-a97ecfd00b078dc0.js?dpl=dpl_3TGaQbpciZXN3wvCBouhjCFuWRWM:1
```
