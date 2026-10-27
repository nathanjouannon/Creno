'use client';

import { useId, useRef, useState } from 'react';
import { Button } from '@/components/Button';
import { Modal } from '@/components/ConfirmDialog';

export type LinkDialogVariant = 'invitation' | 'reset';

// design/components.md, "LinkDialog": the title and the validity rule depend on the link (RG-02, RG-12)
const texts: Record<LinkDialogVariant, { title: string; rule: string }> = {
  invitation: {
    title: "Lien d'invitation",
    rule: "Valable jusqu'au début de l'événement, réutilisable.",
  },
  reset: {
    title: 'Lien de réinitialisation',
    rule: 'À usage unique, valable 3 jours.',
  },
};

interface Props {
  variant: LinkDialogVariant;
  link: string;
  /** End of validity, already formatted in the club time zone (RG-16). */
  validUntil: string;
  onClose: () => void;
}

/** Modal window showing a link to copy. States: ready, copied, error (copy refused: the link is selected). */
export function LinkDialog({ variant, link, validUntil, onClose }: Props) {
  const [state, setState] = useState<'ready' | 'copied' | 'error'>('ready');
  const field = useRef<HTMLInputElement>(null);
  const fieldId = useId();
  const errorId = useId();
  const { title, rule } = texts[variant];

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setState('copied');
    } catch {
      // Clipboard refused (insecure page, permission): leave the link selected for a manual copy
      setState('error');
      field.current?.select();
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <p className="text-text">
        {rule} Valable jusqu&apos;au {validUntil}.
      </p>
      <div className="flex flex-col gap-xs">
        <label htmlFor={fieldId} className="text-small text-text-muted">
          Lien
        </label>
        <input
          ref={field}
          id={fieldId}
          readOnly
          value={link}
          onFocus={(event) => event.currentTarget.select()}
          aria-describedby={state === 'error' ? errorId : undefined}
          className="h-control w-full rounded-button border border-border-strong bg-background px-sm text-base text-text"
        />
        {state === 'error' ? (
          <p id={errorId} role="alert" className="text-small text-danger">
            Copie impossible : sélectionne le lien et copie-le à la main.
          </p>
        ) : null}
      </div>
      <div className="flex justify-between gap-sm">
        <Button variant="secondary" size="inline" onClick={onClose}>
          Fermer
        </Button>
        <Button variant="primary" size="inline" onClick={copy}>
          {state === 'copied' ? 'Lien copié' : 'Copier le lien'}
        </Button>
      </div>
      <p role="status" className="sr-only">
        {state === 'copied' ? 'Lien copié dans le presse-papiers.' : ''}
      </p>
    </Modal>
  );
}
