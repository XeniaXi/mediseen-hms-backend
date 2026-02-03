declare namespace Express {
  interface Request {
    user?: {
      id: string;
      email: string;
      role: string;
      hospitalId: string | null;
      firstName: string;
      lastName: string;
    };
  }
}
