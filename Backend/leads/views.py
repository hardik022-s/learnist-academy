from rest_framework import generics
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.throttling import ScopedRateThrottle

from .models import DemoBooking
from .serializers import DemoBookingSerializer, EnquirySerializer


class DemoBookingListCreate(generics.ListCreateAPIView):
    """POST: anyone (guests too). GET: the logged-in student's own bookings."""
    serializer_class = DemoBookingSerializer
    throttle_scope = "forms"

    def get_permissions(self):
        return [AllowAny()] if self.request.method == "POST" else [IsAuthenticated()]

    def get_throttles(self):
        return [ScopedRateThrottle()] if self.request.method == "POST" else []

    def get_queryset(self):
        return DemoBooking.objects.filter(user=self.request.user).select_related("course", "batch")

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(user=user, source="WEBSITE")


class EnquiryCreate(generics.CreateAPIView):
    serializer_class = EnquirySerializer
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "forms"

    def perform_create(self, serializer):
        serializer.save(source="WEBSITE")