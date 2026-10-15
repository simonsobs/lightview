# Releases

The [build-and-push workflow](https://github.com/simonsobs/lightview/blob/main/.github/workflows/build-and-push.yml) builds and pushes the `latest` image on every push to `main`. Stable releases use version tags in the form `vMAJOR.MINOR.PATCH`, such as `v0.1.0`.

## Tag and push a stable release

First, make sure you are tagging the commit you want to release. Then create and push the tag:

```bash
git tag -a v0.1.0 -m "Release v0.1.0"
git push origin v0.1.0
```

Pushing the tag triggers GitHub Actions to build and push a multi-platform image to GHCR. For the upstream repository, the image is published as:

```text
ghcr.io/simonsobs/lightview:v0.1.0
```

Check the repository's **Actions** tab to confirm that the build succeeded.
