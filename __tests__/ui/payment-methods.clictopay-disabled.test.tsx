import { render, screen } from '@testing-library/react';
import { PaymentMethodsNote } from '@/components/marketing/PaymentMethodsNote';

describe('PaymentMethodsNote ClicToPay disabled decision', () => {
  const originalFlag = process.env.NEXT_PUBLIC_ENABLE_CLICTOPAY_PUBLIC;

  afterEach(() => {
    if (originalFlag === undefined) {
      delete process.env.NEXT_PUBLIC_ENABLE_CLICTOPAY_PUBLIC;
    } else {
      process.env.NEXT_PUBLIC_ENABLE_CLICTOPAY_PUBLIC = originalFlag;
    }
  });

  it('does not present card payment as active without explicit public opt-in', () => {
    delete process.env.NEXT_PUBLIC_ENABLE_CLICTOPAY_PUBLIC;

    render(<PaymentMethodsNote />);

    expect(screen.getByText(/Paiement confirmé après validation pédagogique/i)).toBeInTheDocument();
    expect(screen.queryByText(/Paiement par carte via/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ClicToPay/i)).not.toBeInTheDocument();
  });
});
