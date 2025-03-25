# SO Lightview

This repo allows users to interact with lightcurves in the browser.

## How to run dev server locally

Users can run this locally by following [the README in simonsobs/lightserve](https://github.com/simonsobs/lightserve) to run the server (requires Docker Desktop, as well).

Once the server is running locally, do the following:

```js
    git clone git@github.com:simonsobs/lightserve.git
    cd lightserve
    npm install
    npm run dev
```

**Note**: The client is expecting the server to be running at `http://127.0.0.1:8000` via [this line of code](https://github.com/simonsobs/lightview/blob/6eb96c8c239b9d7a51dac6aabde76bcf77147862/src/configs/constants.ts#L1). Ensure the `SERVICE_URL` matches `lightserve`'s URL.
