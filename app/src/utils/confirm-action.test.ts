import { Alert, AlertButton, Platform } from 'react-native';

import { confirmAction } from '@/utils/confirm-action';

const options = {
  title: 'Delete Milk?',
  message: 'It cannot be undone.',
  confirmLabel: 'Delete',
  cancelLabel: 'Keep item',
  destructive: true,
};

afterEach(() => {
  jest.restoreAllMocks();
});

describe('confirmAction on a phone', () => {
  it('asks in a dialog and goes ahead only from the confirm button', () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const onConfirm = jest.fn();

    confirmAction({ ...options, onConfirm });

    const [title, message, buttons] = alert.mock.calls[0];
    const [cancel, confirm] = buttons as AlertButton[];

    expect([title, message]).toEqual(['Delete Milk?', 'It cannot be undone.']);
    expect(cancel).toMatchObject({ text: 'Keep item', style: 'cancel' });
    expect(confirm).toMatchObject({ text: 'Delete', style: 'destructive' });
    expect(onConfirm).not.toHaveBeenCalled();

    confirm.onPress?.();

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('uses the plain style for an action that is not destructive', () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    confirmAction({ ...options, destructive: false, onConfirm: jest.fn() });

    expect((alert.mock.calls[0][2] as AlertButton[])[1].style).toBe('default');
  });
});

describe('confirmAction on the web', () => {
  it.each([
    [true, 1],
    [false, 0],
  ])('asks with the browser dialog (answer %s)', (answer, calls) => {
    jest.replaceProperty(Platform, 'OS', 'web');
    const confirm = jest.fn(() => answer);
    window.confirm = confirm;
    const onConfirm = jest.fn();

    confirmAction({ ...options, onConfirm });

    expect(confirm).toHaveBeenCalledWith('Delete Milk?\n\nIt cannot be undone.');
    expect(onConfirm).toHaveBeenCalledTimes(calls);
  });
});
