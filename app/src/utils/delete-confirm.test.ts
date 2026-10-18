import { describeDeletion } from '@/utils/delete-confirm';

describe('describeDeletion', () => {
  it('names the item, and leaves the summary out for food still in the inventory', () => {
    expect(describeDeletion({ name: 'Milk', status: 'active' })).toEqual({
      title: 'Delete Milk?',
      message: 'This removes the item from your inventory. It cannot be undone.',
    });
  });

  it('warns that a resolved item leaves the waste summary too', () => {
    for (const status of ['eaten', 'discarded', 'donated'] as const) {
      expect(describeDeletion({ name: 'Milk', status }).message).toBe(
        'This removes the item from your inventory and from the waste summary. It cannot be undone.',
      );
    }
  });
});
