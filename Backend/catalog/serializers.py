from rest_framework import serializers
from . import models as m


class TrackSerializer(serializers.ModelSerializer):
    class Meta:
        model = m.Track
        fields = ["id", "name"]


class SubjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = m.Subject
        fields = ["id", "name", "color"]


class CategorySerializer(serializers.ModelSerializer):
    tracks = TrackSerializer(many=True, read_only=True)
    subjects = SubjectSerializer(many=True, read_only=True)

    class Meta:
        model = m.Category
        fields = ["id", "name", "icon", "tint", "accent", "description", "tracks", "subjects"]


class CourseSerializer(serializers.ModelSerializer):
    categoryId = serializers.CharField(source="category_id", read_only=True)
    trackId = serializers.CharField(source="track_id", read_only=True)
    originalPrice = serializers.IntegerField(source="original_price", read_only=True)
    totalHours = serializers.IntegerField(source="total_hours", read_only=True)
    totalTests = serializers.IntegerField(source="total_tests", read_only=True)
    isFeatured = serializers.BooleanField(source="is_featured", read_only=True)
    subjectIds = serializers.PrimaryKeyRelatedField(source="subjects", many=True, read_only=True)
    facultyIds = serializers.PrimaryKeyRelatedField(source="faculty", many=True, read_only=True)

    class Meta:
        model = m.Course
        fields = ["id", "title", "slug", "categoryId", "trackId", "type", "level", "price",
                  "originalPrice", "duration", "totalHours", "totalTests", "isFeatured",
                  "description", "highlights", "subjectIds", "facultyIds"]


class FacultySerializer(serializers.ModelSerializer):
    categoryIds = serializers.PrimaryKeyRelatedField(source="categories", many=True, read_only=True)
    subjectIds = serializers.PrimaryKeyRelatedField(source="subjects", many=True, read_only=True)

    class Meta:
        model = m.Faculty
        fields = ["id", "name", "experience", "qualifications", "photo", "bio",
                  "categoryIds", "subjectIds"]


class BatchSerializer(serializers.ModelSerializer):
    courseId = serializers.CharField(source="course_id", read_only=True)
    facultyId = serializers.CharField(source="faculty_id", read_only=True)
    startDate = serializers.DateField(source="start_date", read_only=True)
    scheduleDays = serializers.CharField(source="schedule_days", read_only=True)
    scheduleTime = serializers.CharField(source="schedule_time", read_only=True)
    enrolledCount = serializers.IntegerField(source="enrolled_count", read_only=True)

    class Meta:
        model = m.Batch
        fields = ["id", "name", "courseId", "facultyId", "startDate", "scheduleDays",
                  "scheduleTime", "capacity", "enrolledCount", "status"]


class ResultSerializer(serializers.ModelSerializer):
    studentName = serializers.CharField(source="student_name", read_only=True)
    rankOrScore = serializers.CharField(source="rank_or_score", read_only=True)

    class Meta:
        model = m.Result
        fields = ["id", "studentName", "category", "exam", "rankOrScore", "year", "photo", "quote"]


class FAQSerializer(serializers.ModelSerializer):
    class Meta:
        model = m.FAQ
        fields = ["id", "topic", "question", "answer"]