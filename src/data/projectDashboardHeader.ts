import { makeMutable } from 'react-native-reanimated';

/** 0 = large in-page title visible, 1 = scrolled away (show header title). */
export const projectDashboardTitleOpacity = makeMutable(0);

export function resetProjectDashboardTitleOpacity() {
  projectDashboardTitleOpacity.value = 0;
}
