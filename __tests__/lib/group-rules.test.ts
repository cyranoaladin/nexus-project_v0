import { GROUP_RULES } from '@/lib/group-rules';
import { getRules } from '@/lib/pricing';

describe('GROUP_RULES lightweight client constant', () => {
  test('mirrors the canonical pricing rules used in server loaders', () => {
    const rules = getRules();

    expect(GROUP_RULES).toEqual({
      group_max: rules.group_max,
      group_min_open: {
        lycee: rules.group_min_open.lycee,
        college: rules.group_min_open.college,
        brevet: rules.group_min_open.college,
      },
    });
  });
});
