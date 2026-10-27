import { PrismaClient } from '@prisma/client';
import type { APIRequestContext } from '@playwright/test';

export const database = new PrismaClient({ datasourceUrl: process.env.E2E_DATABASE_URL });

/** Back to a new instance: no club, no user. */
export async function resetInstance() {
  await database.$transaction([database.user.deleteMany(), database.club.deleteMany()]);
}

export const installation = {
  club: { name: 'Ski Club des Arcs', timezone: 'Europe/Paris' },
  admin: {
    firstName: 'Alex',
    lastName: 'Martin',
    email: 'mail.ex@exemple.fr',
    password: '0123456789',
  },
};

/** Installs through the API, as a first visitor would. */
export async function installInstance(request: APIRequestContext, baseURL: string) {
  const response = await request.post('/api/setup', {
    data: installation,
    headers: { origin: baseURL },
  });
  if (response.status() !== 201) throw new Error(`installation failed: ${response.status()}`);
}
