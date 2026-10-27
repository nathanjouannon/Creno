'use client';

import { useState } from 'react';
import { Button } from '@/components/Button';
import { postJson } from '@/lib/api-client';

/** F-02, scenario 4: ends the session, then back to the sign-in page. */
export function LogoutButton() {
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    await postJson('/api/auth/logout', {});
    // A full load so no page keeps what the signed-in user could see
    window.location.assign('/connexion');
  }

  return (
    <Button variant="secondary" size="inline" loading={loading} onClick={logout}>
      Se déconnecter
    </Button>
  );
}
