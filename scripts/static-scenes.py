"""Produce reduced-motion variants using the SVG document tree."""

from pathlib import Path
import xml.etree.ElementTree as ET

SVG = "http://www.w3.org/2000/svg"
ANIMATION = {"animate", "animateMotion", "animateTransform", "set", "discard"}
ET.register_namespace("", SVG)


def make_static(source):
    root = ET.fromstring(source)
    for parent in root.iter():
        for child in list(parent):
            if child.tag.rsplit("}", 1)[-1] in ANIMATION:
                parent.remove(child)
    return ET.tostring(root, encoding="unicode") + "\n"


if __name__ == "__main__":
    assets = Path(__file__).resolve().parents[1] / "assets"
    for theme in ("light", "dark"):
        for size in ("", "-mobile"):
            source = (assets / f"cat-{theme}{size}.svg").read_text(encoding="utf-8")
            (assets / f"cat-{theme}{size}-static.svg").write_text(make_static(source), encoding="utf-8")
    print("Validated SVG XML and generated four reduced-motion variants.")
