from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.core.urlresolvers import reverse_lazy
from django.views.generic import TemplateView
from django.db.models import ObjectDoesNotExist
from extra_views import InlineFormSet, UpdateWithInlinesView
from json import dumps
from rest_framework import renderers, viewsets
from rest_framework.response import Response

from .models import Project, ActivityLog, MiracleUser, Dataset
from .serializers import ProjectSerializer, UserSerializer, DatasetSerializer
from .permissions import CanViewReadOnlyOrEditProject

from rest_framework import generics
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.views import APIView
from rest_framework.exceptions import ValidationError

import logging

logger = logging.getLogger(__name__)


class LoginRequiredMixin(object):
    @classmethod
    def as_view(cls, *args, **kwargs):
        view = super(LoginRequiredMixin, cls).as_view(*args, **kwargs)
        return login_required(view)


class DashboardView(LoginRequiredMixin, TemplateView):
    template_name = 'dashboard.html'

    def get_context_data(self, **kwargs):
        context = super(DashboardView, self).get_context_data(**kwargs)
        project_serializer = ProjectSerializer(Project.objects.viewable(self.request.user), many=True)
        user_serializer = UserSerializer(User.objects.all(), many=True)
        context.update(
            activity_log=ActivityLog.objects.for_user(self.request.user),
            project_list_json=dumps(project_serializer.data),
            users_json=dumps(user_serializer.data),
        )
        return context


class MiracleUserInline(InlineFormSet):
    model = MiracleUser
    can_delete = False

    def get_object(self):
        return MiracleUser.objects.get(user=self.request.user)


class UserProfileView(LoginRequiredMixin, UpdateWithInlinesView):
    template_name = 'account/profile.html'
    model = User
    inlines = [MiracleUserInline]
    fields = ('username', 'first_name', 'last_name', 'email')
    success_url = reverse_lazy('core:profile')

    def get_object(self):
        return self.request.user


class ProjectViewSet(viewsets.ModelViewSet):
    """ Project controller """
    serializer_class = ProjectSerializer
    renderer_classes = (renderers.TemplateHTMLRenderer, renderers.JSONRenderer)
    permission_classes = (CanViewReadOnlyOrEditProject,)

    @property
    def template_filename(self):
        _action = self.action
        if _action == 'retrieve':
            _action = 'detail'
        return '{}.html'.format(_action)

    @property
    def template_name(self):
        return 'project/{}'.format(self.template_filename)

    def get_queryset(self):
        return Project.objects.viewable(self.request.user)

    def perform_create(self, serializer):
        serializer.save(creator=self.request.user)

    def retrieve(self, request, *args, **kwargs):
        response = super(ProjectViewSet, self).retrieve(request, *args, **kwargs)
        user_serializer = UserSerializer(User.objects.all(), many=True)
        project = response.data
        response.data = {
            'project': self.get_object(),
            'project_json': dumps(project),
            'users_json': dumps(user_serializer.data),
        }
        return response

    def perform_update(self, serializer):
        logger.debug("performing update with serializer: %s", serializer)
        user = self.request.user
        project = serializer.save(user=user)
        logger.debug("modified data: %s", serializer.modified_data_text)
        ActivityLog.objects.log_user(user, 'UPDATE {}: {}'.format(
            project,
            serializer.modified_data_text))


    def perform_destroy(self, instance):
        instance.deactivate(self.request.user)

class FileUploadView(APIView):
    parser_classes = (MultiPartParser, FormParser,)
    permission_classes = (CanViewReadOnlyOrEditProject,)

    def post(self, request, format=None):
        file_obj = request.FILES['file']
        project_pk = int(request.DATA[u'id'][0])
        project = get_safe(Project, project_pk)
        user = User.objects.filter(username=request.user)[0]

        dataset = Dataset(name=file_obj.name, creator=user, project=project, datafile=file_obj)
        dataset.save()

        return Response(status=201)

class FileUploadRetrieveDestroyView(generics.RetrieveDestroyAPIView):
    permission_classes = (CanViewReadOnlyOrEditProject,)
    serializer_class = DatasetSerializer


def get_safe(model, pk):
    try:
        return model.objects.get(pk=pk)
    except ObjectDoesNotExist:
        raise ValidationError(detail='%s %s does not exist' % (model.__name__, pk))
