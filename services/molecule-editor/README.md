# Molecule editor dependency boundary

Ketcher currently brings miew-react, which requires React 18. Keep these dependencies in a separate browser document/iframe with its own React 18 root; never mount its components in the main React 19 application. The editor document and validated message protocol are not implemented yet. This package only installs the compatible dependency family.
