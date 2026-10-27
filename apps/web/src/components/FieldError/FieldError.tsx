interface Props {
  id: string;
  children: string;
}

/** Message under a field; the text comes from the error catalog, never from the component. */
export function FieldError({ id, children }: Props) {
  return (
    <p id={id} className="text-small text-danger">
      {children}
    </p>
  );
}
