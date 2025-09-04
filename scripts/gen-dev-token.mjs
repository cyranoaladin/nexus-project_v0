#!/usr/bin/env node
import jwt from 'jsonwebtoken';

const secret = process.env.NEXTAUTH_SECRET || 'e2e-test-secret';
const payload = {
  sub: 'dev-admin',
  email: 'admin.dev@nexus.local',
  role: 'ADMIN',
  dev: true,
};

const token = jwt.sign(payload, secret, { algorithm: 'HS256', expiresIn: '12h' });
process.stdout.write(token);
