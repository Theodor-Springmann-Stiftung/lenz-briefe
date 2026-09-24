"""Browser-ready catalog derived once at build time, independent of presentation."""
from __future__ import annotations

import re

GROUPS = [
    {"id": "1756-1770", "label": "1756–1770", "fromYear": 1756, "toYear": 1770},
    {"id": "1771-1775", "label": "1771–1775", "fromYear": 1771, "toYear": 1775},
    {"id": "1776", "label": "1776", "fromYear": 1776, "toYear": 1776},
    {"id": "1777-1779", "label": "1777–1779", "fromYear": 1777, "toYear": 1779},
    {"id": "1780-1792", "label": "1780–1792", "fromYear": 1780, "toYear": 1792},
]
PRIORITY = ("when", "from", "notBefore", "to", "notAfter")


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
        group = next((g["id"] for g in GROUPS if year and g["fromYear"] <= year <= g["toYear"]),
                     "other" if year else "undated")
        # Legacy per-letter metadata stays available, but does not duplicate
        # first-event views in the canonical catalog.
        letter = {k: v for k, v in entry.items() if k not in ("sent", "received")}
        letter.update({"sort": sort, "groupId": group,
                       "personIds": sorted({p["ref"] for e in events for p in e["persons"]}, key=int),
                       "placeIds": sorted({p["ref"] for e in events for p in e["locations"]}, key=int)})
        letters.append(letter)
    letters.sort(key=lambda n: (n["sort"] is None, (n["sort"] or {}).get("key", []), int(n["letter"])))
    groups = [dict(g) for g in GROUPS]
    for group_id, label in [("other", "Weitere Jahre"), ("undated", "Ohne Datierung")]:
        if any(n["groupId"] == group_id for n in letters):
            groups.append({"id": group_id, "label": label})
    for group in groups:
        group["count"] = sum(n["groupId"] == group["id"] for n in letters)
    return {"schemaVersion": 1, "groups": groups, "letters": letters,
            "people": refs["personMap"], "places": refs["locationMap"]}
