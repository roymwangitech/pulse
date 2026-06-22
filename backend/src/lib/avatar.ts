import { createHash, randomBytes } from 'crypto';

const AVATAR_STYLES = [
  'avataaars',
  'bottts',
  'pixel-art',
  'identicon',
  'shapes',
  'thumbs',
] as const;

export function generateAvatarUrl(username: string, seed?: string): string {
  const styles = AVATAR_STYLES;
  const styleIndex = createHash('md5').update(username).digest()[0] % styles.length;
  const style = styles[styleIndex];
  const avatarSeed = seed ?? randomBytes(8).toString('hex');
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(avatarSeed)}&backgroundColor=1d9bf0,0ea5e9,8b5cf6,ec4899,f97316`;
}

export function generateAvatarSeed(): string {
  return randomBytes(12).toString('hex');
}
