import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider, useToast, type ToastTone } from './Toast';

function Trigger({ tone }: { tone: ToastTone }) {
  const { showToast } = useToast();
  return <button onClick={() => showToast({ tone, message: 'Message' })}>Afficher</button>;
}

afterEach(() => vi.useRealTimers());

describe('Toast', () => {
  it('a danger toast is announced as an alert and stays until it is closed', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(
      <ToastProvider>
        <Trigger tone="danger" />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Afficher' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Message');

    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByRole('alert')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Fermer le message' }));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('a success toast is a status message and disappears by itself', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(
      <ToastProvider>
        <Trigger tone="success" />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Afficher' }));
    expect(screen.getByRole('status')).toHaveTextContent('Message');

    act(() => vi.advanceTimersByTime(6000));
    expect(screen.queryByRole('status')).toBeNull();
  });
});
