import uuid
from datetime import timedelta

from django.urls import path
from django.utils import timezone
from django.utils.text import slugify
from rest_framework import mixins, serializers, viewsets
from rest_framework.response import Response
from rest_framework.routers import SimpleRouter
from rest_framework.views import APIView

from catalog.models import Batch, Category, Course, Faculty, Subject, Track
from leads.models import DemoBooking, Enquiry
from leads.serializers import DemoBookingSerializer, EnquirySerializer

from .models import User
from .permissions import IsAdminRole
from .serializers import StudentProfileSerializer

COURSE_TYPES = ["FOUNDATION", "FULL_COURSE", "CRASH", "SUBJECT_INTENSIVE", "TEST_SERIES"]
LEVELS = ["BEGINNER", "INTERMEDIATE", "ADVANCED"]
BATCH_STATUSES = ["UPCOMING", "ONGOING", "COMPLETED"]


def new_id(prefix):
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


# ---------------------------------------------------------------- serializers
class AdminCourseSerializer(serializers.ModelSerializer):
    categoryId = serializers.PrimaryKeyRelatedField(source="category", queryset=Category.objects.all())
    trackId = serializers.PrimaryKeyRelatedField(source="track", queryset=Track.objects.all(),
                                                 required=False, allow_null=True)
    type = serializers.ChoiceField(choices=COURSE_TYPES)
    level = serializers.ChoiceField(choices=LEVELS)
    originalPrice = serializers.IntegerField(source="original_price", required=False,
                                             allow_null=True, min_value=0)
    totalHours = serializers.IntegerField(source="total_hours", required=False, min_value=0)
    totalTests = serializers.IntegerField(source="total_tests", required=False, min_value=0)
    isFeatured = serializers.BooleanField(source="is_featured", required=False)
    isActive = serializers.BooleanField(source="is_active", required=False)
    subjectIds = serializers.PrimaryKeyRelatedField(source="subjects", many=True,
                                                    queryset=Subject.objects.all(), required=False)
    facultyIds = serializers.PrimaryKeyRelatedField(source="faculty", many=True,
                                                    queryset=Faculty.objects.all(), required=False)

    class Meta:
        model = Course
        fields = ["id", "title", "slug", "categoryId", "trackId", "type", "level", "price",
                  "originalPrice", "duration", "totalHours", "totalTests", "isFeatured", "isActive",
                  "description", "highlights", "subjectIds", "facultyIds"]
        read_only_fields = ["id", "slug"]
        extra_kwargs = {"price": {"required": True}, "duration": {"required": True, "allow_blank": False}}

    def validate(self, data):
        inst = self.instance
        category = data.get("category", inst.category if inst else None)
        track = data.get("track", inst.track if inst else None)
        if track and track.category_id != category.id:
            raise serializers.ValidationError({"trackId": "This track does not belong to the chosen exam."})
        if any(s.category_id != category.id for s in data.get("subjects", [])):
            raise serializers.ValidationError({"subjectIds": "All subjects must belong to the chosen exam."})
        return data

    def create(self, validated):
        validated["id"] = new_id("course")
        validated["slug"] = f"{slugify(validated['title'])[:150]}-{uuid.uuid4().hex[:4]}"
        if not validated.get("track"):
            validated["track"] = validated["category"].tracks.first()
        course = super().create(validated)
        if not course.subjects.exists():                      # default: all subjects of the exam
            course.subjects.set(course.category.subjects.all())
        return course


class AdminFacultySerializer(serializers.ModelSerializer):
    categoryIds = serializers.PrimaryKeyRelatedField(source="categories", many=True,
                                                     queryset=Category.objects.all(), required=False)
    subjectIds = serializers.PrimaryKeyRelatedField(source="subjects", many=True,
                                                    queryset=Subject.objects.all(), required=False)
    isActive = serializers.BooleanField(source="is_active", required=False)

    class Meta:
        model = Faculty
        fields = ["id", "name", "experience", "qualifications", "photo", "bio",
                  "categoryIds", "subjectIds", "isActive"]
        read_only_fields = ["id"]

    def create(self, validated):
        validated["id"] = new_id("fac")
        return super().create(validated)


class AdminBatchSerializer(serializers.ModelSerializer):
    courseId = serializers.PrimaryKeyRelatedField(source="course", queryset=Course.objects.all())
    courseTitle = serializers.CharField(source="course.title", read_only=True)
    facultyId = serializers.PrimaryKeyRelatedField(source="faculty", queryset=Faculty.objects.all(),
                                                   required=False, allow_null=True)
    startDate = serializers.DateField(source="start_date")
    scheduleDays = serializers.CharField(source="schedule_days", required=False, allow_blank=True)
    scheduleTime = serializers.CharField(source="schedule_time", required=False, allow_blank=True)
    capacity = serializers.IntegerField(min_value=1, default=100)
    enrolledCount = serializers.IntegerField(source="enrolled_count", min_value=0, required=False)
    status = serializers.ChoiceField(choices=BATCH_STATUSES, default="UPCOMING")

    class Meta:
        model = Batch
        fields = ["id", "name", "courseId", "courseTitle", "facultyId", "startDate",
                  "scheduleDays", "scheduleTime", "capacity", "enrolledCount", "status"]
        read_only_fields = ["id"]

    def validate(self, data):
        inst = self.instance
        capacity = data.get("capacity", inst.capacity if inst else 100)
        enrolled = data.get("enrolled_count", inst.enrolled_count if inst else 0)
        if enrolled > capacity:
            raise serializers.ValidationError({"enrolledCount": "Cannot exceed capacity."})
        return data

    def create(self, validated):
        validated["id"] = new_id("batch")
        return super().create(validated)


class AdminBookingSerializer(DemoBookingSerializer):
    """Same output as the public one, but only `status` can be changed."""
    courseId = serializers.PrimaryKeyRelatedField(source="course", read_only=True)
    batchId = serializers.PrimaryKeyRelatedField(source="batch", read_only=True)
    date = serializers.DateField(source="preferred_date", read_only=True)

    class Meta(DemoBookingSerializer.Meta):
        read_only_fields = ["name", "phone", "slot", "notes", "source"]


class AdminEnquirySerializer(EnquirySerializer):
    categoryId = serializers.PrimaryKeyRelatedField(source="category", read_only=True)

    class Meta(EnquirySerializer.Meta):
        read_only_fields = ["name", "email", "phone", "message"]


class AdminStudentSerializer(serializers.ModelSerializer):
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    profileComplete = serializers.BooleanField(source="profile_complete", read_only=True)
    exam = serializers.SerializerMethodField()
    profile = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "name", "email", "phone", "createdAt", "profileComplete", "exam", "profile"]

    def get_exam(self, user):
        p = getattr(user, "profile", None)
        return f"{p.category.name} {p.track.name}" if p else None

    def get_profile(self, user):
        p = getattr(user, "profile", None)
        return StudentProfileSerializer(p).data if p else None


# ---------------------------------------------------------------------- views
class AdminCourseViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminRole]
    queryset = Course.objects.all().prefetch_related("subjects", "faculty").order_by("-created_at")
    serializer_class = AdminCourseSerializer
    filterset_fields = ["category", "type", "level", "is_active", "is_featured"]
    search_fields = ["title"]

    def perform_destroy(self, instance):          # archive, do not delete
        instance.is_active = False
        instance.save(update_fields=["is_active"])


class AdminFacultyViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminRole]
    queryset = Faculty.objects.all().prefetch_related("categories", "subjects").order_by("name")
    serializer_class = AdminFacultySerializer
    search_fields = ["name"]

    def perform_destroy(self, instance):          # archive, do not delete
        instance.is_active = False
        instance.save(update_fields=["is_active"])


class AdminBatchViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminRole]
    queryset = Batch.objects.select_related("course").order_by("start_date")
    serializer_class = AdminBatchSerializer
    filterset_fields = ["status", "course", "faculty"]
    search_fields = ["name"]


class AdminBookingViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin,
                          mixins.UpdateModelMixin, viewsets.GenericViewSet):
    permission_classes = [IsAdminRole]
    queryset = DemoBooking.objects.select_related("course", "batch")
    serializer_class = AdminBookingSerializer
    http_method_names = ["get", "patch", "head", "options"]
    filterset_fields = ["status", "source", "course"]
    search_fields = ["name", "phone"]


class AdminEnquiryViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin,
                          mixins.UpdateModelMixin, viewsets.GenericViewSet):
    permission_classes = [IsAdminRole]
    queryset = Enquiry.objects.all()
    serializer_class = AdminEnquirySerializer
    http_method_names = ["get", "patch", "head", "options"]
    filterset_fields = ["status", "category"]
    search_fields = ["name", "email", "phone", "message"]


class AdminStudentViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAdminRole]
    queryset = (User.objects.filter(role="STUDENT")
                .select_related("profile__category", "profile__track")
                .prefetch_related("profile__subjects", "profile__weak_subjects")
                .order_by("-created_at"))
    serializer_class = AdminStudentSerializer
    search_fields = ["name", "email", "phone"]


class AdminStatsView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        students = User.objects.filter(role="STUDENT")
        week_ago = timezone.now() - timedelta(days=7)
        return Response({
            "totalStudents": students.count(),
            "newStudents7d": students.filter(created_at__gte=week_ago).count(),
            "newEnquiries": Enquiry.objects.filter(status="NEW").count(),
            "demoBookings": DemoBooking.objects.count(),
            "pendingBookings": DemoBooking.objects.filter(status="PENDING").count(),
            "upcomingBatches": Batch.objects.filter(status="UPCOMING").count(),
            "activeCourses": Course.objects.filter(is_active=True).count(),
        })


router = SimpleRouter()
router.register("students", AdminStudentViewSet, basename="admin-student")
router.register("courses", AdminCourseViewSet, basename="admin-course")
router.register("faculty", AdminFacultyViewSet, basename="admin-faculty")
router.register("batches", AdminBatchViewSet, basename="admin-batch")
router.register("demo-bookings", AdminBookingViewSet, basename="admin-booking")
router.register("enquiries", AdminEnquiryViewSet, basename="admin-enquiry")

admin_urls = [path("stats/", AdminStatsView.as_view())] + router.urls