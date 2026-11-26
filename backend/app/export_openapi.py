"""Write the OpenAPI document used to generate the typed frontend client."""

from __future__ import annotations

import json
import sys
from pathlib import Path

from app.main import app


def main() -> None:
    target = Path(sys.argv[1] if len(sys.argv) > 1 else "../frontend/openapi.json")
    document = json.dumps(app.openapi(), indent=2, ensure_ascii=False) + "\n"
    target.write_text(document, encoding="utf-8", newline="\n")


if __name__ == "__main__":
    main()
