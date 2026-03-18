import React from 'react';
import TabNavigation from '../TabNavigation';

const renderer = require('react-test-renderer');
const { act } = renderer;

jest.mock('react-native', () => {
  const React = require('react');

  const createHost = (name: string) => {
    return ({ children, ...props }: any) => React.createElement(name, props, children);
  };

  return {
    View: createHost('View'),
    Text: createHost('Text'),
    TouchableOpacity: createHost('TouchableOpacity'),
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
  };
});

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    SafeAreaView: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
  };
});

jest.mock('../MapScreen', () => {
  const React = require('react');
  const { Text } = require('react-native');

  return function MockMapScreen() {
    return <Text>Explore Screen</Text>;
  };
});

jest.mock('../ProfileScreen', () => {
  const React = require('react');
  const { Text } = require('react-native');

  return function MockProfileScreen() {
    return <Text>Me Screen</Text>;
  };
});

jest.mock('../ProgressScreen', () => {
  const React = require('react');
  const { Text } = require('react-native');

  return function MockProgressScreen() {
    return <Text>Progress Screen</Text>;
  };
});

describe('TabNavigation', () => {
  it('renders Explore, Progress, and Me tabs', () => {
    let tree: any;
    act(() => {
      tree = renderer.create(<TabNavigation />);
    });
    const labels = tree.root.findAllByType('Text').map((node: any) => node.props.children);

    expect(labels).toContain('Explore');
    expect(labels).toContain('Progress');
    expect(labels).toContain('Me');
  });

  it('switches between the three top-level destinations', () => {
    let tree: any;
    act(() => {
      tree = renderer.create(<TabNavigation />);
    });
    const buttons = tree.root.findAllByType('TouchableOpacity');

    expect(tree.root.findAllByType('Text').map((node: any) => node.props.children)).toContain('Explore Screen');

    act(() => {
      buttons[1].props.onPress();
    });
    expect(tree.root.findAllByType('Text').map((node: any) => node.props.children)).toContain('Progress Screen');

    act(() => {
      buttons[2].props.onPress();
    });
    expect(tree.root.findAllByType('Text').map((node: any) => node.props.children)).toContain('Me Screen');
  });
});
