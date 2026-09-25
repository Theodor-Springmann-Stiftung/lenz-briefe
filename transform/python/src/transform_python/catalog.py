"""Browser-ready catalog derived once at build time, independent of presentation."""
from __future__ import annotations

import re

PRIORITY = ("when", "from", "notBefore", "to", "notAfter")


def read_year_groups(references_doc):
    """Read inclusive ranges in editorial order; reject ambiguous groupings."""
    groups = []
    for node in references_doc.findall('.//{https://lenz-archiv.de}yearGroup'):
        start, end = int(node.attrib['fromYear']), int(node.attrib['toYear'])
        label = node.attrib['label'].strip()
        if start <= 0 or end < start or not label:
            raise ValueError('Invalid year group in references.xml')
        if any(start <= g['toYear'] and end >= g['fromYear'] for g in groups):
            raise ValueError('Overlapping year groups in references.xml')
        years = str(start) if start == end else f'{start}–{end}'
        groups.append({'id': str(start) if start == end else f'{start}-{end}',
                       'label': f'{years} · {label}', 'fromYear': start, 'toYear': end})
    if not groups:
        raise ValueError('references.xml must define at least one year group')
    return groups


def date_sort(events):
    candidates = []
    for event_index, event in enumerate(events):
        if event["type"] != "sent":
            continue
        for date_index, date in enumerate(event["dates"]):
            attribute = next((key for key in PRIORITY if date.get(key)), None)
            if not attribute:
                continue
            value = date[attribute]
            match = re.fullmatch(r"(\d{4,})(?:-(\d{2})(?:-(\d{2}))?)?(?:Z|[+-]\d{2}:\d{2})?", value)
            if not match:
                continue
            key = tuple(int(part or 0) for part in match.groups())
            candidates.append((key, event_index, date_index, attribute, value))
    if not candidates:
        return None
    key, event_index, date_index, attribute, value = min(candidates)
    return {"key": list(key), "value": value, "attribute": attribute,
            "eventIndex": event_index, "dateIndex": date_index}


def build_catalog(entries, refs):
    letters = []
    for entry in entries:
        events = entry.get("events", [])
        sort = date_sort(events)
        year = sort["key"][0] if sort else None
        group = next((g["id"] for g in refs["yearGroups"] if year and g["fromYear"] <= year <= g["toYear"]),
                     "other" if year else "undated")
        # Legacy per-letter metadata stays available, but does not duplicate
        # first-event views in the canonical catalog.
        letter = {k: v for k, v in entry.items() if k not in ("sent", "received")}
        letter.update({"sort": sort, "groupId": group,
                       "personIds": sorted({p["ref"] for e in events for p in e["persons"]}, key=int),
                       "placeIds": sorted({p["ref"] for e in events for p in e["locations"]}, key=int)})
        letters.append(letter)
    letters.sort(key=lambda n: (n["sort"] is None, (n["sort"] or {}).get("key", []), int(n["letter"])))
    groups = [dict(g) for g in refs["yearGroups"]]
    for group_id, label in [("other", "Weitere Jahre"), ("undated", "Ohne Datierung")]:
        if any(n["groupId"] == group_id for n in letters):
            groups.append({"id": group_id, "label": label})
    for group in groups:
        group["count"] = sum(n["groupId"] == group["id"] for n in letters)
    return {"schemaVersion": 1, "groups": groups, "letters": letters,
            "people": refs["personMap"], "places": refs["locationMap"]}
