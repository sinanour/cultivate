import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AboutPage from '../AboutPage';

describe('AboutPage', () => {
  it('should render the Cultivate app icon', () => {
    render(<AboutPage />);
    const icon = screen.getByAltText('Cultivate App Icon');
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveAttribute('src', '/icon-no-bg.svg');
  });

  it('should display the Universal House of Justice excerpt', () => {
    render(<AboutPage />);
    const excerpt = screen.getByText(/The Formative Age is that critical period/i);
    expect(excerpt).toBeInTheDocument();
  });

  it('should display attribution to the Universal House of Justice', () => {
    render(<AboutPage />);
    const attribution = screen.getByText(/— The Universal House of Justice/i);
    expect(attribution).toBeInTheDocument();
  });

  it('should display the disclaimer about individual initiative', () => {
    render(<AboutPage />);
    const disclaimer = screen.getByText(/This software is an individual initiative/i);
    expect(disclaimer).toBeInTheDocument();
    expect(disclaimer).toHaveTextContent(/has not been officially sponsored by any Bahá'í Institution/i);
  });

  it('should provide a link to the official Bahá\'í website', () => {
    render(<AboutPage />);
    const link = screen.getByRole('link', { name: /www\.bahai\.org/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://www.bahai.org');
  });

  it('should display the About Cultivate header', () => {
    render(<AboutPage />);
    const header = screen.getByText('About Cultivate');
    expect(header).toBeInTheDocument();
  });

  it('should display the logo description', () => {
    render(<AboutPage />);
    const description = screen.getByText(/The Cultivate logo incorporates themes of concentric circles/i);
    expect(description).toBeInTheDocument();
    expect(description).toHaveTextContent(/representation of a person raising their arms in supplication of the Blessed Beauty/i);
  });
});
