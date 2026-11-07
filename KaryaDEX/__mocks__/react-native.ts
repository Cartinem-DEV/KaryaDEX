// __mocks__/react-native.ts
/**
 * Mock react-native module for headless Jest testing.
 */

export const Platform = {
  OS: 'web',
  select: (obj: Record<string, any>) => obj.web ?? obj.default ?? Object.values(obj)[0],
};

export const Alert = {
  alert: jest.fn(),
};

export const AppState = {
  currentState: 'active',
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
};

export const StyleSheet = {
  create: (styles: any) => styles,
  flatten: (styles: any) => (Array.isArray(styles) ? Object.assign({}, ...styles) : styles),
  absoluteFill: {},
  absoluteFillObject: {},
  hairlineWidth: 1,
};

export const Dimensions = {
  get: jest.fn(() => ({ width: 390, height: 844, scale: 3, fontScale: 1 })),
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
};

export const useWindowDimensions = jest.fn(() => ({ width: 390, height: 844, scale: 3, fontScale: 1 }));

export const Touchable = {
  Mixin: {},
};

export const NativeModules = {};

import React from 'react';

export const View = 'View';
export const Text = 'Text';
export const Pressable = 'Pressable';
export const Image = 'Image';
export const ScrollView = 'ScrollView';
export const SafeAreaView = 'SafeAreaView';
export const Modal = 'Modal';
export const TextInput = 'TextInput';
export const FlatList = ({ data, renderItem, ListEmptyComponent, ListHeaderComponent, ListFooterComponent, keyExtractor, ...rest }: any) => {
  const renderPart = (Part: any) => {
    if (!Part) return null;
    return typeof Part === 'function' ? React.createElement(Part) : Part;
  };
  const items = Array.isArray(data) && data.length > 0 && typeof renderItem === 'function'
    ? data.map((item: any, index: number) => {
        const key = typeof keyExtractor === 'function' ? keyExtractor(item, index) : item?.id ?? String(index);
        return React.createElement(React.Fragment, { key }, renderItem({ item, index, separators: {} }));
      })
    : renderPart(ListEmptyComponent);

  return React.createElement(
    'FlatList',
    rest,
    renderPart(ListHeaderComponent),
    items,
    renderPart(ListFooterComponent)
  );
};
export const Switch = 'Switch';
export const ActivityIndicator = 'ActivityIndicator';
export const TouchableOpacity = 'TouchableOpacity';
export const TouchableHighlight = 'TouchableHighlight';
export const StatusBar = 'StatusBar';

export const Animated = {
  View: 'Animated.View',
  Text: 'Animated.Text',
  Image: 'Animated.Image',
  ScrollView: 'Animated.ScrollView',
  createAnimatedComponent: (comp: any) => comp,
  Value: jest.fn(() => ({
    setValue: jest.fn(),
    interpolate: jest.fn(() => 0),
    addListener: jest.fn(),
    removeListener: jest.fn(),
  })),
  timing: jest.fn(() => ({ start: jest.fn((cb?: any) => cb && cb({ finished: true })) })),
  spring: jest.fn(() => ({ start: jest.fn((cb?: any) => cb && cb({ finished: true })) })),
  parallel: jest.fn(() => ({ start: jest.fn((cb?: any) => cb && cb({ finished: true })) })),
  sequence: jest.fn(() => ({ start: jest.fn((cb?: any) => cb && cb({ finished: true })) })),
};

export default {
  Platform,
  Alert,
  AppState,
  StyleSheet,
  Dimensions,
  useWindowDimensions,
  Touchable,
  NativeModules,
  View,
  Text,
  Pressable,
  Image,
  ScrollView,
  SafeAreaView,
  Modal,
  TextInput,
  FlatList,
  Switch,
  ActivityIndicator,
  TouchableOpacity,
  TouchableHighlight,
  StatusBar,
  Animated,
};
