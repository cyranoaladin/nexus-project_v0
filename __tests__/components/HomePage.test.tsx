import { render, screen } from '@testing-library/react';
import HomePage from '@/app/page';

// Mock the components since we are testing the page composition
jest.mock('@/components/layout/CorporateNavbar', () => ({
    CorporateNavbar: () => <div data-testid="navbar">Navbar</div>,
}));
jest.mock('@/components/layout/CorporateFooter', () => ({
    CorporateFooter: () => <div data-testid="footer">Footer</div>,
}));
jest.mock('@/components/sections/hero-section-gsap', () => () => <div data-testid="hero">Hero</div>);
jest.mock('@/components/sections/trinity-services-gsap', () => () => <div data-testid="trinity">Trinity</div>);
jest.mock('@/components/sections/paths-section-gsap', () => () => <div data-testid="paths">Paths</div>);
jest.mock('@/components/sections/approach-section-gsap', () => () => <div data-testid="approach">Approach</div>);
jest.mock('@/components/sections/dna-section-gsap', () => () => <div data-testid="dna">DNA</div>);
jest.mock('@/components/sections/offer-section-gsap', () => () => <div data-testid="offer">Offer</div>);
jest.mock('@/components/sections/testimonials-section-gsap', () => () => <div data-testid="testimonials">Testimonials</div>);
jest.mock('@/components/sections/contact-section-gsap', () => () => <div data-testid="contact">Contact</div>);

describe('HomePage', () => {
    it('renders all sections in correct order', () => {
        render(<HomePage />);

        expect(screen.getByTestId('navbar')).toBeInTheDocument();
        expect(screen.getByTestId('hero')).toBeInTheDocument();
        expect(screen.getByTestId('trinity')).toBeInTheDocument();
        expect(screen.getByTestId('paths')).toBeInTheDocument();
        expect(screen.getByTestId('approach')).toBeInTheDocument();
        expect(screen.getByTestId('dna')).toBeInTheDocument();
        expect(screen.getByTestId('offer')).toBeInTheDocument();
        expect(screen.getByTestId('testimonials')).toBeInTheDocument();
        expect(screen.getByTestId('contact')).toBeInTheDocument();
        expect(screen.getByTestId('footer')).toBeInTheDocument();
    });
});
