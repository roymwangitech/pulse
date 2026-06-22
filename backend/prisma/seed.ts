import { PrismaClient, StickerCategory } from '@prisma/client';

const prisma = new PrismaClient();

const stickerData: { name: string; url: string; category: StickerCategory }[] = [
  { name: 'Pepe Wave', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f44b.png', category: 'MEMES' },
  { name: 'Thumbs Up', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f44d.png', category: 'REACTIONS' },
  { name: 'Heart Eyes', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f60d.png', category: 'REACTIONS' },
  { name: 'Fire', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f525.png', category: 'REACTIONS' },
  { name: 'Laughing', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f602.png', category: 'MEMES' },
  { name: 'Crying', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f62d.png', category: 'REACTIONS' },
  { name: 'Game Controller', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f3ae.png', category: 'GAMING' },
  { name: 'Joystick', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f579.png', category: 'GAMING' },
  { name: 'Trophy', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f3c6.png', category: 'GAMING' },
  { name: 'Sparkles', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/2728.png', category: 'ANIME' },
  { name: 'Star', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/2b50.png', category: 'ANIME' },
  { name: 'Moon', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f319.png', category: 'ANIME' },
  { name: 'Cat', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f431.png', category: 'ANIMALS' },
  { name: 'Dog', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f436.png', category: 'ANIMALS' },
  { name: 'Panda', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f43c.png', category: 'ANIMALS' },
  { name: 'Party', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f389.png', category: 'RANDOM_FUN' },
  { name: 'Rocket', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f680.png', category: 'RANDOM_FUN' },
  { name: 'Rainbow', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f308.png', category: 'RANDOM_FUN' },
  { name: 'Eyes', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f440.png', category: 'MEMES' },
  { name: 'Skull', url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f480.png', category: 'MEMES' },
];

async function main() {
  console.log('Seeding stickers...');
  for (const sticker of stickerData) {
    await prisma.sticker.upsert({
      where: { id: sticker.name.toLowerCase().replace(/\s+/g, '-') },
      update: sticker,
      create: { id: sticker.name.toLowerCase().replace(/\s+/g, '-'), ...sticker },
    });
  }
  console.log(`Seeded ${stickerData.length} stickers`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
