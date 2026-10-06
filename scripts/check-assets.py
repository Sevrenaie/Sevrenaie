"""Validate checked-in art and reduced-motion variants without dependencies."""

from pathlib import Path
import re
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SVG = "{http://www.w3.org/2000/svg}"

for asset in (ROOT / "assets").glob("*.svg"):
    root = ET.parse(asset).getroot()
    assert root.tag == SVG + "svg", asset
    assert not root.findall(".//" + SVG + "script"), asset
    if asset.name.endswith("-static.svg"):
        assert not any(node.tag.rsplit("}", 1)[-1].startswith("animate") for node in root.iter()), asset
        assert not root.findall(".//" + SVG + "set"), asset
    if asset.name.startswith("cat-"):
        assert root.attrib["viewBox"] == ("0 0 450 244" if "-mobile" in asset.name else "0 0 894 222"), asset
        assert root.find(SVG + "desc") is not None, asset
        for text in root.findall("./" + SVG + "text"):
            if text.attrib.get("y") in ("184", "203"):
                assert len(text.text or "") <= (46 if "-mobile" in asset.name else 92), asset

readme = (ROOT / "README.md").read_text(encoding="utf-8")
for reference in re.findall(r'(?:src|srcset)="\./([^"]+)"', readme):
    assert (ROOT / reference).is_file(), reference
    assert (ROOT / reference).stat().st_size > 0, reference
assert not re.search(r"^# ", readme, re.MULTILINE)
assert (ROOT / "assets/agent-platform.png").read_bytes().startswith(b"\x89PNG\r\n\x1a\n")
print("All artwork, README asset references, and reduced-motion variants passed.")
