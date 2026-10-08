import { PrismaClient, UserRole, HazardType, SeverityLevel, WarningStatus, RescueTeamStatus, ShelterStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  const passwordHash = await bcrypt.hash('Password123!', 12);

  // ── USERS ──────────────────────────────────────────────────────────
  const dmcOfficer = await prisma.user.upsert({
    where: { email: 'national@dmc.lk' },
    update: {},
    create: { name: 'DMC National Command', email: 'national@dmc.lk', phoneNumber: '+94112136136', passwordHash, role: UserRole.DMC_OFFICER, district: null },
  });

  const dutyOfficer = await prisma.user.upsert({
    where: { email: 'officer@dmc.lk' },
    update: {},
    create: { name: 'Capt. K. Perera', email: 'officer@dmc.lk', phoneNumber: '+94112136137', passwordHash, role: UserRole.DMC_DUTY_OFFICER, district: null },
  });

  const districtOfficer = await prisma.user.upsert({
    where: { email: 'coord@dmc.lk' },
    update: {},
    create: { name: 'Lt. Col. S. Jayasinghe', email: 'coord@dmc.lk', phoneNumber: '+94112136138', passwordHash, role: UserRole.DISTRICT_OFFICER, district: 'Colombo' },
  });

  const citizenUser = await prisma.user.upsert({
    where: { email: 'citizen@test.lk' },
    update: {},
    create: { name: 'Asela Gunawardene', email: 'citizen@test.lk', phoneNumber: '+94771234567', passwordHash, role: UserRole.CITIZEN, district: 'Kalutara' },
  });

  const rescueUser = await prisma.user.upsert({
    where: { email: 'teama@rescue.lk' },
    update: {},
    create: { name: 'TEAM-A Leader', email: 'teama@rescue.lk', phoneNumber: '+94771234568', passwordHash, role: UserRole.RESCUE_TEAM, district: 'Colombo' },
  });

  console.log('✅ Users created');

  // ── CITIZEN PROFILE ────────────────────────────────────────────────
  await prisma.citizen.upsert({
    where: { userId: citizenUser.id },
    update: {},
    create: { userId: citizenUser.id, nic: '991234567V', address: '45 Kalutara South', district: 'Kalutara' },
  });
  console.log('✅ Citizen profiles created');

  // ── SHELTERS ───────────────────────────────────────────────────────
  const shelterData = [
    { name: 'Ratnapura Central College', address: 'Ratnapura Town', district: 'Ratnapura', latitude: 6.6828, longitude: 80.3992, capacity: 1200, currentOccupancy: 1050, amenities: ['water', 'electricity', 'medical', 'food'] },
    { name: 'Kalutara Town Hall', address: 'Kalutara Town', district: 'Kalutara', latitude: 6.5854, longitude: 79.9607, capacity: 800, currentOccupancy: 777, amenities: ['water', 'electricity'] },
    { name: 'Galle Bodhi Temple Vihara', address: 'Galle Fort Road', district: 'Galle', latitude: 6.0329, longitude: 80.2168, capacity: 1500, currentOccupancy: 450, amenities: ['water', 'electricity', 'food'] },
    { name: 'Matara Rahula Auditorium', address: 'Matara Central', district: 'Matara', latitude: 5.9485, longitude: 80.5353, capacity: 1000, currentOccupancy: 0, status: ShelterStatus.CLOSED, amenities: ['water', 'electricity'] },
    { name: 'Rathmalana Maha Vidyalaya', address: 'Rathmalana, Colombo', district: 'Colombo', latitude: 6.8211, longitude: 79.8663, capacity: 500, currentOccupancy: 320, amenities: ['water', 'electricity', 'medical', 'food'] },
  ];

  for (const s of shelterData) {
    const status = s.currentOccupancy >= (s as any).capacity ? ShelterStatus.FULL : ((s as any).status || ShelterStatus.OPEN);
    await prisma.shelter.upsert({
      where: { id: `seed-shelter-${s.name.replace(/\s/g, '-').toLowerCase()}` },
      update: { currentOccupancy: s.currentOccupancy },
      create: {
        id: `seed-shelter-${s.name.replace(/\s/g, '-').toLowerCase()}`,
        name: s.name, address: s.address, district: s.district,
        latitude: s.latitude, longitude: s.longitude,
        capacity: s.capacity, currentOccupancy: s.currentOccupancy,
        status, amenities: s.amenities, registeredById: districtOfficer.id,
      },
    });
  }
  console.log('✅ Shelters created');

  // ── RESCUE TEAMS ──────────────────────────────────────────────────
  const teams = [
    { teamCode: 'TEAM-A', teamName: 'Navy Swiftwater', teamType: 'Navy', contactNumber: '+94112345678', district: 'Colombo', status: RescueTeamStatus.AVAILABLE, memberCount: 12 },
    { teamCode: 'TEAM-B', teamName: 'Army Engineering', teamType: 'Army', contactNumber: '+94112345679', district: 'Ratnapura', status: RescueTeamStatus.EN_ROUTE, memberCount: 20 },
    { teamCode: 'TEAM-C', teamName: 'Civil Security Force', teamType: 'Civil', contactNumber: '+94112345680', district: 'Colombo', status: RescueTeamStatus.AVAILABLE, memberCount: 15 },
    { teamCode: 'TEAM-D', teamName: 'Red Cross First Aid', teamType: 'NGO', contactNumber: '+94112345681', district: 'Galle', status: RescueTeamStatus.RETURNING, memberCount: 8 },
  ];
  for (const t of teams) {
    await prisma.rescueTeam.upsert({
      where: { teamCode: t.teamCode },
      update: {},
      create: t,
    });
  }
  console.log('✅ Rescue teams created');

  // ── WARNINGS ──────────────────────────────────────────────────────
  const w1 = await prisma.warning.upsert({
    where: { warningCode: 'DMC-2026-F98' },
    update: {},
    create: {
      warningCode: 'DMC-2026-F98', hazardType: HazardType.FLOOD, severityLevel: SeverityLevel.EMERGENCY,
      message: 'EMERGENCY RED ALERT: Kelani River water levels have exceeded danger threshold in Colombo & Gampaha districts. Residents in low-lying zones must evacuate immediately to designated high-ground shelters.',
      targetDistricts: ['Colombo', 'Gampaha'], targetRiverBasin: 'Kelani River Basin',
      status: WarningStatus.ACTIVE, issuedById: dmcOfficer.id,
    },
  });

  await prisma.warning.upsert({
    where: { warningCode: 'DMC-2026-L42' },
    update: {},
    create: {
      warningCode: 'DMC-2026-L42', hazardType: HazardType.LANDSLIDE, severityLevel: SeverityLevel.WARNING,
      message: 'LANDSLIDE WARNING: Ratnapura slope stability sensors have flagged critical saturation levels. Residents in steep terrain must evacuate slopes immediately.',
      targetDistricts: ['Ratnapura', 'Kegalle'],
      status: WarningStatus.ACTIVE, issuedById: dutyOfficer.id,
    },
  });
  console.log('✅ Warnings created');

  // ── ORGANIZATIONS ─────────────────────────────────────────────────
  const org = await prisma.organization.upsert({
    where: { id: 'seed-org-red-cross' },
    update: {},
    create: { id: 'seed-org-red-cross', name: 'Sri Lanka Red Cross', type: 'NGO', contactNumber: '+94112691095', address: 'Colombo 10' },
  });

  // ── RELIEF SUPPLIES ───────────────────────────────────────────────
  const supplies = [
    { id: 'seed-supply-rice', name: 'Rice Packs', category: 'Food', quantity: 2400, unit: 'Units', location: 'Colombo Central Depot' },
    { id: 'seed-supply-water', name: 'Bottled Water', category: 'Water', quantity: 8000, unit: 'Liters', location: 'Colombo Central Depot' },
    { id: 'seed-supply-medicine', name: 'Emergency Medicine', category: 'Medicine', quantity: 340, unit: 'Kits', location: 'Ratnapura Regional Storage', organizationId: org.id },
    { id: 'seed-supply-blankets', name: 'Winter Blankets', category: 'Shelter Kit', quantity: 1200, unit: 'Units', location: 'Matara Safe Storage Hub' },
    { id: 'seed-supply-tents', name: 'Tarpaulins & Tents', category: 'Shelter Kit', quantity: 560, unit: 'Rolls', location: 'Matara Safe Storage Hub' },
  ];
  for (const s of supplies) {
    await prisma.reliefSupply.upsert({
      where: { id: s.id },
      update: {},
      create: s,
    });
  }
  console.log('✅ Relief supplies created');

  // ── SAMPLE HAZARD REPORT ──────────────────────────────────────────
  const citizen = await prisma.citizen.findUnique({ where: { userId: citizenUser.id } });
  if (citizen) {
    await prisma.hazardReport.upsert({
      where: { reportCode: 'RPT-2026-KLT-0001' },
      update: {},
      create: {
        reportCode: 'RPT-2026-KLT-0001',
        hazardType: HazardType.FLOOD,
        description: 'Kelani River water has breached the lateral sand barriers. Flooding is now moving into the secondary local service road. Heavy continuous rainfall still active.',
        photoUrls: [],
        gpsLatitude: 6.5823,
        gpsLongitude: 80.0384,
        district: 'Kalutara',
        locationLabel: 'Kalutara South, Kelani River Basin',
        citizenId: citizen.id,
      },
    });
  }
  console.log('✅ Sample hazard report created');

  // ── NOTIFICATION LOGS ─────────────────────────────────────────────
  await prisma.notificationLog.createMany({
    skipDuplicates: true,
    data: [
      { warningId: w1.id, channel: 'SMS_BLAST', recipientCount: 8200000, deliveredCount: 7134600, failedCount: 65400 },
      { warningId: w1.id, channel: 'PUSH_NOTIFICATION', recipientCount: 1400000, deliveredCount: 1316000, failedCount: 84000 },
    ],
  });
  console.log('✅ Notification logs created');

  console.log('\n🎉 Database seeded successfully!');
  console.log('\nTest accounts:');
  console.log('  DMC Officer:       national@dmc.lk   / Password123!');
  console.log('  DMC Duty Officer:  officer@dmc.lk    / Password123!');
  console.log('  District Officer:  coord@dmc.lk      / Password123!');
  console.log('  Citizen:           citizen@test.lk   / Password123!');
  console.log('  Rescue Team:       teama@rescue.lk   / Password123!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });