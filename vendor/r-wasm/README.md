# gsm packages built for R in the browser

`repo/` is a package repository holding WebAssembly builds of workr, gsm.core, gsm.mapping and gsm.reporting. None of them has a WebAssembly build anywhere else.

- Built by [safety.viz](https://github.com/jwildfire/safety.viz)'s `r-wasm` workflow, from the release tags `pins.json` names.
- Copied from safety.viz at commit `c1649c568753910cffa688d1888e1f5d07fc5a30` (`site/vendor/r-wasm/`), byte for byte.
- `SOURCE.json` is safety.viz's own record of the build: for each file, the repository, tag and commit it was built from, the workflow run that built it, and its checksum.

study.builder installs workr, gsm.core and gsm.mapping from here. gsm.reporting is carried because the repository's index lists it.

To move to later releases, rebuild in safety.viz and copy the folder again.
