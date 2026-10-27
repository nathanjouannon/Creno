import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Card } from './Card';

describe('Card', () => {
  it('a clickable card is one link to its page, with a decorative arrow', () => {
    render(<Card href="/events/1">Course de ski</Card>);
    const link = screen.getByRole('link', { name: /Course de ski/ });
    expect(link).toHaveAttribute('href', '/events/1');
    expect(link).toHaveAccessibleName('Course de ski');
  });

  it('variants change the border, the content stays the same', () => {
    render(
      <>
        <Card variant="selected">Inscrit</Card>
        <Card variant="alert">Aucun inscrit</Card>
      </>,
    );
    expect(screen.getByText('Inscrit').className).toContain('border-primary');
    expect(screen.getByText('Aucun inscrit').className).toContain('border-danger');
  });
});
