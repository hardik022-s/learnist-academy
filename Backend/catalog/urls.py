from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register("categories", views.CategoryViewSet, basename="category")
router.register("courses", views.CourseViewSet, basename="course")
router.register("faculty", views.FacultyViewSet, basename="faculty")
router.register("batches", views.BatchViewSet, basename="batch")
router.register("results", views.ResultViewSet, basename="result")
router.register("faqs", views.FAQViewSet, basename="faq")

urlpatterns = router.urls