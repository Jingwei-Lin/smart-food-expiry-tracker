import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Keyboard, Platform } from 'react-native';

import { ItemForm, ItemFormValues } from '@/components/item-form';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

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
  it('notifies when the selected food category changes', async () => {
    const onCategoryChange = jest.fn();
    const view = await render(
      <ItemForm submitLabel="Save item" onCategoryChange={onCategoryChange} onSubmit={jest.fn()} />,
    );

    await fireEvent.press(view.getByRole('radio', { name: 'Seafood' }));

    expect(onCategoryChange).toHaveBeenCalledWith('Seafood');
  });

  it('selects the category provided by scan data', async () => {
    const baseValues = {
      name: '',
      quantity: '',
      expiryDate: '',
      reminderDaysBefore: 1,
      notes: '',
    };

    const view = await render(
      <ItemForm
        initialValues={{ ...baseValues, category: 'Seafood' }}
        submitLabel="Save item"
        onSubmit={jest.fn()}
      />,
    );

    expect(view.getByRole('radio', { name: 'Seafood' }).props.accessibilityState).toMatchObject({
      checked: true,
    });
  });

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

  it('chooses today when the iOS calendar opens with no date, since its selected day sends no change', async () => {
    jest.useFakeTimers({ now: new Date(2026, 9, 18, 10, 0), advanceTimers: true });

    try {
      const onSubmit = jest.fn().mockResolvedValue(undefined);
      const view = await render(<ItemForm submitLabel="Save item" onSubmit={onSubmit} />);

      await fireEvent.changeText(view.getByLabelText('Item name'), 'Milk');
      await fireEvent.press(view.getByLabelText('Expiry date, not chosen'));

      expect(view.getByLabelText(/^Expiry date, Sun,? 18 Oct 2026$/)).toBeTruthy();

      await fireEvent.press(view.getByText('Done'));
      await fireEvent.press(view.getByText('Save item'));

      await waitFor(() =>
        expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({ expiryDate: '2026-10-18' }),
        ),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('puts the keyboard away when the calendar opens', async () => {
    const dismiss = jest.spyOn(Keyboard, 'dismiss');
    const view = await render(<ItemForm submitLabel="Save item" onSubmit={jest.fn()} />);

    await fireEvent.press(view.getByLabelText('Expiry date, not chosen'));

    expect(dismiss).toHaveBeenCalled();
  });

  it('closes the iOS calendar while saving, so a day tapped then is not shown unsaved', async () => {
    const view = await render(
      <ItemForm submitLabel="Save item" onSubmit={() => new Promise<void>(() => undefined)} />,
    );

    await fillRequiredFields(view);

    expect(view.getByTestId('inline-calendar')).toBeTruthy();

    await fireEvent.press(view.getByText('Save item'));

    expect(await view.findByText('Saving...')).toBeTruthy();
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

  describe('on web, where the date is typed', () => {
    beforeEach(() => {
      jest.replaceProperty(Platform, 'OS', 'web');
    });

    it('submits the typed digits as YYYY-MM-DD', async () => {
      const onSubmit = jest.fn().mockResolvedValue(undefined);
      const view = await render(<ItemForm submitLabel="Save item" onSubmit={onSubmit} />);

      await fireEvent.changeText(view.getByLabelText('Item name'), 'Milk');
      await fireEvent.changeText(
        view.getByLabelText('Expiry date in year month day format'),
        '20260930',
      );
      await fireEvent.press(view.getByText('Save item'));

      await waitFor(() =>
        expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({ expiryDate: '2026-09-30' }),
        ),
      );
    });

    it('rejects a day that does not exist', async () => {
      const onSubmit = jest.fn();
      const view = await render(<ItemForm submitLabel="Save item" onSubmit={onSubmit} />);

      await fireEvent.changeText(view.getByLabelText('Item name'), 'Milk');
      await fireEvent.changeText(
        view.getByLabelText('Expiry date in year month day format'),
        '20260230',
      );
      await fireEvent.press(view.getByText('Save item'));

      expect(await view.findByText('Use a valid date in YYYY-MM-DD format.')).toBeTruthy();
      expect(onSubmit).not.toHaveBeenCalled();
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

describe('ItemForm reminder stepper', () => {
  const decrease = { name: 'Decrease reminder days' };
  const increase = { name: 'Increase reminder days' };

  it('defaults to one day before expiry, which cannot be lowered', async () => {
    const view = await render(<ItemForm submitLabel="Save item" onSubmit={jest.fn()} />);

    expect(view.getByLabelText('Days before expiry')).toHaveTextContent('1');
    expect(view.getByLabelText('Days before expiry').props.accessibilityValue).toEqual({
      now: 1,
      min: 1,
      max: 7,
      text: '1 day',
    });
    expect(view.getByRole('button', { ...decrease, disabled: true })).toBeTruthy();
    expect(view.getByText('You’ll get a reminder 1 day before expiry.')).toBeTruthy();
  });

  it('starts from the reminder an item already has', async () => {
    const view = await render(
      <ItemForm
        initialValues={{
          name: 'Milk',
          quantity: '2 L',
          expiryDate: '2026-10-05',
          reminderDaysBefore: 3,
          notes: '',
        }}
        submitLabel="Save changes"
        onSubmit={jest.fn()}
      />,
    );

    expect(view.getByLabelText('Days before expiry')).toHaveTextContent('3');
    expect(view.getByText('You’ll get a reminder 3 days before expiry.')).toBeTruthy();
  });

  it('steps up and down by one day', async () => {
    const view = await render(<ItemForm submitLabel="Save item" onSubmit={jest.fn()} />);

    await fireEvent.press(view.getByRole('button', increase));
    await fireEvent.press(view.getByRole('button', increase));

    expect(view.getByLabelText('Days before expiry')).toHaveTextContent('3');
    expect(view.getByLabelText('Days before expiry').props.accessibilityValue).toMatchObject({
      now: 3,
      text: '3 days',
    });

    await fireEvent.press(view.getByRole('button', decrease));

    expect(view.getByLabelText('Days before expiry')).toHaveTextContent('2');
  });

  it('stops at seven days', async () => {
    const view = await render(<ItemForm submitLabel="Save item" onSubmit={jest.fn()} />);

    for (let press = 0; press < 10; press += 1) {
      await fireEvent.press(view.getByRole('button', increase));
    }

    expect(view.getByLabelText('Days before expiry')).toHaveTextContent('7');
    expect(view.getByRole('button', { ...increase, disabled: true })).toBeTruthy();
  });

  it('does not go below one day', async () => {
    const view = await render(<ItemForm submitLabel="Save item" onSubmit={jest.fn()} />);

    await fireEvent.press(view.getByRole('button', increase));
    await fireEvent.press(view.getByRole('button', decrease));
    await fireEvent.press(view.getByRole('button', { ...decrease, disabled: true }));

    expect(view.getByLabelText('Days before expiry')).toHaveTextContent('1');
  });

  it('submits the chosen reminder as a number', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const view = await render(<ItemForm submitLabel="Save item" onSubmit={onSubmit} />);

    await fillRequiredFields(view);

    for (let press = 0; press < 4; press += 1) {
      await fireEvent.press(view.getByRole('button', increase));
    }

    await fireEvent.press(view.getByText('Save item'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0].reminderDaysBefore).toBe(5);
  });
});

describe('ItemForm submit button', () => {
  it('can name the place the food is being added to', async () => {
    const view = await render(
      <ItemForm submitLabel={(place) => `Add to ${place}`} onSubmit={jest.fn()} />,
    );

    expect(view.getByText('Add to fridge')).toBeTruthy();

    await fireEvent.press(view.getByRole('radio', { name: 'Freezer' }));

    expect(view.getByText('Add to freezer')).toBeTruthy();
  });
});

describe('ItemForm expiry hint', () => {
  it('names the food type only when a category was chosen', async () => {
    const view = await render(<ItemForm submitLabel="Save item" onSubmit={jest.fn()} />);

    expect(view.getByText('Check the date printed on the package.')).toBeTruthy();

    await fireEvent.press(view.getByRole('radio', { name: 'Dairy' }));

    expect(view.getByText('Check the package for its use-by date. Food type: Dairy.')).toBeTruthy();
    expect(view.queryByText(/Food type: Others/)).toBeNull();
  });
});
