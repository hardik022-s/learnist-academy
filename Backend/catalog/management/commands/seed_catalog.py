import json

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction

from catalog import models as m


class Command(BaseCommand):
    help = "Load the content from data/seed.json (converted from Frontend/data.js)"

    @transaction.atomic
    def handle(self, *args, **options):
        data = json.loads((settings.BASE_DIR / "data" / "seed.json").read_text(encoding="utf-8"))

        for c in data["CATEGORIES"]:
            cat, _ = m.Category.objects.update_or_create(id=c["id"], defaults=dict(
                name=c["name"], icon=c.get("icon", ""), tint=c.get("tint", ""),
                accent=c.get("accent", ""), description=c.get("description", "")))
            for t in c.get("tracks", []):
                m.Track.objects.update_or_create(id=t["id"], defaults=dict(category=cat, name=t["name"]))
            for s in c.get("subjects", []):
                m.Subject.objects.update_or_create(id=s["id"], defaults=dict(
                    category=cat, name=s["name"], color=s.get("color", "")))

        for f in data["FACULTY"]:
            fac, _ = m.Faculty.objects.update_or_create(id=f["id"], defaults=dict(
                name=f["name"], experience=f.get("experience", ""),
                qualifications=f.get("qualifications", ""), photo=f.get("photo", ""),
                bio=f.get("bio", "")))
            fac.categories.set(m.Category.objects.filter(id__in=f.get("categoryIds", [])))
            fac.subjects.set(m.Subject.objects.filter(id__in=f.get("subjectIds", [])))

        for c in data["COURSES"]:
            course, _ = m.Course.objects.update_or_create(id=c["id"], defaults=dict(
                title=c["title"], slug=c["slug"], category_id=c["categoryId"],
                track_id=c.get("trackId"), type=c.get("type", ""), level=c.get("level", ""),
                price=c.get("price", 0), original_price=c.get("originalPrice"),
                duration=c.get("duration", ""), total_hours=c.get("totalHours", 0),
                total_tests=c.get("totalTests", 0), is_featured=c.get("isFeatured", False),
                description=c.get("description", ""), highlights=c.get("highlights", [])))
            course.subjects.set(m.Subject.objects.filter(id__in=c.get("subjectIds", [])))
            course.faculty.set(m.Faculty.objects.filter(id__in=c.get("facultyIds", [])))

        course_ids = set(m.Course.objects.values_list("id", flat=True))
        for b in data["BATCHES"]:
            if b["courseId"] not in course_ids:
                self.stdout.write(self.style.WARNING(
                    f"SKIPPED batch {b['id']}: course '{b['courseId']}' does not exist"))
                continue
            m.Batch.objects.update_or_create(id=b["id"], defaults=dict(
                name=b["name"], course_id=b["courseId"], faculty_id=b.get("facultyId"),
                start_date=b["startDate"], schedule_days=b.get("scheduleDays", ""),
                schedule_time=b.get("scheduleTime", ""), capacity=b.get("capacity", 0),
                enrolled_count=b.get("enrolledCount", 0), status=b.get("status", "")))

        for r in data["RESULTS"]:
            m.Result.objects.update_or_create(id=r["id"], defaults=dict(
                student_name=r["studentName"], category=r.get("category", ""),
                exam=r.get("exam", ""), rank_or_score=r.get("rankOrScore", ""),
                year=r.get("year"), photo=r.get("photo", ""), quote=r.get("quote", "")))

        for q in data["FAQS"]:
            m.FAQ.objects.update_or_create(id=q["id"], defaults=dict(
                topic=q.get("topic", ""), question=q["question"], answer=q["answer"]))

        for model in (m.Category, m.Track, m.Subject, m.Faculty, m.Course, m.Batch, m.Result, m.FAQ):
            self.stdout.write(f"{model.__name__}: {model.objects.count()}")