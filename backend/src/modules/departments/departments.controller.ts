import { Request, Response } from 'express';
import * as service from './departments.service';

export async function getDepartments(req: Request, res: Response) {
  const data = await service.getDepartments();
  res.json({ success: true, data });
}
