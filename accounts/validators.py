import re

from django.core.exceptions import ValidationError
from django.utils.translation import gettext as _


class PasswordComplexityValidator:
    def validate(self, password, user=None):
        if not re.search(r'[A-Z]', password) or not re.search(r'\d', password) or not re.search(r'[^A-Za-z0-9]', password):
            raise ValidationError(
                _('Password must include at least one uppercase letter, one digit, and one special character.'),
                code='password_complexity',
            )

    def get_help_text(self):
        return _('Your password must include at least one uppercase letter, one digit, and one special character.')