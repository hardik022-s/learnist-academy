from datetime import timedelta
from io import StringIO

from django.core.cache import cache
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from catalog.models import Batch, Course
from .models import User

PASSWORD = "Student@123"
YEAR = timezone.localdate().year

JEE = {"stage": "Class 11", "categoryId": "jee", "trackId": "jee-class-11", "targetYear": YEAR + 1,
       "subjects": ["jee-physics", "jee-chemistry", "jee-maths"], "weakSubjects": ["jee-physics"],
       "level": "BEGINNER", "hours": 2}
NEET = {"stage": "Class 12", "categoryId": "neet", "trackId": "neet-class-12", "targetYear": YEAR + 1,
        "subjects": ["neet-physics", "neet-chemistry", "neet-biology"], "weakSubjects": ["neet-biology"],
        "level": "ADVANCED", "hours": 5}


@override_settings(SECURE_SSL_REDIRECT=False)
class ApiTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_catalog", stdout=StringIO())
        User.objects.create_superuser("admin@test.com", "Admin@12345", name="Admin")

    def setUp(self):
        cache.clear()                      # reset rate-limit counters between tests
        self.anon = APIClient()

    def _authed(self, access):
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        return client

    def register(self, email="s@test.com"):
        res = self.anon.post("/api/auth/register/", {
            "name": "Test Student", "email": email, "phone": "9876543210",
            "password": PASSWORD, "confirmPassword": PASSWORD}, format="json")
        self.assertEqual(res.status_code, 201, res.data)
        return self._authed(res.data["access"])

    def onboarded(self, payload=JEE, email="s@test.com"):
        client = self.register(email)
        res = client.post("/api/student/onboarding/", payload, format="json")
        self.assertEqual(res.status_code, 200, res.data)
        return client

    def admin_client(self):
        res = self.anon.post("/api/auth/login/", {"email": "admin@test.com", "password": "Admin@12345"},
                             format="json")
        self.assertEqual(res.status_code, 200)
        return self._authed(res.data["access"])

    def booking(self, **over):
        batch = Batch.objects.filter(course_id="course-jee-target").first()
        data = {"name": "Rahul Verma", "phone": "9876543210", "courseId": "course-jee-target",
                "batchId": batch.id, "slot": "Evening (6 - 8 PM)",
                "date": (timezone.localdate() + timedelta(days=5)).isoformat()}
        data.update(over)
        return data


class AuthTests(ApiTestCase):
    def test_register_returns_tokens_and_student_role(self):
        res = self.anon.post("/api/auth/register/", {
            "name": "A", "email": "a@test.com", "phone": "9876543210",
            "password": PASSWORD, "confirmPassword": PASSWORD}, format="json")
        self.assertEqual(res.status_code, 201)
        self.assertIn("access", res.data)
        self.assertEqual(res.data["user"]["role"], "STUDENT")
        self.assertFalse(res.data["user"]["profileComplete"])

    def test_cannot_self_assign_admin_role(self):
        self.anon.post("/api/auth/register/", {
            "name": "Evil", "email": "evil@test.com", "phone": "9876543210", "role": "ADMIN",
            "password": PASSWORD, "confirmPassword": PASSWORD}, format="json")
        self.assertEqual(User.objects.get(email="evil@test.com").role, "STUDENT")

    def test_duplicate_email_rejected_case_insensitive(self):
        self.register("s@test.com")
        res = self.anon.post("/api/auth/register/", {
            "name": "B", "email": "S@Test.com", "phone": "9876543210",
            "password": PASSWORD, "confirmPassword": PASSWORD}, format="json")
        self.assertEqual(res.status_code, 400)

    def test_mismatched_passwords_rejected(self):
        res = self.anon.post("/api/auth/register/", {
            "name": "B", "email": "b@test.com", "phone": "9876543210",
            "password": PASSWORD, "confirmPassword": "Different@1"}, format="json")
        self.assertEqual(res.status_code, 400)

    def test_password_is_hashed(self):
        self.register()
        user = User.objects.get(email="s@test.com")
        self.assertNotEqual(user.password, PASSWORD)
        self.assertTrue(user.check_password(PASSWORD))

    def test_wrong_password_rejected(self):
        self.register()
        res = self.anon.post("/api/auth/login/", {"email": "s@test.com", "password": "wrong"}, format="json")
        self.assertEqual(res.status_code, 401)

    def test_me_requires_token(self):
        self.assertEqual(self.anon.get("/api/auth/me/").status_code, 401)

    def test_login_reports_profile_complete_after_onboarding(self):
        self.onboarded()
        res = self.anon.post("/api/auth/login/", {"email": "s@test.com", "password": PASSWORD}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data["user"]["profileComplete"])


class OnboardingTests(ApiTestCase):
    def test_valid_onboarding_saves_profile_and_flips_flag(self):
        client = self.onboarded()
        self.assertTrue(client.get("/api/auth/me/").data["profileComplete"])
        profile = client.get("/api/student/profile/").data
        self.assertEqual(profile["categoryId"], "jee")
        self.assertEqual(set(profile["weakSubjects"]), {"jee-physics"})

    def test_missing_required_field_rejected(self):
        client = self.register()
        payload = {k: v for k, v in JEE.items() if k != "level"}
        self.assertEqual(client.post("/api/student/onboarding/", payload, format="json").status_code, 400)

    def test_exam_must_fit_the_stage(self):
        client = self.register()
        res = client.post("/api/student/onboarding/", {**JEE, "stage": "Class 8"}, format="json")
        self.assertEqual(res.status_code, 400)

    def test_weak_subject_must_be_selected(self):
        client = self.register()
        res = client.post("/api/student/onboarding/", {**JEE, "weakSubjects": ["jee-maths"],
                                                       "subjects": ["jee-physics"]}, format="json")
        self.assertEqual(res.status_code, 400)

    def test_profile_can_be_edited(self):
        client = self.onboarded()
        res = client.patch("/api/student/profile/", {"hours": 5}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["hours"], 5)

    def test_profile_before_onboarding_is_404(self):
        self.assertEqual(self.register().get("/api/student/profile/").status_code, 404)

    def test_admin_cannot_use_student_endpoints(self):
        res = self.admin_client().post("/api/student/onboarding/", JEE, format="json")
        self.assertEqual(res.status_code, 403)


class PersonalizationTests(ApiTestCase):
    def test_jee_student_only_gets_jee_content(self):
        data = self.onboarded(JEE).get("/api/student/dashboard/").data
        self.assertTrue(data["recommendedCourses"])
        self.assertTrue(all(c["categoryId"] == "jee" for c in data["recommendedCourses"]))
        self.assertEqual({s["id"] for s in data["recommendedSubjects"]}, set(JEE["subjects"]))

    def test_neet_student_only_gets_neet_content(self):
        data = self.onboarded(NEET).get("/api/student/dashboard/").data
        self.assertTrue(data["recommendedCourses"])
        self.assertTrue(all(c["categoryId"] == "neet" for c in data["recommendedCourses"]))

    def test_every_recommendation_explains_itself(self):
        data = self.onboarded(JEE).get("/api/student/dashboard/").data
        self.assertTrue(all(c["reason"] for c in data["recommendedCourses"]))

    def test_beginner_far_from_exam_gets_no_crash_course(self):
        data = self.onboarded({**JEE, "targetYear": YEAR + 3}).get("/api/student/dashboard/").data
        self.assertNotIn("CRASH", [c["type"] for c in data["recommendedCourses"]])

    def test_weak_subject_is_flagged_and_gets_more_study_time(self):
        data = self.onboarded(JEE).get("/api/student/dashboard/").data
        weak = {s["id"]: s["weak"] for s in data["recommendedSubjects"]}
        self.assertTrue(weak["jee-physics"])
        self.assertFalse(weak["jee-maths"])
        week = data["studyFocus"]["week"]
        count = lambda sid: sum(1 for t in week if t["subjectId"] == sid)
        self.assertGreater(count("jee-physics"), count("jee-maths"))

    def test_dashboard_requires_onboarding(self):
        self.assertEqual(self.register().get("/api/student/dashboard/").status_code, 409)

    def test_dashboard_requires_login(self):
        self.assertEqual(self.anon.get("/api/student/dashboard/").status_code, 401)

    def test_dashboard_survives_empty_recommendations(self):
        client = self.onboarded(JEE)
        Course.objects.filter(category_id="jee").update(is_active=False)
        res = client.get("/api/student/dashboard/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["recommendedCourses"], [])
        self.assertEqual(res.data["recommendedBatches"], [])


class LeadsTests(ApiTestCase):
    def test_guest_can_book_demo(self):
        res = self.anon.post("/api/demo-bookings/", self.booking(), format="json")
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data["status"], "PENDING")
        self.assertEqual(res.data["source"], "WEBSITE")

    def test_client_cannot_set_status(self):
        res = self.anon.post("/api/demo-bookings/", self.booking(status="CONFIRMED", source="CHATBOT"),
                             format="json")
        self.assertEqual(res.data["status"], "PENDING")
        self.assertEqual(res.data["source"], "WEBSITE")

    def test_past_date_rejected(self):
        res = self.anon.post("/api/demo-bookings/", self.booking(date="2020-01-01"), format="json")
        self.assertEqual(res.status_code, 400)

    def test_batch_must_belong_to_course(self):
        res = self.anon.post("/api/demo-bookings/", self.booking(courseId="course-ssc-cgl-target"), format="json")
        self.assertEqual(res.status_code, 400)

    def test_bookings_list_requires_login(self):
        self.assertEqual(self.anon.get("/api/demo-bookings/").status_code, 401)

    def test_student_only_sees_own_bookings(self):
        a, b = self.register("a@test.com"), self.register("b@test.com")
        a.post("/api/demo-bookings/", self.booking(), format="json")
        self.assertEqual(len(a.get("/api/demo-bookings/").data), 1)
        self.assertEqual(len(b.get("/api/demo-bookings/").data), 0)

    def test_upcoming_demo_appears_on_dashboard(self):
        client = self.onboarded()
        booked = client.post("/api/demo-bookings/", self.booking(), format="json").data
        self.assertEqual(client.get("/api/student/dashboard/").data["upcomingDemo"]["id"], booked["id"])

    def test_enquiry_accepts_valid_and_rejects_bad_phone(self):
        good = {"name": "Arjun", "email": "arjun@test.com", "phone": "9876543210",
                "categoryId": "ca", "message": "Is CA Foundation available?"}
        res = self.anon.post("/api/enquiries/", good, format="json")
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["status"], "NEW")
        self.assertEqual(self.anon.post("/api/enquiries/", {**good, "phone": "123"}, format="json").status_code, 400)


class AdminTests(ApiTestCase):
    ADMIN_PATHS = ["stats", "students", "courses", "faculty", "batches", "demo-bookings", "enquiries"]

    def test_student_cannot_open_admin_routes(self):
        client = self.register()
        for path in self.ADMIN_PATHS:
            self.assertEqual(client.get(f"/api/admin/{path}/").status_code, 403, path)

    def test_anonymous_cannot_open_admin_routes(self):
        for path in self.ADMIN_PATHS:
            self.assertEqual(self.anon.get(f"/api/admin/{path}/").status_code, 401, path)

    def test_admin_can_open_admin_routes(self):
        admin = self.admin_client()
        for path in self.ADMIN_PATHS:
            self.assertEqual(admin.get(f"/api/admin/{path}/").status_code, 200, path)

    def test_stats_reflect_data(self):
        self.register()
        stats = self.admin_client().get("/api/admin/stats/").data
        self.assertEqual(stats["totalStudents"], 1)
        self.assertEqual(stats["activeCourses"], Course.objects.filter(is_active=True).count())

    def test_course_lifecycle_reflects_on_public_site(self):
        admin = self.admin_client()
        res = admin.post("/api/admin/courses/", {
            "title": "Test Course", "categoryId": "jee", "type": "FULL_COURSE", "level": "BEGINNER",
            "price": 9999, "duration": "6 Months"}, format="json")
        self.assertEqual(res.status_code, 201, res.data)
        self.assertTrue(res.data["subjectIds"])                         # defaults to the exam's subjects
        self.assertEqual(self.anon.get(f"/api/courses/{res.data['slug']}/").status_code, 200)
        self.assertEqual(admin.delete(f"/api/admin/courses/{res.data['id']}/").status_code, 204)
        self.assertEqual(self.anon.get(f"/api/courses/{res.data['slug']}/").status_code, 404)

    def test_admin_updates_booking_status_only(self):
        booked = self.anon.post("/api/demo-bookings/", self.booking(), format="json").data
        admin = self.admin_client()
        url = f"/api/admin/demo-bookings/{booked['id']}/"
        self.assertEqual(admin.patch(url, {"status": "CONFIRMED"}, format="json").data["status"], "CONFIRMED")
        self.assertEqual(admin.patch(url, {"status": "DONE"}, format="json").status_code, 400)
        self.assertEqual(admin.patch(url, {"name": "Hacked"}, format="json").data["name"], "Rahul Verma")