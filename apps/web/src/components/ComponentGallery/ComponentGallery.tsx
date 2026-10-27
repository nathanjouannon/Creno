'use client';

import { useState, type ReactNode } from 'react';
import { errorCatalog } from '@creno/validation';
import { z } from 'zod';
import { Alert } from '@/components/Alert';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ConfirmDialog, type ConfirmDialogVariant } from '@/components/ConfirmDialog';
import { DateTimeRange } from '@/components/DateTimeRange';
import { EmptyState } from '@/components/EmptyState';
import { Form } from '@/components/Form';
import { FormField } from '@/components/FormField';
import { TextInput } from '@/components/Input';
import { Link } from '@/components/Link';
import { LinkDialog, type LinkDialogVariant } from '@/components/LinkDialog';
import { useToast } from '@/components/Toast';
import type { ApiResult } from '@/lib/api-client';

// Same shape as a business schema: messages are field codes, translated from the catalog (ADR-0009)
const demoSchema = z
  .object({
    title: z.string().min(1, 'FIELD_REQUIRED'),
    range: z.object({
      startDate: z.string().min(1, 'FIELD_REQUIRED'),
      startTime: z.string().min(1, 'FIELD_REQUIRED'),
      endDate: z.string().min(1, 'FIELD_REQUIRED'),
      endTime: z.string().min(1, 'FIELD_REQUIRED'),
    }),
  })
  .superRefine(({ range }, context) => {
    const start = `${range.startDate}T${range.startTime}`;
    const end = `${range.endDate}T${range.endTime}`;
    if (range.startDate && range.startTime && range.endDate && range.endTime && end <= start) {
      context.addIssue({
        code: 'custom',
        path: ['range', 'endDate'],
        message: 'FIELD_END_NOT_AFTER_START',
      });
    }
  });

const demoValues = { title: '', range: { startDate: '', startTime: '', endDate: '', endTime: '' } };

const demoLink = 'https://creno.example.org/invitation/exemple';
const confirmVariants: ConfirmDialogVariant[] = ['unregister', 'delete', 'remove-registration'];
const linkVariants: LinkDialogVariant[] = ['invitation', 'reset'];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-md">
      <h2 className="text-large font-bold text-text">{title}</h2>
      {children}
    </section>
  );
}

/**
 * Every base component with its states (loading, empty, error). Development page only (`/dev/composants`): it is
 * the visual reference and the page checked by axe.
 */
export function ComponentGallery() {
  const { showToast } = useToast();
  const [confirm, setConfirm] = useState<ConfirmDialogVariant | null>(null);
  const [linkDialog, setLinkDialog] = useState<LinkDialogVariant | null>(null);
  const [failConfirm, setFailConfirm] = useState(true);

  async function confirmAction(): Promise<ApiResult> {
    // Alternates an API error and a success, to show both states of the dialog
    const fail = failConfirm;
    setFailConfirm(!fail);
    return fail
      ? {
          ok: false,
          error: { code: 'INTERNAL_ERROR', message: errorCatalog.INTERNAL_ERROR.message },
        }
      : { ok: true, data: undefined };
  }

  return (
    <div className="flex flex-col gap-lg">
      <Section title="Boutons">
        <div className="flex flex-col gap-sm">
          <Button variant="primary">Primaire</Button>
          <Button variant="secondary">Secondaire</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="primary" disabled>
            Complet
          </Button>
          <Button variant="primary" loading>
            Chargement
          </Button>
          <div className="flex gap-sm">
            <Button variant="secondary" size="inline">
              Modifier
            </Button>
            <Button variant="danger" size="inline">
              Supprimer
            </Button>
          </div>
        </div>
      </Section>

      <Section title="Formulaire">
        <Form
          schema={demoSchema}
          defaultValues={demoValues}
          submitLabel="Enregistrer"
          onSubmit={async () => {
            showToast({ tone: 'success', message: 'Enregistré.' });
            return { ok: true, data: undefined };
          }}
        >
          <FormField name="title" label="Titre" required>
            <TextInput />
          </FormField>
          <DateTimeRange name="range" legend="Dates" />
        </Form>
      </Section>

      <Section title="Messages">
        <Alert variant="danger">Message d&apos;erreur en ligne.</Alert>
        <Alert variant="warning">Avertissement à confirmer.</Alert>
        <div className="flex gap-sm">
          <Button
            variant="secondary"
            size="inline"
            onClick={() => showToast({ tone: 'danger', message: 'Une erreur est survenue.' })}
          >
            Toast danger
          </Button>
          <Button
            variant="secondary"
            size="inline"
            onClick={() => showToast({ tone: 'success', message: 'Opération réussie.' })}
          >
            Toast succès
          </Button>
        </div>
      </Section>

      <Section title="Fenêtres">
        <div className="flex flex-wrap gap-sm">
          {confirmVariants.map((variant) => (
            <Button
              key={variant}
              variant="secondary"
              size="inline"
              onClick={() => setConfirm(variant)}
            >
              {`Confirmation ${variant}`}
            </Button>
          ))}
          {linkVariants.map((variant) => (
            <Button
              key={variant}
              variant="secondary"
              size="inline"
              onClick={() => setLinkDialog(variant)}
            >
              {`Lien ${variant}`}
            </Button>
          ))}
        </div>
        {confirm ? (
          <ConfirmDialog
            variant={confirm}
            title="Confirmer cette action ?"
            onConfirm={confirmAction}
            onClose={() => setConfirm(null)}
          >
            Le premier essai échoue pour montrer l&apos;état d&apos;erreur, le second réussit.
          </ConfirmDialog>
        ) : null}
        {linkDialog ? (
          <LinkDialog
            variant={linkDialog}
            link={demoLink}
            validUntil="15 janvier 2027 à 08:00"
            onClose={() => setLinkDialog(null)}
          />
        ) : null}
      </Section>

      <Section title="Cartes">
        <Card>Carte par défaut</Card>
        <Card variant="selected">Carte sélectionnée : inscrit</Card>
        <Card variant="alert">Carte d&apos;alerte : aucun inscrit</Card>
        <Card href="/events">Carte cliquable : Événements</Card>
      </Section>

      <Section title="Liste vide et lien">
        <EmptyState>Aucun événement à venir pour le moment.</EmptyState>
        <Link href="/connexion">Déjà un compte ? Se connecter</Link>
      </Section>
    </div>
  );
}
