from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import User


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