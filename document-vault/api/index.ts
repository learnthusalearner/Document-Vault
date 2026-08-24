import type { VercelRequest, VercelResponse } from "@vercel/node";
import { yoga } from "../src/app.js";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  return yoga(req, res);
}
