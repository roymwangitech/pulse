import { createHash, randomBytes } from 'crypto';

// All available local avatars in /public/avatars/
const AVATARS = [
  '3d_1','3d_2','3d_3','3d_4','3d_5',
  'bluey_1','bluey_2','bluey_3','bluey_4','bluey_5','bluey_6','bluey_7','bluey_8','bluey_9','bluey_10',
  'memo_1','memo_2','memo_3','memo_4','memo_5','memo_6','memo_7','memo_8','memo_9','memo_10',
  'memo_11','memo_12','memo_13','memo_14','memo_15','memo_16','memo_17','memo_18','memo_19','memo_20',
  'memo_21','memo_22','memo_23','memo_24','memo_25','memo_26','memo_27','memo_28','memo_29','memo_30',
  'memo_31','memo_32','memo_33','memo_34','memo_35',
  'notion_1','notion_2','notion_3','notion_4','notion_5','notion_6','notion_7','notion_8','notion_9',
  'notion_10','notion_11','notion_12','notion_13','notion_14','notion_15',
  'teams_1','teams_2','teams_3','teams_4','teams_5','teams_6','teams_7','teams_8','teams_9',
  'toon_1','toon_2','toon_3','toon_4','toon_5','toon_6','toon_7','toon_8','toon_9','toon_10',
  'upstream_1','upstream_2','upstream_3','upstream_4','upstream_5','upstream_6','upstream_7',
  'upstream_8','upstream_9','upstream_10','upstream_11','upstream_12','upstream_13','upstream_14',
  'upstream_15','upstream_16','upstream_17','upstream_18','upstream_19','upstream_20','upstream_21','upstream_22',
  'vibrent_1','vibrent_2','vibrent_3','vibrent_4','vibrent_5','vibrent_6','vibrent_7','vibrent_8',
  'vibrent_9','vibrent_10','vibrent_11','vibrent_12','vibrent_13','vibrent_14','vibrent_15','vibrent_16',
  'vibrent_17','vibrent_18','vibrent_19','vibrent_20','vibrent_21','vibrent_22','vibrent_23','vibrent_24',
  'vibrent_25','vibrent_26','vibrent_27',
];

/** Pick a deterministic avatar for a username, or a random one when regenerating. */
export function generateAvatarUrl(username: string, seed?: string): string {
  let index: number;
  if (seed) {
    // seed is a hex string — use first 4 chars as a number for random pick
    index = parseInt(seed.slice(0, 4), 16) % AVATARS.length;
  } else {
    index = createHash('md5').update(username).digest()[0] % AVATARS.length;
  }
  return `/avatars/${AVATARS[index]}.png`;
}

export function generateAvatarSeed(): string {
  return randomBytes(12).toString('hex');
}
