# Configuration file for the Sphinx documentation builder.
#
# For the full list of built-in configuration values, see the documentation:
# https://www.sphinx-doc.org/en/master/usage/configuration.html

# -- Project information -----------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#project-information

project = 'LightView'
copyright = '2025, Jeremy Myers, Josh Borrow'
author = 'Jeremy Myers, Josh Borrow'

# -- General configuration ---------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#general-configuration

# Add myst_parser so Sphinx can read Markdown
extensions = [
    "myst_parser",
]

myst_enable_extensions = [
    "attrs_inline",   # enable inline {key=val} attributes for images/links/spans
]

# Tell Sphinx to treat .md files as source files
source_suffix = {
    ".rst": "restructuredtext",
    ".md": "markdown",
}

templates_path = ['_templates']
exclude_patterns = ['_build', 'Thumbs.db', '.DS_Store']

# -- Options for HTML output -------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#options-for-html-output

html_theme = 'alabaster'
html_static_path = ['_static']
html_css_files = ["custom.css"]
