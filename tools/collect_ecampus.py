"""Collects course and office-hour data from IUS eCampus into web/data/courses.js.

Usage:
  python tools/collect_ecampus.py [--out web/data/courses.js] [--delay 10] [--pages N] [--limit N]

Only public pages are read: the syllabus list, each syllabus, and the office-hours directory.
eCampus asks crawlers for a 10-second delay (robots.txt), so a full run takes about two hours.
Standard library only, so it runs on a bare CI runner.
"""
import argparse
import json
import re
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

BASE = "https://ecampus.ius.edu.ba"
USER_AGENT = "class-schedule-collector/1.0 (+https://github.com/HasanKaan28/class-schedule)"
DAYS = {"monday": 1, "tuesday": 2, "wednesday": 3, "thursday": 4, "friday": 5, "saturday": 6, "sunday": 7}
TYPES = {"course": "lec", "lecture": "lec", "tutorial": "tut", "lab": "lab", "laboratory": "lab"}
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}
TIME_RANGE = re.compile(r"(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})")


# --- A small DOM, enough for eCampus pages -------------------------------------------------

class Node:
    def __init__(self, tag, attrs, parent):
        self.tag, self.attrs, self.parent, self.children = tag, attrs, parent, []

    @property
    def classes(self):
        return (self.attrs.get("class") or "").split()

    def iter(self):
        for child in self.children:
            if isinstance(child, Node):
                yield child
                yield from child.iter()

    def find_all(self, tag=None, cls=None, id=None):
        return [n for n in self.iter()
                if (tag is None or n.tag == tag)
                and (cls is None or cls in n.classes)
                and (id is None or n.attrs.get("id") == id)]

    def find(self, tag=None, cls=None, id=None):
        found = self.find_all(tag, cls, id)
        return found[0] if found else None

    def text(self):
        parts = []
        for child in self.children:
            if isinstance(child, str):
                parts.append(child)
            elif child.tag not in ("script", "style"):
                parts.append(" " if child.tag == "br" else child.text())
        return re.sub(r"\s+", " ", "".join(parts)).strip()


class TreeBuilder(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node("#root", {}, None)
        self.current = self.root

    def handle_starttag(self, tag, attrs):
        node = Node(tag, dict(attrs), self.current)
        self.current.children.append(node)
        if tag not in VOID:
            self.current = node

    def handle_startendtag(self, tag, attrs):
        self.current.children.append(Node(tag, dict(attrs), self.current))

    def handle_endtag(self, tag):
        node = self.current
        while node is not self.root and node.tag != tag:
            node = node.parent
        if node is not self.root:
            self.current = node.parent

    def handle_data(self, data):
        self.current.children.append(data)


def parse(html):
    builder = TreeBuilder()
    builder.feed(html)
    return builder.root


# --- Fetching ---------------------------------------------------------------------------------

class Fetcher:
    def __init__(self, delay):
        self.delay = delay
        self.last = 0.0
        self.count = 0

    def get(self, path):
        wait = self.last + self.delay - time.monotonic()
        if wait > 0:
            time.sleep(wait)
        request = urllib.request.Request(BASE + path, headers={"User-Agent": USER_AGENT})
        try:
            for attempt in range(3):
                try:
                    with urllib.request.urlopen(request, timeout=60) as response:
                        return response.read().decode("utf-8", errors="replace")
                except (urllib.error.URLError, TimeoutError) as err:
                    if attempt == 2:
                        raise
                    print(f"  retrying {path}: {err}", file=sys.stderr)
                    time.sleep(self.delay * 3)
        finally:
            self.last = time.monotonic()
            self.count += 1


# --- Page parsers -----------------------------------------------------------------------------

def parse_syllabus_list(html):
    rows = []
    for tr in parse(html).find_all("tr"):
        title_cell = tr.find("td", cls="views-field-title")
        link = title_cell and title_cell.find("a")
        if not link:
            continue
        title = link.text()
        code, _, name = title.partition(" ")
        cell = lambda c: (tr.find("td", cls=c) or Node("td", {}, None)).text()
        rows.append({
            "code": code.strip(),
            "name": name.strip(),
            "url": link.attrs.get("href", ""),
            "holder": cell("views-field-field-name"),
            "unit": cell("views-field-field-academic-unit"),
            "ects": cell("views-field-field-ects"),
        })
    return rows


def info_items(container):
    items = {}
    for item in container.find_all("div", cls="info-item"):
        label, value = item.find("div", cls="info-item-label"), item.find("div", cls="info-item-value")
        if label and value:
            items.setdefault(label.text(), value.text())
    return items


def clean(value):
    return "" if value in ("", "-", "None", "TBA") else value


def clean_phone(value):
    # Placeholders such as "033 957 -" have too few digits to be a real number.
    return value if len(re.sub(r"\D", "", value)) >= 8 else ""


def room_code(venue):
    """'B F1.25 Computer Lab' or 'RC1.2 - Tutorial Room' -> 'B F1.25' / 'RC1.2'."""
    tokens = venue.split(" - ")[0].split()
    for i, token in enumerate(tokens):
        if re.search(r"\d", token):
            return " ".join(tokens[: i + 1])
    return clean(" ".join(tokens))


def parse_meeting(day_text, venue_text):
    match = TIME_RANGE.search(day_text)
    day = DAYS.get(day_text.split(" ")[0].lower()) if day_text else None
    if not match or not day:
        return None
    return day, match.group(1).zfill(5), match.group(2).zfill(5), room_code(venue_text)


def section_heading(root, words):
    for h2 in root.find_all("h2"):
        if words in h2.text():
            return h2.parent
    return None


def parse_syllabus(html):
    root = parse(html)
    data = {}

    course_items = info_items(root)
    data["wh"] = clean(course_items.get("Weekly Hours", ""))
    ects = course_items.get("ECTS", "")
    data["ects"] = int(ects) if ects.isdigit() else None

    lecturers = []
    for card in root.find_all("div", cls="info-card"):
        subtitle = card.find("p", cls="info-card-subtitle")
        title = card.find("h4", cls="info-card-title")
        if not (subtitle and title and "Lecturer" in subtitle.text()):
            continue
        items = info_items(card)
        lecturer = {"n": title.text(), "pos": clean(items.get("Position", "")),
                    "email": clean(items.get("Email", "")), "phone": clean_phone(items.get("Phone", ""))}
        lecturers.append({k: v for k, v in lecturer.items() if v})
        if clean(items.get("Assistant(s)", "")):
            data["asst"] = items["Assistant(s)"]
        if clean(items.get("Assistant E-mail", "")):
            data["asstEmail"] = items["Assistant E-mail"]
    data["lec"] = lecturers

    sections = []
    schedule = root.find(id="courseSchedule")
    if schedule:
        for tr in schedule.find_all("tr"):
            cells = [td.text() for td in tr.find_all("td")]
            if len(cells) < 4:
                continue
            label, kind = cells[0], cells[1].lower()
            sec = label.split(".", 1)[1] if "." in label else label
            kind = TYPES.get(kind, kind)
            for day_text, venue in ((cells[2], cells[3]), (cells[4] if len(cells) > 4 else "", cells[5] if len(cells) > 5 else "")):
                meeting = parse_meeting(day_text, venue)
                if meeting:
                    sections.append([sec, kind, *meeting])
    data["sec"] = sections

    office_hours = []
    oh_section = section_heading(root, "Office Hours")
    if oh_section:
        for tr in oh_section.find_all("tr"):
            cells = [td.text() for td in tr.find_all("td")]
            if len(cells) < 3:
                continue
            day, match = DAYS.get(cells[0].lower()), TIME_RANGE.search(cells[1])
            if day and match:
                office_hours.append([day, match.group(1).zfill(5), match.group(2).zfill(5), clean(cells[2]), cells[3] if len(cells) > 3 else ""])
    data["oh"] = office_hours

    updated = re.search(r"Last Update on (\w{3} \d{1,2}, \d{4})", root.text())
    if updated:
        data["upd"] = datetime.strptime(updated.group(1), "%b %d, %Y").strftime("%Y-%m-%d")
    return data


def parse_office_hours(html):
    staff = {}
    for card in parse(html).find_all("div", cls="officehourscard"):
        name = ""
        for child in card.children:
            if isinstance(child, str) and child.strip():
                name = child.strip()
                break
        if not name:
            continue
        text = card.text()
        office = re.search(r"^.*?" + re.escape(name) + r"\s*(.*?)(?:\+\d|Monday:|Tuesday:|Wednesday:|Thursday:|Friday:|Saturday:|$)", text)
        phone = re.search(r"(\+?\d[\d ]{6,}\d)", text)
        hours = []
        for block in card.find_all("span", cls="oh-display"):
            label = block.find("span", cls="oh-display-label")
            day = DAYS.get(label.text().rstrip(":").lower()) if label else None
            times = block.find("div", cls="oh-display-times")
            if not (day and times):
                continue
            for part in times.text().split(","):
                match = TIME_RANGE.search(part)
                if match:
                    note = TIME_RANGE.sub("", part).strip()
                    hours.append([day, match.group(1).zfill(5), match.group(2).zfill(5), note])
                elif hours and part.strip():  # "10:00-14:00 ARCH302, ARCH405" continues the note
                    hours[-1][3] = f"{hours[-1][3]}, {part.strip()}".lstrip(", ")
        entry = {"o": office.group(1).strip() if office else "", "p": phone.group(1).strip() if phone else "", "h": hours}
        staff[name] = {k: v for k, v in entry.items() if v}
    return staff


# --- Main -------------------------------------------------------------------------------------

def collect(args):
    fetcher = Fetcher(args.delay)

    listing, seen = [], set()
    for page in range(args.pages or 1000):
        rows = [r for r in parse_syllabus_list(fetcher.get(f"/syllabi?page={page}")) if r["url"] not in seen]
        if not rows:
            break
        seen.update(r["url"] for r in rows)
        listing.extend(rows)
        print(f"syllabus list page {page}: {len(rows)} courses", file=sys.stderr)

    courses = {}
    for index, row in enumerate(listing[: args.limit or None]):
        if not row["code"] or row["code"] in courses:
            continue
        course = {"n": row["name"], "u": row["unit"], "url": row["url"]}
        if row["ects"].isdigit():
            course["ects"] = int(row["ects"])
        try:
            details = parse_syllabus(fetcher.get(row["url"]))
            course.update({k: v for k, v in details.items() if v not in (None, "", [])})
        except Exception as err:  # keep the list entry even if one syllabus fails
            print(f"  {row['code']}: {err}", file=sys.stderr)
        if "lec" not in course and row["holder"] and row["holder"] != "TBA":
            course["lec"] = [{"n": row["holder"]}]
        courses[row["code"]] = course
        print(f"[{index + 1}/{len(listing)}] {row['code']}: {len(course.get('sec', []))} meetings", file=sys.stderr)

    staff = {}
    if not args.limit:
        for page in range(1000):
            found = parse_office_hours(fetcher.get(f"/office-hours?page={page}"))
            new = {k: v for k, v in found.items() if k not in staff}
            if not new:
                break
            staff.update(new)
            print(f"office hours page {page}: {len(found)} people", file=sys.stderr)

    print(f"{len(courses)} courses, {len(staff)} staff, {fetcher.count} requests", file=sys.stderr)
    return {"courses": dict(sorted(courses.items())), "staff": dict(sorted(staff.items()))}


def write(payload, out, force):
    previous = None
    if out.exists():
        match = re.search(r"=\s*(\{.*\});?\s*$", out.read_text(encoding="utf-8"), re.S)
        previous = json.loads(match.group(1)) if match else None
    if previous and not force:
        old_count, new_count = len(previous.get("courses", {})), len(payload["courses"])
        if new_count < old_count * 0.7:
            sys.exit(f"Refusing to overwrite: {new_count} courses now vs {old_count} before. Use --force if this is expected.")
        if {k: previous.get(k) for k in ("courses", "staff")} == payload:
            print("No changes.", file=sys.stderr)
            return
    payload = {"generated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ"), "source": BASE, **payload}
    out.parent.mkdir(parents=True, exist_ok=True)
    body = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    out.write_text(f"// Generated by tools/collect_ecampus.py from {BASE}. Do not edit by hand.\nwindow.COURSE_DATA = {body};\n", encoding="utf-8")
    print(f"Wrote {out} ({len(body) // 1024} KB)", file=sys.stderr)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--out", type=Path, default=Path("web/data/courses.js"))
    parser.add_argument("--delay", type=float, default=10.0, help="seconds between requests (robots.txt asks for 10)")
    parser.add_argument("--pages", type=int, help="only read this many syllabus list pages (for testing)")
    parser.add_argument("--limit", type=int, help="only read this many syllabi and skip office hours (for testing)")
    parser.add_argument("--force", action="store_true", help="write even if far fewer courses were found than before")
    args = parser.parse_args()
    write(collect(args), args.out, args.force or bool(args.limit))
