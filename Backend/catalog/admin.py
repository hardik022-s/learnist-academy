from django.contrib import admin
from . import models

for model in [models.Category, models.Track, models.Subject, models.Faculty,
              models.Course, models.Batch, models.Result, models.FAQ]:
    admin.site.register(model)