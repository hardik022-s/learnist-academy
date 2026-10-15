import re

from django.utils import timezone
from rest_framework import serializers

from catalog.models import Batch, Category, Course
from .models import DemoBooking, Enquiry


def check_phone(value):
    if len(re.sub(r"\D", "", value)) < 10:
        raise serializers.ValidationError("Enter a valid phone number.")
    return value.strip()


class DemoBookingSerializer(serializers.ModelSerializer):
    courseId = serializers.PrimaryKeyRelatedField(source="course", queryset=Course.objects.filter(is_active=True))
    batchId = serializers.PrimaryKeyRelatedField(source="batch", queryset=Batch.objects.all(),
                                                 required=False, allow_null=True)
    date = serializers.DateField(source="preferred_date")
    courseTitle = serializers.CharField(source="course.title", read_only=True)
    batchName = serializers.SerializerMethodField()
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = DemoBooking
        fields = ["id", "name", "phone", "courseId", "batchId", "date", "slot", "notes",
                  "status", "source", "createdAt", "courseTitle", "batchName"]
        read_only_fields = ["status", "source"]

    def get_batchName(self, obj):
        return obj.batch.name if obj.batch else None

    def validate_name(self, value):
        if len(value.strip()) < 2:
            raise serializers.ValidationError("Enter your name.")
        return value.strip()

    def validate_phone(self, value):
        return check_phone(value)

    def validate_date(self, value):
        if value < timezone.localdate():
            raise serializers.ValidationError("Choose today or a future date.")
        return value

    def validate(self, data):
        batch, course = data.get("batch"), data.get("course")
        if batch and course and batch.course_id != course.id:
            raise serializers.ValidationError({"batchId": "This batch does not belong to the chosen course."})
        return data


class EnquirySerializer(serializers.ModelSerializer):
    categoryId = serializers.PrimaryKeyRelatedField(source="category", queryset=Category.objects.all(),
                                                    required=False, allow_null=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = Enquiry
        fields = ["id", "name", "email", "phone", "categoryId", "message", "status", "createdAt"]
        read_only_fields = ["status"]

    def validate_name(self, value):
        if len(value.strip()) < 2:
            raise serializers.ValidationError("Enter your name.")
        return value.strip()

    def validate_phone(self, value):
        return check_phone(value)

    def validate_message(self, value):
        if len(value.strip()) < 5:
            raise serializers.ValidationError("Tell us a little more.")
        return value.strip()
    