import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';

import { getProjectById } from '@/data/projectStorage';

type ProjectReminderNotificationData = {
  type?: string;
  projectId?: string;
  route?: string;
};

async function handleNotificationResponse(
  response: Notifications.NotificationResponse | null | undefined
): Promise<void> {
  if (!response) {
    return;
  }

  const data = response.notification.request.content
    .data as ProjectReminderNotificationData;

  if (data?.type !== 'project_reminder') {
    return;
  }

  const projectId = data.projectId;
  if (!projectId) {
    router.replace('/');
    return;
  }

  const project = await getProjectById(projectId);
  if (!project) {
    router.replace('/');
    return;
  }

  const route = data.route ?? `/projects/${projectId}/capture`;
  router.push(route as `/projects/${string}/capture`);
}

export function useNotificationRouting(): void {
  useEffect(() => {
    void handleNotificationResponse(Notifications.getLastNotificationResponse());

    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        void handleNotificationResponse(response);
      }
    );

    return () => {
      subscription.remove();
    };
  }, []);
}
