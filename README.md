# SO Light Curve Viewer

This repo allows users to interact with lightcurves in the browser.

## Documentation

Please refer to the documentation at [lightview.readthedocs.io](https://lightview.readthedocs.io/en/latest/index.html) to learn how to run, configure, and release the application.

To build the docs locally:

```sh
python -m venv .venv && source .venv/bin/activate
pip install -r docs/requirements.txt
make -C docs html
```

Then open `docs/_build/html/index.html`.
