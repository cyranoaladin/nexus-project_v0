/**
 * Tests for /stages page — now a redirect to /stages/fevrier-2026
 */

jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}));

import { redirect } from 'next/navigation';
import StagesPage from '@/app/stages/page';

const mockRedirect = redirect as jest.MockedFunction<typeof redirect>;

describe('Stages page', () => {
  it('redirects to /stages/fevrier-2026', () => {
    StagesPage();
    expect(mockRedirect).toHaveBeenCalledWith('/stages/fevrier-2026');
  });
});
