from django.conf import settings
from django.db import models

SLOTS = ["Morning (8 - 10 AM)", "Afternoon (2 - 4 PM)", "Evening (6 - 8 PM)"]


class DemoBooking(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING"
        CONFIRMED = "CONFIRMED"
        COMPLETED = "COMPLETED"
        CANCELLED = "CANCELLED"

    class Source(models.TextChoices):
        WEBSITE = "WEBSITE"
        CHATBOT = "CHATBOT"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                             on_delete=models.SET_NULL, related_name="demo_bookings")
    name = models.CharField(max_length=120)
    phone = models.CharField(max_length=20)
    course = models.ForeignKey("catalog.Course", on_delete=models.PROTECT, related_name="demo_bookings")
    batch = models.ForeignKey("catalog.Batch", null=True, blank=True, on_delete=models.SET_NULL)
    preferred_date = models.DateField()
    slot = models.CharField(max_length=30, choices=[(s, s) for s in SLOTS], default=SLOTS[2])
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.PENDING)
    source = models.CharField(max_length=10, choices=Source.choices, default=Source.WEBSITE)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} - {self.course_id} ({self.preferred_date})"


class Enquiry(models.Model):
    class Status(models.TextChoices):
        NEW = "NEW"
        CONTACTED = "CONTACTED"
        CLOSED = "CLOSED"

    name = models.CharField(max_length=120)
    email = models.EmailField()
    phone = models.CharField(max_length=20)
    category = models.ForeignKey("catalog.Category", null=True, blank=True, on_delete=models.SET_NULL)
    message = models.TextField()
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.NEW)
    source = models.CharField(max_length=10, default="WEBSITE")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name_plural = "enquiries"

    def __str__(self):
        return f"{self.name}: {self.message[:40]}"