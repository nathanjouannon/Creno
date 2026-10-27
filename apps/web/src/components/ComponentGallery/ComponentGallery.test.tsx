import axe from 'axe-core';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ToastProvider } from '@/components/Toast';
import { ComponentGallery } from './ComponentGallery';

async function seriousViolations(container: Element) {
  const { violations } = await axe.run(container, {
    // jsdom has no layout: contrast is checked in the browser by the end-to-end tests
    rules: { 'color-contrast': { enabled: false } },
  });
  return violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
}

function renderGallery() {
  return render(
    <ToastProvider>
      <main>
        <h1>Composants</h1>
        <ComponentGallery />
      </main>
    </ToastProvider>,
  );
}

describe('ComponentGallery (axe)', () => {
  it('ADR-0007: the demonstration page has no serious or critical violation', async () => {
    const { container } = renderGallery();
    expect(await seriousViolations(container)).toEqual([]);
  });

  it('ADR-0007: neither does the page with a form error, a toast and a dialog open', async () => {
    const { container } = renderGallery();
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await screen.findAllByText('Ce champ est obligatoire.');
    await userEvent.click(screen.getByRole('button', { name: 'Toast danger' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmation delete' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(await seriousViolations(document.body)).toEqual([]);
    expect(await seriousViolations(container)).toEqual([]);
  });
});
