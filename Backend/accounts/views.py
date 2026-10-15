from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView
from .models import StudentProfile
from .permissions import IsStudentRole
from .serializers import StudentProfileSerializer

from .serializers import LoginSerializer, RegisterSerializer, UserSerializer


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    def create(self, request, *args, **kwargs):
        ser = self.get_serializer(data=request.data)
        ser.is_valid(raise_exception=True)
        user = ser.save()
        refresh = RefreshToken.for_user(user)
        return Response(
            {"user": UserSerializer(user).data,
             "access": str(refresh.access_token),
             "refresh": str(refresh)},
            status=status.HTTP_201_CREATED,
        )


class LoginView(TokenObtainPairView):
    serializer_class = LoginSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

class OnboardingView(APIView):
    permission_classes = [IsAuthenticated, IsStudentRole]

    def post(self, request):
        existing = StudentProfile.objects.filter(user=request.user).first()
        ser = StudentProfileSerializer(existing, data=request.data)
        ser.is_valid(raise_exception=True)
        ser.save(user=request.user)
        if not request.user.profile_complete:
            request.user.profile_complete = True
            request.user.save(update_fields=["profile_complete"])
        return Response({"profile": ser.data, "profileComplete": True})


class StudentProfileView(APIView):
    permission_classes = [IsAuthenticated, IsStudentRole]

    def _profile(self, request):
        return StudentProfile.objects.filter(user=request.user).first()

    def get(self, request):
        profile = self._profile(request)
        if not profile:
            return Response({"detail": "Onboarding not completed."}, status=404)
        return Response(StudentProfileSerializer(profile).data)

    def patch(self, request):
        profile = self._profile(request)
        if not profile:
            return Response({"detail": "Onboarding not completed."}, status=404)
        ser = StudentProfileSerializer(profile, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)