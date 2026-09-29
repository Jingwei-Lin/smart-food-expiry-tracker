import { RecipeIngredient } from '@/utils/recipe-ingredients';
import {
  buildRecipeMessages,
  findExpiredIngredients,
  parseRecipeReply,
  Recipe,
} from '@/utils/recipe-prompt';

const ticked: RecipeIngredient[] = [
  { name: 'Milk', daysLeft: -2 },
  { name: 'Spinach', daysLeft: 0 },
  { name: 'Greek yoghurt', daysLeft: 3 },
];

/** A recipe as the model would send it, valid unless a test overrides a field. */
function modelRecipe(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    title: 'Creamy spinach pasta',
    minutes: 20,
    uses: ['Spinach', 'Greek yoghurt'],
    also_needs: ['Pasta', 'Garlic'],
    steps: ['Boil the pasta.', 'Wilt the spinach and stir in the yoghurt.'],
    ...overrides,
  };
}

function reply(recipes: unknown[]): string {
  return JSON.stringify({ recipes });
}

describe('buildRecipeMessages', () => {
  it('asks for JSON in the system message and shows the shape to reply in', () => {
    const [system] = buildRecipeMessages(ticked);

    expect(system.role).toBe('system');
    expect(system.content).toContain('JSON');
    expect(system.content).toContain('"also_needs"');
  });

  it('lists each ticked food with how long it has, including expired and unknown dates', () => {
    const [, user] = buildRecipeMessages([
      { name: 'Cheddar', daysLeft: -1 },
      { name: 'Milk', daysLeft: -2 },
      { name: 'Spinach', daysLeft: 0 },
      { name: 'Eggs', daysLeft: 1 },
      { name: 'Rice', daysLeft: 6 },
      { name: 'Flour', daysLeft: Number.POSITIVE_INFINITY },
    ]);

    expect(user.role).toBe('user');
    expect(user.content).toContain('- Cheddar (expired 1 day ago)');
    expect(user.content).toContain('- Milk (expired 2 days ago)');
    expect(user.content).toContain('- Spinach (expires today)');
    expect(user.content).toContain('- Eggs (1 day left)');
    expect(user.content).toContain('- Rice (6 days left)');
    expect(user.content).toContain('- Flour (date unknown)');
  });

  it('asks the model not to repeat titles it has already suggested', () => {
    const [, user] = buildRecipeMessages(ticked, ['Spinach omelette', 'Milk rice pudding']);

    expect(user.content).toContain(
      'Do not suggest these again: Spinach omelette; Milk rice pudding.',
    );
  });

  it('leaves the avoid line out when there is nothing to avoid', () => {
    const [, user] = buildRecipeMessages(ticked);

    expect(user.content).not.toContain('Do not suggest');
  });
});

describe('parseRecipeReply', () => {
  it('accepts a valid recipe exactly as the model wrote it', () => {
    const recipes = parseRecipeReply(
      reply([modelRecipe({ title: '  Creamy spinach pasta ', uses: ['spinach'] })]),
      ticked,
    );

    expect(recipes).toEqual<Recipe[]>([
      {
        title: '  Creamy spinach pasta ',
        minutes: 20,
        usesIngredients: ['spinach'],
        extraIngredients: ['Pasta', 'Garlic'],
        steps: ['Boil the pasta.', 'Wilt the spinach and stir in the yoghurt.'],
      },
    ]);
  });

  it.each([
    ['text that is not JSON', 'Here are two recipes you could try…'],
    ['an empty reply', ''],
    ['JSON without a recipes list', JSON.stringify({ ideas: [] })],
    ['an empty recipes list', reply([])],
  ])('returns null for %s', (_, content) => {
    expect(parseRecipeReply(content, ticked)).toBeNull();
  });

  it.each([
    ['has no title', { title: undefined }],
    ['has a blank title', { title: '   ' }],
    ['takes no time', { minutes: 0 }],
    ['has a fractional time', { minutes: 12.5 }],
    ['gives its time as text', { minutes: '20' }],
    ['has no steps', { steps: [] }],
    ['has a blank step', { steps: ['Boil the pasta.', ' '] }],
    ['has no also_needs list', { also_needs: undefined }],
    ['has a non-text extra ingredient', { also_needs: ['Pasta', 2] }],
    ['uses no ticked food', { uses: [] }],
    ['uses a food the student did not tick', { uses: ['Spinach', 'Chicken'] }],
  ])('drops a recipe that %s and keeps the others', (_, overrides) => {
    const recipes = parseRecipeReply(reply([modelRecipe(overrides), modelRecipe()]), ticked);

    expect(recipes).toHaveLength(1);
    expect(recipes?.[0].title).toBe('Creamy spinach pasta');
  });

  it('matches ticked foods regardless of case and surrounding spaces', () => {
    const recipes = parseRecipeReply(
      reply([modelRecipe({ uses: [' MILK', 'greek yoghurt '] })]),
      ticked,
    );

    expect(recipes?.[0].usesIngredients).toEqual([' MILK', 'greek yoghurt ']);
  });

  it('keeps only the first two usable recipes', () => {
    const recipes = parseRecipeReply(
      reply([
        modelRecipe({ title: 'First' }),
        modelRecipe({ title: 'Second' }),
        modelRecipe({ title: 'Third' }),
      ]),
      ticked,
    );

    expect(recipes?.map((recipe) => recipe.title)).toEqual(['First', 'Second']);
  });

  it('returns null when every recipe breaks a rule', () => {
    const content = reply([modelRecipe({ minutes: 0 }), modelRecipe({ uses: ['Chicken'] })]);

    expect(parseRecipeReply(content, ticked)).toBeNull();
  });
});

describe('findExpiredIngredients', () => {
  function recipeUsing(...names: string[]): Recipe {
    return {
      title: 'Test recipe',
      minutes: 10,
      usesIngredients: names,
      extraIngredients: [],
      steps: ['Cook it.'],
    };
  }

  it('names the expired foods a recipe uses, spelled as in the inventory', () => {
    expect(findExpiredIngredients(recipeUsing('milk', 'Spinach'), ticked)).toEqual(['Milk']);
  });

  it('returns nothing for a recipe that only uses food still in date', () => {
    expect(findExpiredIngredients(recipeUsing('Spinach', 'Greek yoghurt'), ticked)).toEqual([]);
  });

  it('ignores expired food the recipe does not use', () => {
    const withExpiredCheese: RecipeIngredient[] = [...ticked, { name: 'Cheddar', daysLeft: -4 }];

    expect(findExpiredIngredients(recipeUsing('Milk'), withExpiredCheese)).toEqual(['Milk']);
  });
});
