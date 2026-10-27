import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MainNav } from './MainNav';

const pathname = vi.hoisted(() => ({ current: '/events' }));
vi.mock('next/navigation', () => ({ usePathname: () => pathname.current }));

describe('MainNav', () => {
  beforeEach(() => {
    pathname.current = '/events';
  });

  it('[F-03] RG-14: a user only gets "Événements", never the administrator tabs', () => {
    render(<MainNav variant="user" />);
    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual(['Événements']);
  });

  it('an administrator gets the administrator tabs', () => {
    render(<MainNav variant="admin" />);
    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Événements',
      'Passés',
      'Membres',
    ]);
  });

  it('marks the current tab, and only the most specific one', () => {
    pathname.current = '/events/past';
    render(<MainNav variant="admin" />);
    expect(screen.getByRole('link', { name: 'Passés' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Événements' })).not.toHaveAttribute('aria-current');
  });

  it('keeps "Événements" active on the page of an event', () => {
    pathname.current = '/events/12';
    render(<MainNav variant="admin" />);
    expect(screen.getByRole('link', { name: 'Événements' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});
