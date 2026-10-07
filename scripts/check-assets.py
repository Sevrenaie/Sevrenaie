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
        for role in ("play-yarn", "play-paw", "play-hop", "eye-gaze", "soft-face"):
            assert root.find(f".//{SVG}g[@data-role='{role}']") is not None, (asset, role)
        paw = root.find(f".//{SVG}g[@data-role='play-paw']")
        assert paw.attrib.get("transform") == "translate(0 0)" and "opacity" not in paw.attrib, asset
        rectangles = paw.findall(SVG + "rect")
        assert len(rectangles) == 1, asset
        assert {key: rectangles[0].attrib[key] for key in ("x", "y", "width", "height")} == {
            "x": "84", "y": "146", "width": "18", "height": "12",
        }, asset
        assert all(child.tag in (SVG + "rect", SVG + "animateTransform") for child in paw), asset
        for motion in paw.findall(SVG + "animateTransform"):
            assert motion.attrib["type"] == "translate" and motion.attrib["calcMode"] == "spline", asset
            offsets = [tuple(map(float, value.split())) for value in motion.attrib["values"].split(";")]
            assert offsets[0] == offsets[-1] == (0, 0), asset
            assert all(0 <= x <= 12 and -6 <= y <= 0 for x, y in offsets), asset
        face = root.find(f".//{SVG}g[@data-role='soft-face']")
        assert not face.findall(f".//{SVG}animate[@attributeName='opacity']"), asset
        for role in ("eye-left", "eye-right", "face-nose", "face-mouth"):
            assert len(face.findall(f".//{SVG}path[@data-role='{role}']")) == 1, (asset, role)
        mouth = face.find(f".//{SVG}path[@data-role='face-mouth']")
        assert mouth.attrib["d"] == "M54 110 Q57 114 60 110 Q63 114 66 110", asset
        for path in face.findall(f".//{SVG}path"):
            for animation in path.findall(f"{SVG}animate[@attributeName='d']"):
                base = path.attrib["d"]
                commands = re.findall(r"[A-Za-z]", base)
                numbers = re.findall(r"-?\d+(?:\.\d+)?", base)
                for value in animation.attrib["values"].split(";"):
                    assert re.findall(r"[A-Za-z]", value) == commands, (asset, path.attrib["data-role"])
                    assert len(re.findall(r"-?\d+(?:\.\d+)?", value)) == len(numbers), asset
                assert animation.attrib["calcMode"] == "spline", asset
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
