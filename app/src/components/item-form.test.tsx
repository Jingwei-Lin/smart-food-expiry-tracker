import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { ItemForm, ItemFormValues } from '@/components/item-form';

type CalendarProps = {
  value: Date;
  onValueChange: (event: unknown, date: Date) => void;
  onDismiss?: () => void;
  onChange?: unknown;
};

/* The Android dialog's options, and the props of the calendar iOS shows in the form. */
const mockOpen = jest.fn<void, [CalendarProps & { mode: string }]>();
const mockCalendar: { props: CalendarProps | null } = { props: null };

jest.mock('@react-native-community/datetimepicker', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');

  return {
    __esModule: true,
    DateTimePickerAndroid: {
      open: (options: CalendarProps & { mode: string }) => mockOpen(options),
    },
    default: (props: CalendarProps) => {
      mockCalendar.props = props;

      return createElement(View, { testID: 'inline-calendar' });
    },
  };
});

type RenderView = Awaited<ReturnType<typeof render>>;

const picked = { nativeEvent: { timestamp: 0, utcOffset: 0 } };

/* Picks a day from the calendar iOS shows under the field. */
async function pickOnIos(view: RenderView, date: Date) {
  await fireEvent.press(view.getByLabelText(/^Expiry date,/));
  await act(async () => {
    mockCalendar.props?.onValueChange(picked, date);
  });
}

async function fillRequiredFields(view: RenderView) {
  await fireEvent.changeText(view.getByLabelText('Item name'), 'Milk');
  await pickOnIos(view, new Date(2026, 8, 30));
}

beforeEach(() => {
  mockOpen.mockReset();
  mockCalendar.props = null;
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('ItemForm expiry date', () => {
  it('opens a calendar on today under the field on iOS, and shows the day picked', async () => {
    const view = await render(<ItemForm submitLabel="Save item" onSubmit={jest.fn()} />);

    expect(view.getByText('Choose a date')).toBeTruthy();

    await fireEvent.press(view.getByLabelText('Expiry date, not chosen'));

    expect(view.getByTestId('inline-calendar')).toBeTruthy();
    expect(mockCalendar.props?.value.toDateString()).toBe(new Date().toDateString());
    expect(mockCalendar.props?.onChange).toBeUndefined();

    await act(async () => {
      mockCalendar.props?.onValueChange(picked, new Date(2026, 8, 30, 15, 0));
    });

    expect(view.getByLabelText(/^Expiry date, Wed,? 30 Sept? 2026$/)).toBeTruthy();

    await fireEvent.press(view.getByText('Done'));

    expect(view.queryByTestId('inline-calendar')).toBeNull();
  });

  it('submits the picked day as YYYY-MM-DD', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const view = await render(<ItemForm submitLabel="Save item" onSubmit={onSubmit} />);

    await fillRequiredFields(view);
    await fireEvent.press(view.getByText('Save item'));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ expiryDate: '2026-09-30' })),
    );
  });

  describe('on Android', () => {
    const milk: ItemFormValues = {
      name: 'Milk',
      quantity: '2 L',
      expiryDate: '2026-10-05',
      reminderDaysBefore: 1,
      notes: '',
    };

    beforeEach(() => {
      jest.replaceProperty(Platform, 'OS', 'android');
    });

    it('opens the system calendar on the date being edited, and uses the day picked', async () => {
      const view = await render(
        <ItemForm initialValues={milk} submitLabel="Save changes" onSubmit={jest.fn()} />,
      );

      await fireEvent.press(view.getByLabelText(/^Expiry date, Mon,? 5 Oct 2026$/));

      const [options] = mockOpen.mock.calls[0];

      expect(options.mode).toBe('date');
      expect(options.value).toEqual(new Date(2026, 9, 5));
      expect(view.queryByTestId('inline-calendar')).toBeNull();

      await act(async () => {
        options.onValueChange(picked, new Date(2026, 9, 8));
      });

      expect(view.getByLabelText(/^Expiry date, Thu,? 8 Oct 2026$/)).toBeTruthy();
    });

    it('keeps the date when the calendar is closed without picking', async () => {
      const view = await render(
        <ItemForm initialValues={milk} submitLabel="Save changes" onSubmit={jest.fn()} />,
      );

      await fireEvent.press(view.getByLabelText(/^Expiry date,/));

      const [options] = mockOpen.mock.calls[0];

      // The deprecated onChange would also be called on a dismissal, and warns.
      expect(options.onChange).toBeUndefined();
      await act(async () => {
        options.onDismiss?.();
      });

      expect(view.getByLabelText(/^Expiry date, Mon,? 5 Oct 2026$/)).toBeTruthy();
    });
  });

  it('asks for a date when none has been chosen', async () => {
    const onSubmit = jest.fn();
    const view = await render(<ItemForm submitLabel="Save item" onSubmit={onSubmit} />);

    await fireEvent.changeText(view.getByLabelText('Item name'), 'Milk');
    await fireEvent.press(view.getByText('Save item'));

    expect(await view.findByText('Choose an expiry date.')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('ItemForm reminder choice', () => {
  it('defaults to one day before expiry', async () => {
    const view = await render(<ItemForm submitLabel="Save item" onSubmit={jest.fn()} />);

    expect(view.getByLabelText('Number of days before expiry to send a reminder').props.value).toBe(
      '1',
    );
  });

  it('rejects a reminder outside the one-to-seven day range', async () => {
    const onSubmit = jest.fn();
    const view = await render(<ItemForm submitLabel="Save item" onSubmit={onSubmit} />);

    await fillRequiredFields(view);
    await fireEvent.changeText(
      view.getByLabelText('Number of days before expiry to send a reminder'),
      '8',
    );
    await fireEvent.press(view.getByText('Save item'));

    expect(await view.findByText('Choose a whole number from 1 to 7.')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits a valid custom reminder as a number', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const view = await render(<ItemForm submitLabel="Save item" onSubmit={onSubmit} />);

    await fillRequiredFields(view);
    await fireEvent.changeText(
      view.getByLabelText('Number of days before expiry to send a reminder'),
      '5',
    );
    await fireEvent.press(view.getByText('Save item'));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          reminderDaysBefore: 5,
        }),
      ),
    );
  });
});
