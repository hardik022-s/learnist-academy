from django.db import models


class Category(models.Model):
    id = models.CharField(primary_key=True, max_length=40)
    name = models.CharField(max_length=60)
    icon = models.CharField(max_length=30, blank=True)
    tint = models.CharField(max_length=10, blank=True)
    accent = models.CharField(max_length=10, blank=True)
    description = models.TextField(blank=True)

    class Meta:
        verbose_name_plural = "categories"

    def __str__(self):
        return self.name


class Track(models.Model):
    id = models.CharField(primary_key=True, max_length=60)
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name="tracks")
    name = models.CharField(max_length=60)

    def __str__(self):
        return f"{self.category_id}: {self.name}"


class Subject(models.Model):
    id = models.CharField(primary_key=True, max_length=60)
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name="subjects")
    name = models.CharField(max_length=80)
    color = models.CharField(max_length=10, blank=True)

    def __str__(self):
        return self.name


class Faculty(models.Model):
    id = models.CharField(primary_key=True, max_length=60)
    name = models.CharField(max_length=120)
    experience = models.CharField(max_length=120, blank=True)
    qualifications = models.CharField(max_length=200, blank=True)
    photo = models.URLField(max_length=500, blank=True)
    bio = models.TextField(blank=True)
    categories = models.ManyToManyField(Category, blank=True)
    subjects = models.ManyToManyField(Subject, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name_plural = "faculty"

    def __str__(self):
        return self.name


class Course(models.Model):
    id = models.CharField(primary_key=True, max_length=60)
    title = models.CharField(max_length=200)
    slug = models.SlugField(max_length=200, unique=True)
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="courses")
    track = models.ForeignKey(Track, null=True, blank=True, on_delete=models.SET_NULL)
    type = models.CharField(max_length=30, blank=True)
    level = models.CharField(max_length=20, blank=True)
    price = models.PositiveIntegerField(default=0)
    original_price = models.PositiveIntegerField(null=True, blank=True)
    duration = models.CharField(max_length=40, blank=True)
    total_hours = models.PositiveIntegerField(default=0)
    total_tests = models.PositiveIntegerField(default=0)
    description = models.TextField(blank=True)
    highlights = models.JSONField(default=list, blank=True)
    subjects = models.ManyToManyField(Subject, blank=True)
    faculty = models.ManyToManyField(Faculty, blank=True)
    is_featured = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title


class Batch(models.Model):
    id = models.CharField(primary_key=True, max_length=60)
    name = models.CharField(max_length=200)
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="batches")
    faculty = models.ForeignKey(Faculty, null=True, blank=True, on_delete=models.SET_NULL)
    start_date = models.DateField()
    schedule_days = models.CharField(max_length=60, blank=True)
    schedule_time = models.CharField(max_length=60, blank=True)
    capacity = models.PositiveIntegerField(default=0)
    enrolled_count = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=20, blank=True)

    def __str__(self):
        return self.name


class Result(models.Model):
    id = models.CharField(primary_key=True, max_length=60)
    student_name = models.CharField(max_length=120)
    category = models.CharField(max_length=40, blank=True)
    exam = models.CharField(max_length=120, blank=True)
    rank_or_score = models.CharField(max_length=120, blank=True)
    year = models.PositiveSmallIntegerField(null=True, blank=True)
    photo = models.URLField(max_length=500, blank=True)
    quote = models.TextField(blank=True)
    is_featured = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.student_name} ({self.exam})"


class FAQ(models.Model):
    id = models.CharField(primary_key=True, max_length=60)
    topic = models.CharField(max_length=40, blank=True)
    question = models.CharField(max_length=300)
    answer = models.TextField()

    class Meta:
        verbose_name = "FAQ"

    def __str__(self):
        return self.question