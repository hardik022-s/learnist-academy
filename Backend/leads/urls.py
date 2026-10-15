from django.urls import path
from .views import DemoBookingListCreate, EnquiryCreate

urlpatterns = [
    path("demo-bookings/", DemoBookingListCreate.as_view()),
    path("enquiries/", EnquiryCreate.as_view()),
]
