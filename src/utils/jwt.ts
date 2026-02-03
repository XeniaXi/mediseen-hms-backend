import jwt from 'jsonwebtoken';

interface UserPayload {
  id: string;
  email: string;
  role: string;
  hospitalId: string | null;
  firstName: string;
  lastName: string;
}

// Enforce strong JWT secrets in production
if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
    throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be set in production');
  }
}

// Use secure fallbacks for development only
const JWT_SECRET = process.env.JWT_SECRET || '6df873ca7c2133520810df9a40eb60f76750fac68ec4d37c4723269085010900';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'f062becf55b5e4aba92d7133e551c11be63e9e066dc7e89564c50ffd81a7e142';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

export const generateAccessToken = (user: UserPayload): string => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      hospitalId: user.hospitalId,
      firstName: user.firstName,
      lastName: user.lastName,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions
  );
};

export const generateRefreshToken = (user: UserPayload): string => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      hospitalId: user.hospitalId,
      firstName: user.firstName,
      lastName: user.lastName,
    },
    JWT_REFRESH_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRES_IN } as jwt.SignOptions
  );
};

export const verifyAccessToken = (token: string): UserPayload => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as UserPayload;
    return decoded;
  } catch (error) {
    throw new Error('Invalid or expired access token');
  }
};

export const verifyRefreshToken = (token: string): UserPayload => {
  try {
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET) as UserPayload;
    return decoded;
  } catch (error) {
    throw new Error('Invalid or expired refresh token');
  }
};
