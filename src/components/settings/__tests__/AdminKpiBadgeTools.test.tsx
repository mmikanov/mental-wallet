/**
 * Unit tests for AdminKpiBadgeTools component.
 *
 * Validates: Requirements 8.5, 8.2, 8.4
 */

import React from 'react';
import { Alert } from 'react-native';
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { AdminKpiBadgeTools } from '../AdminKpiBadgeTools';

// Mock the kpi store
const mockCreateFakeRecord = jest.fn();
const mockResetAllRecords = jest.fn();

jest.mock('@/stores/kpiStore', () => ({
  useKpiStore: jest.fn(() => ({
    createFakeRecord: mockCreateFakeRecord,
    resetAllRecords: mockResetAllRecords,
  })),
}));

jest.spyOn(Alert, 'alert');

/** Find a node by testID */
function findByTestId(root: any, testId: string) {
  return root.findAll((node: any) => node.props.testID === testId)[0] ?? null;
}

describe('AdminKpiBadgeTools', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validation errors (Requirement 8.5)', () => {
    it('shows validation error for empty input when create is pressed', () => {
      let tree: ReactTestRenderer;
      act(() => {
        tree = create(<AdminKpiBadgeTools />);
      });
      const root = tree!.root;

      // Press create without entering anything
      act(() => {
        findByTestId(root, 'create-record-button').props.onPress();
      });

      expect(findByTestId(root, 'validation-error')).not.toBeNull();
    });

    it('shows validation error for "0" input', () => {
      let tree: ReactTestRenderer;
      act(() => {
        tree = create(<AdminKpiBadgeTools />);
      });
      const root = tree!.root;

      // Type "0" then press create
      act(() => {
        findByTestId(root, 'days-ago-input').props.onChangeText('0');
      });
      act(() => {
        findByTestId(root, 'create-record-button').props.onPress();
      });

      expect(findByTestId(root, 'validation-error')).not.toBeNull();
    });

    it('shows validation error for decimal input', () => {
      let tree: ReactTestRenderer;
      act(() => {
        tree = create(<AdminKpiBadgeTools />);
      });
      const root = tree!.root;

      act(() => {
        findByTestId(root, 'days-ago-input').props.onChangeText('3.5');
      });
      act(() => {
        findByTestId(root, 'create-record-button').props.onPress();
      });

      expect(findByTestId(root, 'validation-error')).not.toBeNull();
    });
  });

  describe('create fake record (Requirement 8.2)', () => {
    it('calls createFakeRecord with correct daysAgo for valid input', () => {
      let tree: ReactTestRenderer;
      act(() => {
        tree = create(<AdminKpiBadgeTools />);
      });
      const root = tree!.root;

      act(() => {
        findByTestId(root, 'days-ago-input').props.onChangeText('7');
      });
      act(() => {
        findByTestId(root, 'create-record-button').props.onPress();
      });

      expect(mockCreateFakeRecord).toHaveBeenCalledWith(7);
    });

    it('does not call createFakeRecord when input is invalid', () => {
      let tree: ReactTestRenderer;
      act(() => {
        tree = create(<AdminKpiBadgeTools />);
      });
      const root = tree!.root;

      act(() => {
        findByTestId(root, 'days-ago-input').props.onChangeText('0');
      });
      act(() => {
        findByTestId(root, 'create-record-button').props.onPress();
      });

      expect(mockCreateFakeRecord).not.toHaveBeenCalled();
    });
  });

  describe('reset all records (Requirement 8.4)', () => {
    it('shows confirmation alert when reset button is pressed', () => {
      let tree: ReactTestRenderer;
      act(() => {
        tree = create(<AdminKpiBadgeTools />);
      });
      const root = tree!.root;

      act(() => {
        findByTestId(root, 'reset-button').props.onPress();
      });

      expect(Alert.alert).toHaveBeenCalledWith(
        'Reset All KPI Records',
        expect.any(String),
        expect.any(Array)
      );
    });
  });
});
