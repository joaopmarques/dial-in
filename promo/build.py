#!/usr/bin/env python3
"""Builds dial-in-promo.html from src/ with the motion-graphic skill's assembler.

The parts in src/ are the editable source. Everything is drawn in code, so the result is one self-contained HTML file.
"""
import pathlib
import shutil
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent
SKILL = ROOT / ".skill"
PARTS = ROOT / "parts"


def main() -> int:
    if not (PARTS / "_shell.html").exists():
        subprocess.run([sys.executable, SKILL / "scripts/assemble.py", "split", SKILL / "assets/engine.html", PARTS], check=True)
    for src in (ROOT / "src").iterdir():
        shutil.copy(src, PARTS / src.name)
    return subprocess.run([sys.executable, SKILL / "scripts/assemble.py", "build", PARTS, ROOT / "dial-in-promo.html"]).returncode


if __name__ == "__main__":
    sys.exit(main())
