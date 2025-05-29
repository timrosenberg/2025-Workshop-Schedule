import json
from collections import defaultdict

# Load flat data
with open("schedule-flat.json", "r", encoding="utf-8") as f:
    rows = json.load(f)

schedule = []
current_day = None
last_date = ""
last_theme = ""
last_description = ""

for row in rows:
    date = row["Date"].strip()
    theme_title = row["Theme Title"].strip()
    theme_description = row["Theme Description"].strip()

    # Update "last known" info if this row has new values
    if date:
        last_date = date
        last_theme = theme_title
        last_description = theme_description
        current_day = {
            "title": last_date,
            "theme": f"{last_theme} - {last_description}".strip(" -"),
            "items": []
        }
        schedule.append(current_day)

    # Skip completely blank rows
    if not row["Time"] and not row["Activity"]:
        continue

    item = {
        "time": row["Time"].strip(),
        "text": f"{row['Activity'].strip()} - {row['Location'].strip()}" if row["Location"].strip() else row["Activity"].strip()
    }

    if row["Map URL"].strip():
        item["map"] = row["Map URL"].strip()

    subpoints = [
        row.get("Subpoint 1", "").strip(),
        row.get("Subpoint 2", "").strip(),
        row.get("Subpoint 3", "").strip(),
        row.get("Subpoint 4", "").strip()
    ]
    item["subpoints"] = [s for s in subpoints if s]

    if current_day:
        current_day["items"].append(item)

# Save to file
with open("schedule.json", "w", encoding="utf-8") as f:
    json.dump(schedule, f, indent=2)
