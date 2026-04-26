import { closePool } from '../db/connection';

export default async function globalTeardown() {
  await closePool();
}
