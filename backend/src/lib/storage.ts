import { mkdir } from 'fs/promises';
import { join, extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/index.js';

export interface StorageProvider {
  upload(file: Express.Multer.File, folder: string): Promise<string>;
  delete(url: string): Promise<void>;
  getPublicUrl(key: string): string;
}

class LocalStorageProvider implements StorageProvider {
  private baseDir: string;

  constructor() {
    this.baseDir = config.upload.dir;
  }

  async ensureDir(folder: string): Promise<string> {
    const dir = join(this.baseDir, folder);
    await mkdir(dir, { recursive: true });
    return dir;
  }

  async upload(file: Express.Multer.File, folder: string): Promise<string> {
    const dir = await this.ensureDir(folder);
    const ext = extname(file.originalname) || '.jpg';
    const filename = `${uuidv4()}${ext}`;
    const { writeFile } = await import('fs/promises');
    const filepath = join(dir, filename);
    await writeFile(filepath, file.buffer);
    return `${config.upload.baseUrl}/${folder}/${filename}`;
  }

  async delete(url: string): Promise<void> {
    const key = url.replace(`${config.upload.baseUrl}/`, '');
    const { unlink } = await import('fs/promises');
    try {
      await unlink(join(this.baseDir, key));
    } catch {
      // file may not exist
    }
  }

  getPublicUrl(key: string): string {
    return `${config.upload.baseUrl}/${key}`;
  }
}

class S3StorageProvider implements StorageProvider {
  async upload(_file: Express.Multer.File, _folder: string): Promise<string> {
    throw new Error('S3 storage not configured. Set AWS credentials and STORAGE_PROVIDER=s3');
  }
  async delete(_url: string): Promise<void> {
    throw new Error('S3 storage not configured');
  }
  getPublicUrl(key: string): string {
    return `https://${process.env.S3_BUCKET}.s3.amazonaws.com/${key}`;
  }
}

export function createStorageProvider(): StorageProvider {
  switch (config.storage.provider) {
    case 's3':
    case 'r2':
    case 'supabase':
      return new S3StorageProvider();
    default:
      return new LocalStorageProvider();
  }
}

export const storage = createStorageProvider();
