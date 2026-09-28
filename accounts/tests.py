from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient


class AccountRegistrationTests(TestCase):
	def setUp(self):
		self.client = APIClient()

	def register(self, email, password='StrongPass1!', name='John Smith'):
		return self.client.post(
			'/api/auth/register/',
			{'email': email, 'name': name, 'password': password},
			format='json',
		)

	def test_registration_accepts_name_without_password_confirmation(self):
		response = self.register('first@example.com')

		self.assertEqual(response.status_code, 201)
		self.assertTrue(
			get_user_model().objects.filter(
				email='first@example.com', name='John Smith'
			).exists()
		)

	def test_registration_rejects_password_without_required_character_types(self):
		for password in ('lowercase1!', 'Uppercase!', 'Uppercase1'):
			with self.subTest(password=password):
				response = self.register('first@example.com', password=password)
				self.assertEqual(response.status_code, 400)
				self.assertIn('password', response.data)

	def test_display_names_are_not_unique(self):
		first_response = self.register('first@example.com')
		second_response = self.register('second@example.com')

		self.assertEqual(first_response.status_code, 201)
		self.assertEqual(second_response.status_code, 201)

	def test_refresh_rotates_http_only_cookie_without_exposing_refresh_token(self):
		registration = self.register('first@example.com')
		original_refresh = registration.cookies['refresh_token'].value

		response = self.client.post('/api/auth/refresh/', {}, format='json')

		self.assertEqual(response.status_code, 200)
		self.assertNotIn('refresh', response.data)
		rotated_cookie = response.cookies['refresh_token']
		self.assertNotEqual(rotated_cookie.value, original_refresh)
		self.assertTrue(rotated_cookie['httponly'])
