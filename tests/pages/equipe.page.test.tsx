import { render, screen } from '@testing-library/react';
import EquipePage from '@/app/equipe/page';

describe('Equipe page', () => {
  it('renders hero heading', () => {
    render(<EquipePage />);

    expect(
      screen.getByRole('heading', { name: /L'élite pédagogique qui transforme l'angoisse en excellence/i })
    ).toBeInTheDocument();
  });
});
