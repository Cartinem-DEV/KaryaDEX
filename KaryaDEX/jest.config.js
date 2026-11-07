module.exports = {
  // Use ts-jest for TypeScript/JSX, babel-jest for others
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        allowJs: true,
        jsx: 'react-jsx',
        strict: true,
        rootDir: '.',
      },
      diagnostics: false,
      useESM: false,
    }],
    '^.+\\.(js|jsx)$': ['babel-jest', {
      presets: ['@babel/preset-env', '@babel/preset-react'],
      plugins: ['@babel/plugin-transform-runtime'],
    }],
  },
  setupFiles: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^react-native$': '<rootDir>/__mocks__/react-native.ts',
    '^@sentry/react-native$': '<rootDir>/__mocks__/sentry-react-native.ts',
    '^@react-native-async-storage/async-storage$': '<rootDir>/__mocks__/async-storage.ts',
    '^expo-file-system(/legacy)?$': '<rootDir>/__mocks__/expo-file-system.ts',
    '^expo-notifications$': '<rootDir>/__mocks__/expo-notifications.ts',
    '^expo-crypto$': '<rootDir>/__mocks__/expo-crypto.ts',
    '^expo-linking$': '<rootDir>/__mocks__/expo-linking.ts',
    '^expo-local-authentication$': '<rootDir>/__mocks__/expo-local-authentication.ts',
    '^expo-secure-store$': '<rootDir>/__mocks__/expo-secure-store.ts',
    '^expo-web-browser$': '<rootDir>/__mocks__/expo-web-browser.ts',
    '\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/__mocks__/fileMock.ts',
  },
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transformIgnorePatterns: [
    'node_modules/(?!(jest-)?react-native|@react-native|@expo|expo|expo-router|expo-modules-core|@noble/hashes)',
  ],
};