export const getPermissionsAsync = jest.fn().mockResolvedValue({ status: 'granted' });
export const requestPermissionsAsync = jest.fn().mockResolvedValue({ status: 'granted' });
export const setNotificationHandler = jest.fn();
export const setNotificationChannelAsync = jest.fn().mockResolvedValue(null);
export const scheduleNotificationAsync = jest.fn().mockResolvedValue('mock-notification-id');
export const cancelScheduledNotificationAsync = jest.fn().mockResolvedValue(null);
export const getAllScheduledNotificationsAsync = jest.fn().mockResolvedValue([]);
export const cancelAllScheduledNotificationsAsync = jest.fn().mockResolvedValue(null);
export const addNotificationReceivedListener = jest.fn(() => ({ remove: jest.fn() }));
export const addNotificationResponseReceivedListener = jest.fn(() => ({ remove: jest.fn() }));

export const AndroidImportance = {
  MAX: 5,
  HIGH: 4,
  DEFAULT: 3,
  LOW: 2,
  MIN: 1,
  NONE: 0,
};
