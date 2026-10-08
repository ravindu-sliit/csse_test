import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DISTRICT_COORDS: Record<string, { lat: number; lng: number }> = {
  'Colombo': { lat: 6.9271, lng: 79.8612 },
  'Gampaha': { lat: 7.0873, lng: 79.9993 },
  'Kalutara': { lat: 6.5854, lng: 79.9607 },
  'Kandy': { lat: 7.2906, lng: 80.6337 },
  'Matale': { lat: 7.4675, lng: 80.6234 },
  'Nuwara Eliya': { lat: 6.9497, lng: 80.7891 },
  'Galle': { lat: 6.0535, lng: 80.2210 },
  'Matara': { lat: 5.9549, lng: 80.5550 },
  'Hambantota': { lat: 6.1241, lng: 81.1185 },
  'Jaffna': { lat: 9.6615, lng: 80.0255 },
  'Trincomalee': { lat: 8.5874, lng: 81.2152 },
  'Batticaloa': { lat: 7.7310, lng: 81.6747 },
  'Ampara': { lat: 7.2832, lng: 81.6742 },
  'Kurunegala': { lat: 7.4818, lng: 80.3609 },
  'Puttalam': { lat: 8.0362, lng: 79.8283 },
  'Anuradhapura': { lat: 8.3114, lng: 80.4037 },
  'Polonnaruwa': { lat: 7.9403, lng: 81.0188 },
  'Badulla': { lat: 6.9934, lng: 81.0550 },
  'Monaragala': { lat: 6.8728, lng: 81.3506 },
  'Ratnapura': { lat: 6.6828, lng: 80.3992 },
  'Kegalle': { lat: 7.2514, lng: 80.3464 },
  'Mannar': { lat: 8.9810, lng: 79.9044 },
  'Vavuniya': { lat: 8.7514, lng: 80.4971 },
  'Mullaitivu': { lat: 9.2671, lng: 80.8128 },
  'Kilinochchi': { lat: 9.3803, lng: 80.3770 },
};

async function main() {
  console.log('🔍 Finding shelters without GPS coordinates...');
  
  const sheltersWithoutCoords = await prisma.shelter.findMany({
    where: { OR: [{ latitude: null }, { longitude: null }] },
  });

  console.log(`Found ${sheltersWithoutCoords.length} shelters without coordinates`);

  for (const shelter of sheltersWithoutCoords) {
    const coords = DISTRICT_COORDS[shelter.district];
    if (coords) {
      // Add small random offset so markers don't overlap exactly
      const offset = () => (Math.random() - 0.5) * 0.02;
      await prisma.shelter.update({
        where: { id: shelter.id },
        data: {
          latitude: coords.lat + offset(),
          longitude: coords.lng + offset(),
        },
      });
      console.log(`✅ Updated: ${shelter.name} (${shelter.district})`);
    } else {
      console.log(`⚠️ Unknown district: ${shelter.district} for ${shelter.name}`);
    }
  }

  console.log('\n🎉 Done! All shelters now have GPS coordinates.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
