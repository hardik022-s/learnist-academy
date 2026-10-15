from django_filters import rest_framework as df
from rest_framework import viewsets

from . import models as m
from . import serializers as s


class CourseFilter(df.FilterSet):
    category = df.CharFilter(field_name="category_id")
    track = df.CharFilter(field_name="track_id")
    level = df.CharFilter(field_name="level", lookup_expr="iexact")
    type = df.CharFilter(field_name="type", lookup_expr="iexact")
    subject = df.CharFilter(field_name="subjects__id", distinct=True)
    minPrice = df.NumberFilter(field_name="price", lookup_expr="gte")
    maxPrice = df.NumberFilter(field_name="price", lookup_expr="lte")
    featured = df.BooleanFilter(field_name="is_featured")

    class Meta:
        model = m.Course
        fields = []


class BatchFilter(df.FilterSet):
    category = df.CharFilter(field_name="course__category_id")
    course = df.CharFilter(field_name="course_id")
    faculty = df.CharFilter(field_name="faculty_id")
    status = df.CharFilter(field_name="status", lookup_expr="iexact")

    class Meta:
        model = m.Batch
        fields = []


class FacultyFilter(df.FilterSet):
    category = df.CharFilter(field_name="categories__id", distinct=True)

    class Meta:
        model = m.Faculty
        fields = []


class ResultFilter(df.FilterSet):
    category = df.CharFilter(field_name="category", lookup_expr="iexact")
    year = df.NumberFilter(field_name="year")

    class Meta:
        model = m.Result
        fields = []


class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = m.Category.objects.prefetch_related("tracks", "subjects")
    serializer_class = s.CategorySerializer


class CourseViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = m.Course.objects.filter(is_active=True).prefetch_related("subjects", "faculty")
    serializer_class = s.CourseSerializer
    lookup_field = "slug"                      # /api/courses/<slug>/
    filterset_class = CourseFilter
    search_fields = ["title", "description"]
    ordering_fields = ["price", "created_at", "title"]
    ordering = ["-is_featured", "title"]


class FacultyViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = m.Faculty.objects.filter(is_active=True).prefetch_related("categories", "subjects")
    serializer_class = s.FacultySerializer
    filterset_class = FacultyFilter
    search_fields = ["name", "bio"]


class BatchViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = m.Batch.objects.filter(course__is_active=True)
    serializer_class = s.BatchSerializer
    filterset_class = BatchFilter
    search_fields = ["name"]
    ordering = ["start_date"]


class ResultViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = m.Result.objects.all()
    serializer_class = s.ResultSerializer
    filterset_class = ResultFilter


class FAQViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = m.FAQ.objects.all()
    serializer_class = s.FAQSerializer
    filterset_fields = ["topic"]