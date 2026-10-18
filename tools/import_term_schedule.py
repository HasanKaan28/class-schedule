"""Turns the IUS undergraduate term schedule PDF into data/term-schedule.json.

Usage (needs the pypdf package):
  python tools/import_term_schedule.py <schedule.pdf> --term "Fall 2026-27" --source <pdf url> --updated 2026-09-28

The PDF lists one lecture section per row: "CS103.2 CS103.2 Introduction to Programming Mon. 12:00-14:50 B F2.15 - Amphitheater II".
A few rows meet on two days ("Tue./Thu. 11:00-12:50/12:00-13:50 B F2.16/B F2.16") or in two rooms ("A F3.7 - ... & A F3.8 - ...").
Run this once per term (and again when IUS publishes an updated schedule), then commit the JSON.
"""
import argparse
import html
import json
import re
import sys
from pathlib import Path

from pypdf import PdfReader

DAYS = {"Mon": 1, "Tue": 2, "Wed": 3, "Thu": 4, "Fri": 5, "Sat": 6}
ROW = re.compile(
    r"^(?P<label>\S+)\s+(?P=label)\s+(?P<name>.*?)\s+"
    r"(?P<days>(?:Mon|Tue|Wed|Thu|Fri|Sat)\.(?:/(?:Mon|Tue|Wed|Thu|Fri|Sat)\.)*)\s+"
    r"(?P<times>[\d:\-/]+)\s*(?P<rooms>.*)$"
)
TIME = re.compile(r"(\d{1,2}:\d{2})-(\d{1,2}:\d{2})")


def room_code(text):
    """'B F2.15 - Amphitheater II' -> 'B F2.15'; 'B F1.24 (MAC Studio)' -> 'B F1.24'."""
    tokens = text.split(" - ")[0].split()
    for i, token in enumerate(tokens):
        if re.search(r"\d", token):
            return " ".join(tokens[: i + 1])
    return text.strip()


def rooms_for(text, count):
    text = html.unescape(text).strip()
    per_day = text.split("/") if count > 1 and text.count("/") == count - 1 else [text] * count
    return [" & ".join(room_code(part) for part in day.split("&") if part.strip()) for day in per_day]


def parse(pdf_path):
    courses = {}
    for page in PdfReader(pdf_path).pages:
        for line in page.extract_text().splitlines():
            match = ROW.match(line.strip())
            if not match:
                continue
            label = match["label"]
            code, _, sec = label.rpartition(".")
            days = [DAYS[d.rstrip(".")] for d in match["days"].split("/")]
            times = TIME.findall(match["times"])
            if not code or len(times) != len(days):
                print(f"Skipped: {line}", file=sys.stderr)
                continue
            course = courses.setdefault(code, {"n": match["name"].strip(), "sec": []})
            for day, (start, end), room in zip(days, times, rooms_for(match["rooms"], len(days))):
                course["sec"].append([sec, "lec", day, start.zfill(5), end.zfill(5), room])
    return dict(sorted(courses.items()))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("pdf", type=Path)
    parser.add_argument("--term", required=True)
    parser.add_argument("--source", required=True, help="where the PDF was published")
    parser.add_argument("--updated", required=True, help="date the PDF was last updated, YYYY-MM-DD")
    parser.add_argument("--out", type=Path, default=Path("data/term-schedule.json"))
    args = parser.parse_args()

    courses = parse(args.pdf)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    payload = {"term": args.term, "source": args.source, "updated": args.updated, "courses": courses}
    args.out.write_text(json.dumps(payload, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    sections = sum(len(c["sec"]) for c in courses.values())
    print(f"Wrote {args.out}: {len(courses)} courses, {sections} meetings", file=sys.stderr)
