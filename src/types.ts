export type ClaimValueType =
  | string
  | string[]
  | number
  | number[]
  | RegExp
  | RegExp[]
  | boolean
  | boolean[]
  | null
  | undefined;

/**
 * Claims interface.
 */
export interface Claims {
  'x-hasura-user-id': string;
  'x-hasura-default-role': string;
  'x-hasura-allowed-roles': string[];
  [key: string]: ClaimValueType;
}

/**
 * PermissionVariables interface.
 */
export interface PermissionVariables {
  'user-id': string;
  'default-role': string;
  'allowed-roles': string[];
  [key: string]: ClaimValueType;
}

/**
 * Token interface.
 */
export type Token = {
  [key: string]: Claims;
} & {
  'https://hasura.io/jwt/claims': Claims;
  exp: bigint;
  iat: bigint;
  iss: string;
  sub: string;
};

// Session and user

export type Session = {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
  user: User | null;
};

export type User = {
  id: string;
  createdAt: string;
  displayName: string;
  avatarUrl: string;
  locale: string;
  email?: string;
  isAnonymous: boolean;
  defaultRole: string;
  roles: string[];
  profile: null | {
    [key: string]: string;
  };
};

export type Mfa = {
  ticket: string | null;
};

export type SignInResponse = {
  session: Session | null;
  mfa: Mfa | null;
};

export type PasswordlessMode = 'code' | 'link';

export type PasswordLessEmailBody = {
  connection: 'email';
  mode: PasswordlessMode;
  email: string;
  locale?: string;
  allowedRoles?: string[];
  defaultRole?: string;
  displayName?: string;
  profile?: Profile;
};

export type PasswordLessSmsBody = {
  connection: 'sms';
  mode: 'code'; // only support code for now
  phoneNumber: string;
  locale: string;
  allowedRoles: string[];
  defaultRole: string;
  displayName: string;
  profile: Profile | null;
};

export type Profile = {
  [key: string]: string | number | boolean;
};

export type OtpEmailBody = {
  connection: 'email';
  email: string;
  otp: string;
};

export type OtpSmsBody = {
  connection: 'sms';
  phoneNumber: string;
  otp: string;
};
