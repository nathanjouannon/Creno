import { getClubService } from '@/modules/club';
import { route } from '@/modules/shared';

export const dynamic = 'force-dynamic';

export const GET = route({ auth: 'user' }, async () => ({
  body: await getClubService().getClub(),
}));
