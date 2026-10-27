import { getFoodIcon } from '@/utils/food-icon';

describe('getFoodIcon', () => {
  it('picks an icon from words in the name, whatever the case', () => {
    expect(getFoodIcon('Full cream MILK')).toBe('water-outline');
    expect(getFoodIcon('Baby spinach')).toBe('leaf-outline');
    expect(getFoodIcon('Chicken thighs')).toBe('fast-food-outline');
    expect(getFoodIcon('Free range eggs')).toBe('egg-outline');
  });

  it('falls back to a basket for anything it does not know', () => {
    expect(getFoodIcon('Tofu')).toBe('basket-outline');
  });
});
