from django.contrib import admin
from .models import DemoBooking, Enquiry


@admin.register(DemoBooking)
class DemoBookingAdmin(admin.ModelAdmin):
    list_display = ["name", "phone", "course", "preferred_date", "slot", "status", "source"]
    list_filter = ["status", "source"]


@admin.register(Enquiry)
class EnquiryAdmin(admin.ModelAdmin):
    list_display = ["name", "phone", "email", "status", "created_at"]
    list_filter = ["status"]