import { createDb, migrate } from '../db/db';
import type { Item, NeedLevel, OrganizerType, Province } from '../domain';

/** Datos 100 % ficticios para desarrollo (correos .test, lugares inventados). Nunca en producción. */
async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('seed no se ejecuta en producción');
  const db = createDb(process.env.DATABASE_URL!, 2);
  try {
    await migrate(db, console.log);
    if (await db.selectFrom('centers').select('id').limit(1).executeTakeFirst())
      return console.log('Ya hay datos de demostración.');
    const user = async (email: string, extra: Record<string, unknown> = {}) =>
      (
        await db
          .insertInto('users')
          .values({ email, verifiedAt: new Date(), ...extra })
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id;
    const ana = await user('ana@demo.test');
    const beto = await user('beto@demo.test');
    await user('mod@demo.test', { isModerator: true });
    await user('admin@demo.test', { isAdmin: true, isModerator: true });
    const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000);
    const centers: {
      name: string;
      org: OrganizerType;
      orgName: string;
      p: Province;
      d: string;
      c: string;
      addr: string;
      lat: number;
      lng: number;
      hours: string;
      by: string;
      confirmed: number;
      needs: [Item, NeedLevel][];
    }[] = [
      {
        name: 'Centro de acopio Parroquia (demo)',
        org: 'IGLESIA',
        orgName: 'Parroquia de ejemplo',
        p: 'LOS_SANTOS',
        d: 'Tonosí',
        c: 'Tonosí cabecera',
        addr: 'Frente al parque central (demo)',
        lat: 7.405,
        lng: -80.443,
        hours: 'Todos los días, 7:00 a. m. – 6:00 p. m.',
        by: ana,
        confirmed: 2,
        needs: [
          ['WATER', 'URGENT'],
          ['FOOD', 'URGENT'],
          ['BABY', 'NEEDED'],
          ['CLOTHES', 'ENOUGH'],
        ],
      },
      {
        name: 'Gimnasio municipal (demo)',
        org: 'MUNICIPIO',
        orgName: 'Municipio de ejemplo',
        p: 'LOS_SANTOS',
        d: 'Las Tablas',
        c: 'Las Tablas',
        addr: 'Gimnasio municipal, entrada principal (demo)',
        lat: 7.764,
        lng: -80.274,
        hours: 'Lunes a sábado, 8:00 a. m. – 5:00 p. m.',
        by: beto,
        confirmed: 30,
        needs: [
          ['TARPS', 'URGENT'],
          ['HYGIENE', 'NEEDED'],
          ['TOOLS', 'NEEDED'],
        ],
      },
      {
        name: 'Escuela de ejemplo (demo)',
        org: 'ESCUELA',
        orgName: 'Asociación de padres',
        p: 'HERRERA',
        d: 'Chitré',
        c: 'Chitré',
        addr: 'Escuela de ejemplo, portón lateral (demo)',
        lat: 7.961,
        lng: -80.429,
        hours: 'Hasta agotar espacio',
        by: ana,
        confirmed: 80,
        needs: [
          ['WATER', 'NEEDED'],
          ['FIRST_AID', 'NEEDED'],
        ],
      },
      {
        name: 'Junta comunal (demo)',
        org: 'JUNTA_COMUNAL',
        orgName: 'Junta comunal de ejemplo',
        p: 'COLON',
        d: 'Colón',
        c: 'Barrio Norte',
        addr: 'Oficinas de la junta comunal (demo)',
        lat: 9.358,
        lng: -79.901,
        hours: '8:00 a. m. – 4:00 p. m.',
        by: beto,
        confirmed: 5,
        needs: [
          ['FOOD', 'URGENT'],
          ['BEDDING', 'URGENT'],
          ['LIGHTS', 'NEEDED'],
        ],
      },
      {
        name: 'Grupo de vecinos (demo)',
        org: 'VECINOS',
        orgName: '',
        p: 'PANAMA',
        d: 'Panamá',
        c: 'Bethania',
        addr: 'Casa comunal (demo)',
        lat: 9.003,
        lng: -79.522,
        hours: 'Sábado y domingo, 9:00 a. m. – 1:00 p. m.',
        by: ana,
        confirmed: 1,
        needs: [
          ['PET_FOOD', 'NEEDED'],
          ['VOLUNTEERS', 'NEEDED'],
        ],
      },
    ];
    for (const [i, c] of centers.entries()) {
      const row = await db
        .insertInto('centers')
        .values({
          slug: `demo-${i + 1}`,
          name: c.name,
          organizerType: c.org,
          organizerName: c.orgName,
          province: c.p,
          district: c.d,
          community: c.c,
          address: c.addr,
          lat: c.lat,
          lng: c.lng,
          hoursNote: c.hours,
          createdBy: c.by,
          publishedAt: new Date(),
          managerConfirmedAt: hoursAgo(c.confirmed),
          centerType: i === 3 ? 'MIXTO' : i === 4 ? 'COMEDOR' : 'ACOPIO',
          schedule: JSON.stringify(
            i === 0
              ? {
                  MON: { allDay: true },
                  TUE: { allDay: true },
                  WED: { allDay: true },
                  THU: { allDay: true },
                  FRI: { allDay: true },
                  SAT: { allDay: true },
                  SUN: { allDay: true },
                }
              : i === 4
                ? {
                    MON: null,
                    TUE: null,
                    WED: null,
                    THU: null,
                    FRI: null,
                    SAT: { open: '09:00', close: '13:00' },
                    SUN: { open: '09:00', close: '13:00' },
                  }
                : {
                    MON: { open: '08:00', close: '17:00' },
                    TUE: { open: '08:00', close: '17:00' },
                    WED: { open: '08:00', close: '17:00' },
                    THU: { open: '08:00', close: '17:00' },
                    FRI: { open: '08:00', close: '17:00' },
                    SAT: { open: '08:00', close: '12:00' },
                    SUN: null,
                  },
          ),
          ...(i < 3
            ? {
                contactName: 'Persona de contacto (demo)',
                contactPhone: '6000-000' + i,
                contactWhatsapp: '+507 6000-000' + i,
                contactConsentAt: new Date(),
              }
            : {}),
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await db.insertInto('centerManagers').values({ centerId: row.id, userId: c.by, createdBy: c.by }).execute();
      for (const [item, level] of c.needs)
        await db.insertInto('centerNeeds').values({ centerId: row.id, item, level }).execute();
    }
    console.log(`Listo. Usuarios (código en /api/dev/outbox):
  ana@demo.test    responsable de 3 centros
  beto@demo.test   responsable de 2 centros
  mod@demo.test    moderador (segundo factor)
  admin@demo.test  administrador (segundo factor)`);
  } finally {
    await db.destroy();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
