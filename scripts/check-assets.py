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
        assert root.attrib["viewBox"] == ("0 0 450 190" if "-mobile" in asset.name else "0 0 894 190"), asset
        assert root.find(SVG + "desc") is not None, asset
        copy = " ".join(root.itertext())
        assert not re.search(r"[\u4e00-\u9fff]", copy), asset
        for removed in ("one small step", "quiet paws", "no recent public pushes",
                        "last public push", "PUBLIC ACTIVITY", "SNAPSHOT",
                        "hello, little visitor", "a soft spot", "a little break"):
            assert removed not in copy, (asset, removed)
        bowl = root.find(f".//{SVG}g[@data-role='food-bowl']")
        assert bowl is not None, asset
        level = float(bowl.attrib["data-food-level"])
        assert 0 <= level <= 100, asset
        reminder = root.find(f".//{SVG}g[@data-role='hungry-reminder']")
        hearts = root.find(f".//{SVG}g[@data-role='meal-hearts']")
        if level < 12.5:
            assert reminder is not None and hearts is None, asset
            assert "".join(reminder.itertext()) == ("Running low..." if level else "A little snack?"), asset
        else:
            assert reminder is None and hearts is not None, asset
        for role in ("play-yarn", "play-paw", "play-hop"):
            assert root.find(f".//{SVG}g[@data-role='{role}']") is not None, (asset, role)
        for node in root.iter():
            if "keyTimes" in node.attrib:
                times = [float(value) for value in node.attrib["keyTimes"].split(";")]
                assert times[0] == 0 and times[-1] == 1, asset
                assert all(a < b for a, b in zip(times, times[1:])), asset
                assert len(times) == len(node.attrib["values"].split(";")), asset
                if node.attrib.get("calcMode") == "spline":
                    assert len(node.attrib["keySplines"].split(";")) == len(times) - 1, asset

readme = (ROOT / "README.md").read_text(encoding="utf-8")
for reference in re.findall(r'(?:src|srcset)="\./([^"]+)"', readme):
    assert (ROOT / reference).is_file(), reference
    assert (ROOT / reference).stat().st_size > 0, reference
assert not re.search(r"^# ", readme, re.MULTILINE)
assert (ROOT / "assets/agent-platform.png").read_bytes().startswith(b"\x89PNG\r\n\x1a\n")
print("All artwork, README asset references, and reduced-motion variants passed.")
