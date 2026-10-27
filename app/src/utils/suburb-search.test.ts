import { findSuburbs } from '@/utils/suburb-search';

const NEWTOWN_NSW = { latitude: -33.8978, longitude: 151.1785 };

describe('findSuburbs', () => {
  it('waits for two letters', () => {
    expect(findSuburbs('', NEWTOWN_NSW)).toEqual([]);
    expect(findSuburbs('m', NEWTOWN_NSW)).toEqual([]);
  });

  it('puts the nearest suburbs first', () => {
    const found = findSuburbs('Mar', NEWTOWN_NSW);

    expect(found.map((suburb) => suburb.name)).toContain('Marrickville');
    expect(found.every((suburb) => suburb.state === 'NSW')).toBe(true);
  });

  it('matches the state after the name', () => {
    const [first, ...rest] = findSuburbs('newtown vic', null);

    expect(first).toMatchObject({ name: 'Newtown', state: 'VIC', postcode: '3220' });
    expect(rest).toEqual([]);
  });

  it('ignores case and extra spaces', () => {
    expect(findSuburbs('  MARRICKVILLE  ', null)[0]?.postcode).toBe('2204');
  });

  it('shows at most five', () => {
    expect(findSuburbs('ma', NEWTOWN_NSW)).toHaveLength(5);
  });
});
