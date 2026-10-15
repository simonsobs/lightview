# Getting Started

## Run the dev server locally

`LightView` reads its data from a [lightserve](https://github.com/simonsobs/lightserve) instance. Follow [the lightserve README](https://github.com/simonsobs/lightserve#readme) to run the server locally (this requires Docker Desktop).

Once the server is running:

1. Clone and initialize `LightView`

```sh
git clone git@github.com:simonsobs/lightview.git
cd lightview
npm install
```

2. Create a `.env.development` file by copying the contents from `.env.development.sample`. You may need to amend `VITE_SERVICE_URL` depending on what port your lightserve instance runs on. See [Configuration](configuration.md) for all available options.

3. Start the dev server

```sh
npm run dev
```

## Run the tests

```sh
npm run test:run
```
