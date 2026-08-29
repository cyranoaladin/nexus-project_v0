import { fireEvent, render, waitFor } from '@testing-library/react';

import MathInput from '@/components/programme/shared/MathInput';

jest.mock('mathlive', () => ({}), { virtual: true });

describe('MathInput web component adapter', () => {
  it('loads MathLive and preserves input and submit callbacks', async () => {
    const onChange = jest.fn();
    const onSubmit = jest.fn();
    const { container } = render(
      <MathInput initialValue="x" onChange={onChange} onSubmit={onSubmit} />,
    );

    const mathField = await waitFor(() => {
      const element = container.querySelector('math-field');
      expect(element).not.toBeNull();
      return element as HTMLElement & { value: string };
    });

    mathField.value = 'x^2';
    fireEvent.input(mathField);
    fireEvent.keyDown(mathField, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith('x^2');
    expect(onSubmit).toHaveBeenCalledWith('x^2');
  });
});
