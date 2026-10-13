#!/usr/bin/env python3
"""Keep the owl mascot identical on every page.

Source of truth: templates/owl-mascot.html — the blocks between the OWL:CSS, OWL:SVG
and OWL:JS markers. Every game (games/*/index.html) must contain all three blocks.

    python3 scripts/mascot.py check   # exit 1 if a page is missing a block or differs from the template
    python3 scripts/mascot.py sync    # copy the template blocks into every page that has the markers

To add the owl to a new page: put empty START/END marker pairs where the blocks belong, run sync.
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
TEMPLATE = ROOT / "templates" / "owl-mascot.html"
MARKERS = {
    "CSS": ("/* ===== OWL:CSS START ===== */", "/* ===== OWL:CSS END ===== */"),
    "SVG": ("<!-- ===== OWL:SVG START ===== -->", "<!-- ===== OWL:SVG END ===== -->"),
    "JS": ("// ===== OWL:JS START =====", "// ===== OWL:JS END ====="),
}


def find(text, name):
    """Return (indent, inner_start, inner_end) of a block, or None."""
    start, end = MARKERS[name]
    m = re.search(r"^([ \t]*)" + re.escape(start) + r"[^\n]*\n(.*?)^[ \t]*" + re.escape(end), text, re.S | re.M)
    if not m:
        return None
    return m.group(1), m.start(2), m.end(2)


def inner_lines(text, name):
    indent, a, b = find(text, name)
    lines = text[a:b].rstrip("\n").split("\n") if b > a else []
    return [line[len(indent):] if line.startswith(indent) else line.lstrip() for line in lines]


def pages():
    found = sorted(ROOT.glob("games/*/index.html"))
    found += [p for p in [ROOT / "index.html"] if p.exists() and "OWL:SVG START" in p.read_text(encoding="utf-8")]
    return found


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "check"
    tpl = TEMPLATE.read_text(encoding="utf-8")
    blocks = {name: inner_lines(tpl, name) for name in MARKERS}
    problems = 0
    for page in pages():
        text = page.read_text(encoding="utf-8")
        rel = page.relative_to(ROOT)
        for name in MARKERS:
            loc = find(text, name)
            if not loc:
                print(f"MISSING  {rel}: no OWL:{name} block")
                problems += 1
                continue
            if cmd == "sync":
                indent, a, b = loc
                body = "".join(f"{indent}{line}\n" if line else "\n" for line in blocks[name])
                text = text[:a] + body + text[b:]
            elif [l.strip() for l in inner_lines(text, name)] != [l.strip() for l in blocks[name]]:
                print(f"DIFFERS  {rel}: OWL:{name} differs from the template (run: python3 scripts/mascot.py sync)")
                problems += 1
        if cmd == "sync":
            page.write_text(text, encoding="utf-8")
            print(f"synced   {rel}")
        elif not problems:
            print(f"ok       {rel}")
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()
