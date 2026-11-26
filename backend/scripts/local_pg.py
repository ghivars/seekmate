"""Run a throwaway local Postgres without Docker (binaries from the `pgserver` wheel).

Usage: uv run python scripts/local_pg.py start|stop|status
Env:   SEEKMATE_PGDATA (data dir, default backend/.pgdata), SEEKMATE_PGPORT (default 55432)
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import pgserver

BIN = Path(pgserver.__file__).parent / "pginstall" / "bin"
DATA = Path(os.environ.get("SEEKMATE_PGDATA", Path(__file__).parent.parent / ".pgdata")).resolve()
PORT = os.environ.get("SEEKMATE_PGPORT", "55432")
DATABASES = ("seekmate", "seekmate_test")


def run(tool: str, *args: str, check: bool = True) -> subprocess.CompletedProcess[bytes]:
    return subprocess.run(  # noqa: S603
        [str(BIN / tool), *args], check=check, stdin=subprocess.DEVNULL
    )


def start() -> None:
    if not (DATA / "PG_VERSION").exists():
        DATA.mkdir(parents=True, exist_ok=True)
        run("initdb", "-D", str(DATA), "-U", "seekmate", "-A", "trust", "-E", "UTF8", "--locale=C")
    if run("pg_ctl", "-D", str(DATA), "status", check=False).returncode != 0:
        options = f"-p {PORT} -c listen_addresses=127.0.0.1 -c max_connections=60"
        log = str(DATA.parent / f"{DATA.name}.log")
        run("pg_ctl", "-D", str(DATA), "-w", "-l", log, "-o", options, "start")
    for name in DATABASES:
        run("createdb", "-h", "127.0.0.1", "-p", PORT, "-U", "seekmate", name, check=False)
    print(f"postgresql+asyncpg://seekmate@127.0.0.1:{PORT}/seekmate")


def main() -> None:
    command = sys.argv[1] if len(sys.argv) > 1 else "status"
    if command == "start":
        start()
    elif command == "stop":
        run("pg_ctl", "-D", str(DATA), "-m", "fast", "stop", check=False)
    else:
        run("pg_ctl", "-D", str(DATA), "status", check=False)


if __name__ == "__main__":
    main()
