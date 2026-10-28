import { Alert, Platform } from 'react-native';

type ConfirmActionOptions = {
  title: string;
  message: string;
  /** The button that goes ahead, such as "Delete". */
  confirmLabel: string;
  /** The button that backs out, such as "Keep item". */
  cancelLabel: string;
  /** Shows the go-ahead button in red on iOS, for an action that can't be undone. */
  destructive?: boolean;
  onConfirm: () => void;
};

/**
 * Asks before an action that can't be undone, in the phone's own dialog, so it
 * is always on screen wherever the button was. react-native-web's Alert does
 * nothing, so the web build asks with the browser's dialog instead, which has
 * only OK and Cancel.
 */
export function confirmAction({
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
}: ConfirmActionOptions): void {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    }

    return;
  }

  Alert.alert(title, message, [
    { text: cancelLabel, style: 'cancel' },
    { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
  ]);
}
