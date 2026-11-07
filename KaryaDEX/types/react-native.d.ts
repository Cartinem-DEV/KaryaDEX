/**
 * Type declarations patching React Native 0.86 with React 19 JSX element compatibility.
 *
 * In React Native 0.86, View and Text are defined as an intersection:
 * `Constructor<HostInstance> & typeof Component`
 * Under React 19's stricter JSX element checking, the `Constructor<HostInstance>` signature
 * is evaluated first, which lacks the `props` property required by `JSX.ElementAttributesProperty`,
 * causing TS2607 ("JSX element class does not support attributes because it does not have a 'props' property")
 * and TS2786 ("cannot be used as a JSX component").
 *
 * This declaration safely augments the components to `React.ComponentType` for JSX compatibility
 * while preserving all component props, children, and style typings.
 */

import * as React from 'react';
import type {
  ViewProps,
  TextProps,
  ScrollViewProps,
  TextInputProps,
  TouchableOpacityProps,
} from 'react-native';

declare module 'react-native' {
  export const View: React.ComponentType<ViewProps>;
  export const Text: React.ComponentType<TextProps>;
  export const ScrollView: React.ComponentType<ScrollViewProps>;
  export const TextInput: React.ComponentType<TextInputProps>;
  export const TouchableOpacity: React.ComponentType<TouchableOpacityProps>;
}
