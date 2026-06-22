import 'express';

declare module 'express-serve-static-core' {
  interface Application {
    get(name: 'io'): import('socket.io').Server | undefined;
    set(name: 'io', val: import('socket.io').Server): this;
  }
}

declare global {
  namespace Express {
    interface Multer {
      File: Express.Multer.File;
    }
  }
}

export {};
