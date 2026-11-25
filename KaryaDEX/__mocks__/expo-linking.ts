// __mocks__/expo-linking.ts
export const makeRedirectUri = jest.fn().mockReturnValue('karyadex://auth/callback');
export const createURL = jest.fn().mockReturnValue('karyadex://auth/callback');
export const parse = jest.fn((url: string) => ({
  path: 'auth/callback',
  queryParams: { code: 'mock_oauth_code_test' },
}));
export const openURL = jest.fn().mockResolvedValue(true);
export const canOpenURL = jest.fn().mockResolvedValue(true);
export const addEventListener = jest.fn().mockReturnValue({ remove: jest.fn() });
