from django.conf import settings
from rest_framework import permissions, status
from rest_framework.exceptions import AuthenticationFailed, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from .serializers import UserRegisterSerializer, UserSerializer

REFRESH_COOKIE = 'refresh_token'
COOKIE_KWARGS = dict(
    httponly=True,
    secure=not settings.DEBUG,  # True automatically in production (HTTPS)
    samesite='Lax',
    max_age=int(settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds()),
)


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = UserRegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)  # 400 with field errors
        user = serializer.save()

        refresh = RefreshToken.for_user(user)
        response = Response(
            {'user': UserSerializer(user).data, 'access': str(refresh.access_token)},
            status=status.HTTP_201_CREATED,
        )
        response.set_cookie(REFRESH_COOKIE, str(refresh), **COOKIE_KWARGS)
        return response


class CustomTokenObtainPairView(TokenObtainPairView):
    """Login: access token + user in the body, refresh token only in an httpOnly cookie."""

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)  # bad credentials -> 401
        except TokenError as e:
            raise InvalidToken(e.args[0])

        data = serializer.validated_data
        response = Response({
            'access': data['access'],
            'user': UserSerializer(serializer.user).data,
        })
        response.set_cookie(REFRESH_COOKIE, data['refresh'], **COOKIE_KWARGS)
        return response


class RefreshView(APIView):
    """Reads the refresh token from the cookie, returns a new access token,
    and rotates the cookie (old refresh token is blacklisted)."""
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        raw = request.COOKIES.get(REFRESH_COOKIE)
        if not raw:
            return Response({'detail': 'No refresh token.'}, status=status.HTTP_401_UNAUTHORIZED)

        serializer = TokenRefreshSerializer(data={'refresh': raw})
        try:
            serializer.is_valid(raise_exception=True)
        except (TokenError, InvalidToken, AuthenticationFailed, ValidationError):
            return Response(
                {'detail': 'Invalid or expired refresh token.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        data = serializer.validated_data
        response = Response({'access': data['access']})
        if 'refresh' in data:  # ROTATE_REFRESH_TOKENS is on
            response.set_cookie(REFRESH_COOKIE, data['refresh'], **COOKIE_KWARGS)
        return response


# Alias so any existing urls.py that references the old name keeps working
CustomTokenRefreshView = RefreshView


class LogoutView(APIView):
    """Idempotent: always clears the cookie, even if the access token already expired."""
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        raw = request.COOKIES.get(REFRESH_COOKIE)
        if raw:
            try:
                RefreshToken(raw).blacklist()
            except TokenError:
                pass  # already expired/blacklisted; nothing more to revoke
        response = Response({'message': 'Successfully logged out.'})
        response.delete_cookie(REFRESH_COOKIE, samesite=COOKIE_KWARGS['samesite'])
        return response


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)