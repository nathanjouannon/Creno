// Rescue procedure (RG-12, #82): an administrator who forgot their password gets no link from the application, so
// someone with access to the server runs this and passes the printed link on (README.md). Same link and same rules.
//   pnpm user:reset-link <e-mail>
import { AppError } from '@creno/validation';
import { z } from 'zod';
import { getRescueLinkCreator } from '@/modules/auth';
import { getPrisma } from '@/modules/shared';

const email = process.argv[2];
const appUrl = z.string().url().safeParse(process.env.APP_URL);

try {
  if (!email) {
    console.error('usage: pnpm user:reset-link <e-mail>');
    process.exitCode = 2;
  } else if (!appUrl.success) {
    console.error('APP_URL is missing or invalid (.env)');
    process.exitCode = 2;
  } else {
    const link = await getRescueLinkCreator(appUrl.data)(email);
    // Printed on the terminal of the person running the command, never written to the application logs
    console.log(
      `Lien de réinitialisation, à usage unique, valable jusqu'au ${link.expiresAt} (UTC) :`,
    );
    console.log(link.url);
  }
} catch (error) {
  if (error instanceof AppError && error.code === 'USER_NOT_FOUND') {
    console.error('Aucun compte pour cette adresse.');
  } else {
    console.error('reset link failed', error instanceof Error ? error.message : error);
  }
  process.exitCode = 1;
} finally {
  await getPrisma().$disconnect();
}
