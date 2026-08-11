import type { NextFunction, Request, Response } from 'express';
import * as repo from '../db/repo.js';
import { DEFAULT_SENDER_ID } from '../db/tables.js';

declare module 'express-serve-static-core' {
  interface Request {
    /** Active sender id, resolved from the X-Sender-Id header (default sender when absent). */
    senderId: string;
  }
}

/**
 * Resolves the active sender from the X-Sender-Id header. No header means the
 * default (Honest Taskers) sender, which keeps old clients, tests and curl
 * working unchanged. Real per-user auth replaces this in a later phase.
 */
export async function resolveSender(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.get('X-Sender-Id');
  if (!header) {
    req.senderId = DEFAULT_SENDER_ID;
    return next();
  }
  const sender = await repo.getSender(header);
  if (!sender) {
    res.status(404).json({ error: 'Unknown sender' });
    return;
  }
  req.senderId = sender.id;
  next();
}
