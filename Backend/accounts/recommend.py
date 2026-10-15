import math
import re
from datetime import date

from django.db.models import F, Q

from catalog.models import Batch, Course

DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
TASK_TYPES = ["Concept revision", "Practice set", "Previous year questions",
              "Sectional test", "Short notes + formula review"]


def recommend_courses(p, limit=4):
    years_away = p.target_year - date.today().year
    hours = p.hours_per_day
    weak = {s.id for s in p.weak_subjects.all()}
    courses = (Course.objects.filter(category=p.category, is_active=True)
               .prefetch_related("subjects", "faculty").order_by("title"))
    scored = []
    for c in courses:
        score, reasons = 0, []
        if c.track_id == p.track_id:
            score += 30
            reasons.append(f"matches your {p.track.name} track")
        if p.level == "BEGINNER":
            if c.type in ("FOUNDATION", "FULL_COURSE"):
                score += 20
                reasons.append("builds strong basics first")
            if c.level == "ADVANCED":
                score -= 25
            if c.type == "CRASH":
                score -= 20
        if p.level == "ADVANCED" and c.type in ("TEST_SERIES", "SUBJECT_INTENSIVE"):
            score += 20
            reasons.append("adds tests and speed practice for your level")
        if p.level == "INTERMEDIATE" and c.level == "INTERMEDIATE":
            score += 10
            reasons.append("pitched at your level")
        if hours <= 2 and c.type in ("TEST_SERIES", "SUBJECT_INTENSIVE"):
            score += 10
            reasons.append("fits short daily sessions")
        if hours >= 5 and c.type in ("FULL_COURSE", "CRASH"):
            score += 10
            reasons.append(f"uses your {hours} daily hours fully")
        if years_away >= 2:
            if c.type == "CRASH":
                score -= 40
            if c.type in ("FULL_COURSE", "FOUNDATION"):
                score += 15
                reasons.append(f"long-term plan for {p.target_year}")
        elif years_away <= 0 and c.type in ("CRASH", "TEST_SERIES"):
            score += 20
            reasons.append("your exam is close, so focus on revision")
        hits = [s for s in c.subjects.all() if s.id in weak]
        if hits:
            score += 10 * len(hits)
            reasons.append(f"covers your weak subject {hits[0].name}")

        if reasons:
            text = ", ".join(reasons[:2])
            reason = text[0].upper() + text[1:] + "."
        else:
            reason = f"Popular choice for {p.category.name} students."
        scored.append((score, c, reason))

    scored.sort(key=lambda r: -r[0])          # stable sort, ties keep title order
    return [(c, reason) for _, c, reason in scored[:limit]]


def time_of_day(batch):
    m = re.search(r"(\d{1,2}):?(\d{2})?\s*(AM|PM)", batch.schedule_time, re.I)
    if not m:
        return ""
    h = int(m.group(1)) % 12
    if m.group(3).upper() == "PM":
        h += 12
    return "morning" if h < 12 else "afternoon" if h < 17 else "evening"


def recommend_batches(p, rec_course_ids, limit=3):
    batches = (Batch.objects
               .filter(enrolled_count__lt=F("capacity"))
               .filter(Q(course_id__in=rec_course_ids) | Q(course__category=p.category))
               .select_related("course"))
    ordered = sorted(batches, key=lambda b: (b.course_id not in rec_course_ids, b.start_date))
    out = []
    for b in ordered[:limit]:
        left = b.capacity - b.enrolled_count
        t = time_of_day(b)
        reason = "Upcoming batch for your exam"
        if p.hours_per_day <= 3 and t == "evening":
            reason = "Evening slot that fits around your day"
        elif t == "morning":
            reason = "Morning slot for a focused start"
        elif left < 15:
            reason = f"Filling fast: only {left} seats left"
        out.append((b, reason, left))
    return out


def study_plan(p):
    subjects = list(p.subjects.all())
    weak = {s.id for s in p.weak_subjects.all()}
    pool = []
    for s in subjects:
        pool.append(s)
        if s.id in weak:
            pool.append(s)                      # weak subjects get twice the slots
    hours = p.hours_per_day
    per_day = max(2, min(4, math.ceil(hours / 1.5)))
    minutes = int(hours * 60 / per_day / 5 + 0.5) * 5

    items, k = [], 0
    for di, day in enumerate(DAYS):
        if di == 6:
            items.append({"day": day, "subjectId": subjects[0].id,
                          "title": "Full-length mock test + analysis",
                          "minutes": min(180, hours * 45)})
            continue
        for _ in range(per_day):
            s = pool[k % len(pool)]
            task = TASK_TYPES[(k + di) % len(TASK_TYPES)]
            items.append({"day": day, "subjectId": s.id, "title": f"{s.name}: {task}",
                          "minutes": minutes + 15 if s.id in weak else minutes})
            k += 1
    return items


def profile_completion(p):
    filled = [p.stage, p.category_id, p.track_id, p.target_year, p.level, p.hours_per_day]
    return round((sum(1 for f in filled if f) + 1) / 7 * 100)   # +1: subjects are required
