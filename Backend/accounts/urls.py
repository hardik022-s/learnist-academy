from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import LoginView, MeView, RegisterView
from .views import DashboardView, LoginView, MeView, OnboardingView, RegisterView, StudentProfileView

urlpatterns = [
    path("register/", RegisterView.as_view()),
    path("login/", LoginView.as_view()),
    path("refresh/", TokenRefreshView.as_view()),
    path("me/", MeView.as_view()),
]

from .views import OnboardingView, StudentProfileView

student_urls = [
    path("onboarding/", OnboardingView.as_view()),
    path("profile/", StudentProfileView.as_view()),
    path("dashboard/", DashboardView.as_view()),
]