// Jest setup for KaryaDEX test environment
global.__DEV__ = true;

if (!globalThis.expo) {
  globalThis.expo = {
    EventEmitter: class EventEmitter {
      addListener() { return { remove: () => {} }; }
      removeListener() {}
      removeAllListeners() {}
      emit() {}
    },
    modules: {},
  };
}

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const mockComponent = (props) => React.createElement('Icon', props, props.children);
  return new Proxy({}, {
    get: () => mockComponent,
  });
});

