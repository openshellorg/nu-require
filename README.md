# nu-require

See **[README.adoc](./README.adoc)** for the full project readme (AsciiDoc).

Require [Nushell](https://www.nushell.sh/) as the host shell for tailored CLIs via `validate()`.

If `nu` is on `PATH` but the current shell is not Nushell, the library tells the user it is **relaunching inside Nushell** and re-execs the same CLI under `nu`.
