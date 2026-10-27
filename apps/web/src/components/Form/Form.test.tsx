import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { FormField } from '@/components/FormField';
import { PasswordInput, TextInput } from '@/components/Input';
import type { ApiResult } from '@/lib/api-client';
import { Form } from './Form';

const schema = z.object({
  title: z.string().min(1, 'FIELD_REQUIRED'),
  password: z.string(),
});

function renderForm(onSubmit: (values: unknown) => Promise<ApiResult>, extra = {}) {
  render(
    <Form
      schema={schema}
      defaultValues={{ title: '', password: '' }}
      submitLabel="Enregistrer"
      onSubmit={onSubmit}
      {...extra}
    >
      <FormField name="title" label="Titre" required>
        <TextInput />
      </FormField>
      <FormField name="password" label="Mot de passe">
        <PasswordInput />
      </FormField>
    </Form>,
  );
}

const ok: ApiResult = { ok: true, data: undefined };

describe('Form', () => {
  it('shows the catalog message under the field on the first submission, without calling the API', async () => {
    const onSubmit = vi.fn().mockResolvedValue(ok);
    renderForm(onSubmit);
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    const title = await screen.findByLabelText('Titre');
    expect(await screen.findByText('Ce champ est obligatoire.')).toBeInTheDocument();
    expect(title).toHaveAttribute('aria-invalid', 'true');
    expect(title).toHaveFocus();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('links the error to its field for assistive technology', async () => {
    renderForm(vi.fn());
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    const title = await screen.findByLabelText('Titre');
    const message = await screen.findByText('Ce champ est obligatoire.');
    expect(title.getAttribute('aria-describedby')).toContain(message.id);
  });

  it('VALIDATION_ERROR: each field code from the API appears under its field, values are kept', async () => {
    const onSubmit = vi.fn().mockResolvedValue({
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'ignored',
        details: { fields: [{ field: 'title', code: 'FIELD_REQUIRED' }] },
      },
    } satisfies ApiResult);
    renderForm(onSubmit);
    await userEvent.type(screen.getByLabelText('Titre'), 'Course');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByText('Ce champ est obligatoire.')).toBeInTheDocument();
    expect(screen.getByLabelText('Titre')).toHaveValue('Course');
  });

  it('any other API code goes to the general alert, never decided on the message text', async () => {
    const onSubmit = vi.fn().mockResolvedValue({
      ok: false,
      error: { code: 'AUTH_INVALID_CREDENTIALS', message: 'E-mail ou mot de passe incorrect.' },
    } satisfies ApiResult);
    renderForm(onSubmit);
    await userEvent.type(screen.getByLabelText('Titre'), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou mot de passe incorrect.');
  });

  it('errorMap: a code can target a field instead of the general alert', async () => {
    const onSubmit = vi.fn().mockResolvedValue({
      ok: false,
      error: { code: 'EMAIL_TAKEN', message: 'unused' },
    } satisfies ApiResult);
    renderForm(onSubmit, { errorMap: { EMAIL_TAKEN: { field: 'title' } } });
    await userEvent.type(screen.getByLabelText('Titre'), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() =>
      expect(screen.getByLabelText('Titre')).toHaveAttribute('aria-invalid', 'true'),
    );
  });

  it('resetOnError empties the listed fields after a failure', async () => {
    const onSubmit = vi.fn().mockResolvedValue({
      ok: false,
      error: { code: 'AUTH_INVALID_CREDENTIALS', message: 'm' },
    } satisfies ApiResult);
    renderForm(onSubmit, { resetOnError: ['password'] });
    await userEvent.type(screen.getByLabelText('Titre'), 'x');
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'secret');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await screen.findByRole('alert');
    expect(screen.getByLabelText('Mot de passe')).toHaveValue('');
    expect(screen.getByLabelText('Titre')).toHaveValue('x');
  });

  it('submitting: the button is loading and the fields are disabled, so nothing is sent twice', async () => {
    let finish: (result: ApiResult) => void = () => {};
    const onSubmit = vi.fn(() => new Promise<ApiResult>((resolve) => (finish = resolve)));
    renderForm(onSubmit);
    await userEvent.type(screen.getByLabelText('Titre'), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeDisabled());
    expect(screen.getByLabelText('Titre')).toBeDisabled();
    finish(ok);
    await waitFor(() => expect(screen.getByLabelText('Titre')).toBeEnabled());
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
