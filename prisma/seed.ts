// Crea (o actualiza) el usuario administrador inicial.
// Se ejecuta con: npm run db:seed
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role } from '@prisma/client';
import * as argon from 'argon2';

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error('Definí SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD en el .env');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    const hash = await argon.hash(password);
    // upsert: si ya existe lo promueve a ADMIN, si no lo crea.
    const admin = await prisma.user.upsert({
      where: { email },
      update: { role: Role.ADMIN },
      create: { email, hash, role: Role.ADMIN, firstName: 'Admin' },
    });
    console.log(`Admin listo: ${admin.email} (id ${admin.id})`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
