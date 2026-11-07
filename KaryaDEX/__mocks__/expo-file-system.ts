// __mocks__/expo-file-system.ts
export const documentDirectory = 'file:///mock/documents/';
export const cacheDirectory = 'file:///mock/cache/';

export const getInfoAsync = async (uri: string) => ({
  exists: true,
  isDirectory: uri.endsWith('/'),
  size: 1024,
  uri,
});

export const makeDirectoryAsync = async () => {};
export const copyAsync = async () => {};
export const writeAsStringAsync = async () => {};
export const readDirectoryAsync = async () => [];
export const deleteAsync = async () => {};

export const StorageAccessFramework = {
  requestDirectoryPermissionsAsync: async () => ({
    granted: true,
    directoryUri: 'content://mock/directory',
  }),
};
