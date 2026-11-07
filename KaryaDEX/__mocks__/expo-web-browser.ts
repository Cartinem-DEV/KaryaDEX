// __mocks__/expo-web-browser.ts
export const maybeCompleteAuthSession = jest.fn();
export const openAuthSessionAsync = jest.fn().mockResolvedValue({
  type: 'success',
  url: 'bunkmatkar://auth/callback?code=mock_oauth_code_test',
});
export const dismissAuthSession = jest.fn();
