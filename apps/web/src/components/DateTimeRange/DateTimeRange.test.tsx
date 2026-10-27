import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Form } from '@/components/Form';
import { DateTimeRange } from './DateTimeRange';

const schema = z
  .object({
    range: z.object({
      startDate: z.string(),
      startTime: z.string(),
      endDate: z.string(),
      endTime: z.string(),
    }),
  })
  .superRefine(({ range }, context) => {
    if (`${range.endDate}T${range.endTime}` <= `${range.startDate}T${range.startTime}`)
      context.addIssue({
        code: 'custom',
        path: ['range', 'endDate'],
        message: 'FIELD_END_NOT_AFTER_START',
      });
  });

describe('DateTimeRange', () => {
  it('RG-06: an end before the start is reported under the end, and both end fields turn red', async () => {
    render(
      <Form
        schema={schema}
        defaultValues={{
          range: {
            startDate: '2027-01-15',
            startTime: '08:00',
            endDate: '2027-01-15',
            endTime: '07:00',
          },
        }}
        submitLabel="Enregistrer"
        onSubmit={async () => ({ ok: true, data: undefined })}
      >
        <DateTimeRange name="range" legend="Dates" />
      </Form>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByText('La fin doit être après le début.')).toBeInTheDocument();
    expect(screen.getByLabelText(/Date de fin/)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(/Heure de fin/)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(/Date de début/)).not.toHaveAttribute('aria-invalid');
  });
});
