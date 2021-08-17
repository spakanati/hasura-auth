import { Response } from 'express';
import {
  ContainerTypes,
  ValidatedRequest,
  ValidatedRequestSchema,
} from 'express-joi-validation';
import { v4 as uuidv4 } from 'uuid';

import { getGravatarUrl, getUserByEmail, hashPassword } from '@/helpers';
import { gqlSdk } from '@/utils/gqlSDK';
import { emailClient } from '@/email';
import { insertProfile, isProfileValid } from '@/utils/profile';
import { isValidEmail } from '@/utils/email';
import { isPasswordValid } from '@/utils/password';
import { isRolesValid } from '@/utils/roles';
import { ENV } from '@/utils/env';
import { generateTicketExpiresAt } from '@/utils/ticket';
import { getSignInResponse } from '@/utils/tokens';

type Profile = {
  [key: string]: string | number | boolean;
};

type BodyType = {
  email: string;
  password: string;
  locale?: string;
  allowedRoles?: string[];
  defaultRole?: string;
  displayName?: string;
  profile?: Profile;
};

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: BodyType;
}

export const signUpEmailPasswordHandler = async (
  req: ValidatedRequest<Schema>,
  res: Response
): Promise<unknown> => {
  const { body } = req;
  const { email, password, profile, locale = ENV.DEFAULT_LOCALE } = body;

  // check email
  if (!(await isValidEmail({ email, res }))) {
    // function send potential error via `res`
    return;
  }

  // check password
  if (!(await isPasswordValid({ password, res }))) {
    // function send potential error via `res`
    return;
  }

  // check profile
  if (!(await isProfileValid({ profile, res }))) {
    // function send potential error via `res`
    return;
  }

  // check roles
  const defaultRole = body.defaultRole ?? ENV.DEFAULT_USER_ROLE;
  const allowedRoles = body.allowedRoles ?? ENV.DEFAULT_ALLOWED_USER_ROLES;
  if (!(await isRolesValid({ defaultRole, allowedRoles, res }))) {
    return;
  }

  // check if email already in use by some other user
  if (await getUserByEmail(email)) {
    return res.boom.conflict('Email already in use');
  }

  // hash password
  const passwordHash = await hashPassword(password);

  // create ticket
  const ticket = `verifyEmail:${uuidv4()}`;
  const ticketExpiresAt = generateTicketExpiresAt(60 * 60);

  // restructure user roles to be inserted in GraphQL mutation
  const userRoles = allowedRoles.map((role: string) => ({ role }));

  const displayName = body.displayName ?? email;
  const avatarUrl = getGravatarUrl(email);

  // insert user
  const user = await gqlSdk
    .insertUser({
      user: {
        disabled: ENV.DISABLE_NEW_USERS,
        displayName,
        avatarUrl,
        email,
        passwordHash,
        ticket,
        ticketExpiresAt,
        emailVerified: false,
        locale,
        defaultRole,
        roles: {
          data: userRoles,
        },
      },
    })
    .then((res) => res.insertUser);

  if (!user) {
    throw new Error('Unable to insert new user');
  }

  await insertProfile({ userId: user.id, profile });

  // user is now inserted. Continue sending out activation email
  if (!ENV.DISABLE_NEW_USERS && ENV.SIGNIN_EMAIL_VERIFIED_REQUIRED) {
    if (!ENV.EMAILS_ENABLED) {
      throw new Error('SMTP settings unavailable');
    }

    await emailClient.send({
      template: 'verify-email',
      message: {
        to: email,
        headers: {
          'x-ticket': {
            prepared: true,
            value: ticket,
          },
          'x-email-template': {
            prepared: true,
            value: 'verify-email',
          },
        },
      },
      locals: {
        displayName,
        ticket,
        email,
        url: ENV.SERVER_URL,
        locale: user.locale,
      },
    });
  }

  // SIGNIN_EMAIL_VERIFIED_REQUIRED = true => Must verify email before sign in
  // SIGNIN_EMAIL_VERIFIED_REQUIRED = true => Don't have to verify email before
  // sign in

  if (!ENV.SIGNIN_EMAIL_VERIFIED_REQUIRED) {
    const signInResponse = await getSignInResponse({
      userId: user.id,
      checkMFA: false,
    });

    // return logged in session because user does not have to verify their email
    // to sign in
    return res.send(signInResponse);
  }

  return res.send({ session: null, mfa: null });
};
