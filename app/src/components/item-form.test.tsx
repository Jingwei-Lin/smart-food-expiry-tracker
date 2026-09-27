import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { ItemForm } from '@/components/item-form';

type RenderView = Awaited<ReturnType<typeof render>>;

async function fillRequiredFields(view: RenderView) {
  await fireEvent.changeText(view.getByLabelText('Item name'), 'Milk');
  await fireEvent.changeText(
    view.getByLabelText('Expiry date in year month day format'),
    '20260930',
  );
}

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
