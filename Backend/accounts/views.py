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
from django.utils import timezone
from catalog.serializers import BatchSerializer, CourseSerializer, SubjectSerializer
from .recommend import (profile_completion, recommend_batches, recommend_courses, study_plan)
from leads.models import DemoBooking
from leads.serializers import DemoBookingSerializer


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



class DashboardView(APIView):
    permission_classes = [IsAuthenticated, IsStudentRole]

    def get(self, request):
        p = (StudentProfile.objects.select_related("category", "track")
             .filter(user=request.user).first())
        if not p:
            return Response({"detail": "Onboarding not completed."}, status=409)

        recs = recommend_courses(p)
        rec_ids = {c.id for c, _ in recs}
        weak = {s.id for s in p.weak_subjects.all()}
        hour = timezone.localtime().hour
        greet = "Good morning" if hour < 12 else "Good afternoon" if hour < 17 else "Good evening"
        first_name = request.user.name.split()[0] if request.user.name else ""
        upcoming = (DemoBooking.objects
                .filter(user=request.user, preferred_date__gte=timezone.localdate(),
                        status__in=["PENDING", "CONFIRMED"])
                .select_related("course", "batch").order_by("preferred_date").first())

        return Response({
            "student": UserSerializer(request.user).data,
            "profile": StudentProfileSerializer(p).data,
            "greeting": f"{greet}, {first_name}",
            "summary": f"Preparing for {p.category.name} {p.track.name} {p.target_year}",
            "recommendedCourses": [{**CourseSerializer(c).data, "reason": r} for c, r in recs],
            "recommendedBatches": [{**BatchSerializer(b).data, "reason": r, "seatsLeft": left}
                                   for b, r, left in recommend_batches(p, rec_ids)],
            "recommendedSubjects": [{**SubjectSerializer(s).data, "weak": s.id in weak}
                                    for s in p.subjects.all()],
            "studyFocus": {"hoursPerDay": p.hours_per_day, "week": study_plan(p)},
            "upcomingDemo":DemoBookingSerializer(upcoming).data if upcoming else None,
            "profileCompletion": profile_completion(p),
        })