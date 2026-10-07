# CMIF validation fixture

`cmi-customization.rng` is the unmodified schema from the TEI Correspondence SIG:
https://github.com/TEI-Correspondence-SIG/CMIF/blob/d171133e2ca7a0b987ba0564577ec79077b8d908/schema/cmi-customization.rng

Pinned revision: d171133e2ca7a0b987ba0564577ec79077b8d908.
The upstream file retains its CC+BY and BSD-2 licence notice.
Used locally to validate exports without network access.

`cmif.sch` comes from `odd/cmif.sch` at the same revision. Tests execute
its rule contexts and XPath 2 assertions with Saxon (no external Schematron
compiler or network service needed).
