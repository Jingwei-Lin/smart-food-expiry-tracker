import { FoodItem } from '@/types/food-item';
import { buildInventorySections } from '@/utils/inventory-sections';

const today = new Date(2026, 8, 17);

function buildItem(id: string, expiryDate: string): FoodItem {
  return {
    id,
    name: id,
    quantity: '1 item',
    expiryDate,
    reminderDaysBefore: 1,
    reminderRuleVersion: 2,
    notes: '',
    createdAt: '2026-09-10T00:00:00.000Z',
    status: 'active',
  };
}

describe('buildInventorySections', () => {
  it('groups items by how long they have left', () => {
    const sections = buildInventorySections(
      [
        buildItem('overdue', '2026-09-15'),
        buildItem('today', '2026-09-17'),
        buildItem('in-three-days', '2026-09-20'),
        buildItem('in-a-week', '2026-09-24'),
        buildItem('next-month', '2026-10-17'),
      ],
      today,
    );

    expect(
      sections.map((section) => [section.title, section.items.map((item) => item.id)]),
    ).toEqual([
      ['Expired', ['overdue']],
      ['Eat soon', ['today', 'in-three-days']],
      ['This week', ['in-a-week']],
      ['Later', ['next-month']],
    ]);
  });

  it('leaves out sections that have nothing in them', () => {
    const sections = buildInventorySections([buildItem('today', '2026-09-17')], today);

    expect(sections.map((section) => section.title)).toEqual(['Eat soon']);
  });

  it('marks only the expired section as urgent', () => {
    const sections = buildInventorySections(
      [buildItem('overdue', '2026-09-15'), buildItem('today', '2026-09-17')],
      today,
    );

    expect(sections.map((section) => section.isUrgent)).toEqual([true, false]);
  });

  it('keeps an item with an unreadable date visible under Later', () => {
    const sections = buildInventorySections([buildItem('mystery', 'whenever')], today);

    expect(sections).toEqual([
      expect.objectContaining({
        title: 'Later',
        items: [expect.objectContaining({ id: 'mystery' })],
      }),
    ]);
  });

  it('returns nothing for an empty inventory', () => {
    expect(buildInventorySections([], today)).toEqual([]);
  });
});
