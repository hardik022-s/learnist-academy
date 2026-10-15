from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import User
from datetime import date
from catalog.models import Category, Subject, Track
from .models import StudentProfile


class UserSerializer(serializers.ModelSerializer):
    profileComplete = serializers.BooleanField(source="profile_complete", read_only=True)

    class Meta:
        model = User
        fields = ["id", "name", "email", "phone", "role", "profileComplete"]


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    confirmPassword = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ["name", "email", "phone", "password", "confirmPassword"]

    def validate_email(self, value):
        if User.objects.filter(email=value.lower()).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value.lower()

    def validate(self, data):
        if data["password"] != data.pop("confirmPassword"):
            raise serializers.ValidationError({"confirmPassword": "Passwords do not match."})
        validate_password(data["password"])
        return data

    def create(self, validated):
        return User.objects.create_user(role="STUDENT", **validated)


class LoginSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = UserSerializer(self.user).data
        return data

STAGE_EXAMS = {
    "Class 8": ["foundation"], "Class 9": ["foundation"], "Class 10": ["foundation"],
    "Class 11": ["jee", "neet"],
    "Class 12": ["jee", "neet", "ca", "law", "defence"],
    "Dropper": ["jee", "neet", "law", "defence"],
    "Graduate": ["upsc", "ssc", "banking", "railways", "defence", "teaching", "state-psc", "ca", "law"],
    "Working Professional": ["upsc", "ssc", "banking", "railways", "teaching", "state-psc", "ca"],
}


class StudentProfileSerializer(serializers.ModelSerializer):
    categoryId = serializers.PrimaryKeyRelatedField(source="category", queryset=Category.objects.all())
    trackId = serializers.PrimaryKeyRelatedField(source="track", queryset=Track.objects.all())
    targetYear = serializers.IntegerField(source="target_year")
    subjects = serializers.PrimaryKeyRelatedField(many=True, queryset=Subject.objects.all(), allow_empty=False)
    weakSubjects = serializers.PrimaryKeyRelatedField(
        source="weak_subjects", many=True, queryset=Subject.objects.all(), required=False)
    hours = serializers.IntegerField(source="hours_per_day", min_value=1, max_value=10)

    class Meta:
        model = StudentProfile
        fields = ["stage", "categoryId", "trackId", "targetYear", "subjects",
                  "weakSubjects", "level", "hours"]

    def validate_targetYear(self, value):
        year = date.today().year
        if not year <= value <= year + 5:
            raise serializers.ValidationError(f"Target year must be between {year} and {year + 5}.")
        return value

    def validate(self, data):
        inst = self.instance
        stage = data.get("stage", inst.stage if inst else None)
        category = data.get("category", inst.category if inst else None)
        track = data.get("track", inst.track if inst else None)
        subjects = data.get("subjects", list(inst.subjects.all()) if inst else [])
        weak = data.get("weak_subjects", list(inst.weak_subjects.all()) if inst else [])

        if category.id not in STAGE_EXAMS.get(stage, []):
            raise serializers.ValidationError({"categoryId": "This exam is not available for your stage."})
        if track.category_id != category.id:
            raise serializers.ValidationError({"trackId": "This track does not belong to the chosen exam."})
        if any(s.category_id != category.id for s in subjects):
            raise serializers.ValidationError({"subjects": "All subjects must belong to the chosen exam."})
        if not set(weak) <= set(subjects):
            raise serializers.ValidationError({"weakSubjects": "Weak subjects must be among your selected subjects."})
        return data