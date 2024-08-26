import string
import secrets

from django import http, forms, urls
from django.contrib import admin, messages
import django.contrib.auth.admin as auth_admin
import django.contrib.auth.models as auth_models
from django.shortcuts import get_object_or_404, render

from .models import User, Project, Member
import codemapper

class MyAdminSite(admin.AdminSite):

    site_header = "CodeMapper administration"
    site_title = "CodeMapper administration"
    index_title = "Welcome to the CodeMapper administration"

    def generate_password(self):
        # The XKCD style
        with open('/usr/share/dict/words', encoding='utf-8') as f:
            words = [word.strip() for word in f if word.strip().isalpha()]
        return ' '.join(secrets.choice(words) for i in range(4))

    def reset_password(self, request, user_id):
        if request.method == 'POST':
            user = get_object_or_404(User, pk=user_id)
            password = self.generate_password()
            user.password = codemapper.sha256(password)
            user.save()
            messages.add_message(request, messages.INFO, "Password of user {} was changed to: {}".format(user.username, password))
            return http.HttpResponseRedirect(urls.reverse("admin:{}_{}_change".format(user._meta.app_label, user._meta.model_name), args=(user_id,)))

    def help_view(self, request):
        context = {'site_header': self.site_header}
        return render(request, 'admin/help.html', context)

    def get_urls(self):
        res = super(MyAdminSite, self).get_urls()
        res += [
            urls.path(r'reset_password/<user_id>', self.admin_view(self.reset_password), name='reset_password'),
            urls.path(r'help', self.help_view, name='help'),
        ]
        return res


admin_site = MyAdminSite()
admin_site.register(auth_models.User, auth_admin.UserAdmin)


class MemberInline(admin.TabularInline):

    model = Member
    extra = 3


class MemberAdmin(admin.ModelAdmin):

    def get_readonly_fields(self, request, obj=None):
        if obj:
            return ["user", "project"]
        else:
            return []

    def has_add_permission(self, request):
        return True

    def has_change_permission(self, request, obj=None):
        return True

    def has_module_permission(self, request):
        return True


@admin.register(Project, site=admin_site)
class ProjectAdmin(admin.ModelAdmin):

    inlines = (MemberInline, )
    search_fields = ['name']

    def get_readonly_fields(self, request, obj=None):
        if obj:
            return ["name"]
        else:
            return []

    def has_add_permission(self, request):
        return True

    def has_change_permission(self, request, obj=None):
        return True

    def has_module_permission(self, request):
        return True

class UserForm(forms.ModelForm):

    def clean_password(self):
        value = self.cleaned_data['password']
        print('Password:', value)
        return codemapper.sha256(value)


@admin.register(User, site=admin_site)
class UserAdmin(admin.ModelAdmin):

    form = UserForm
    inlines = (MemberInline,)
    change_form_template = 'admin/change_user.html'
    search_fields = ['username', 'email']

    def get_readonly_fields(self, request, obj=None):
        if obj:
            return ["username"]
        else:
            return []

    def get_exclude(self, request, obj=None):
        if obj:
            return ["password"]
        else:
            return []

    def has_add_permission(self, request):
        return True

    def has_change_permission(self, request, obj=None):
        return True

    def has_module_permission(self, request):
        return True
