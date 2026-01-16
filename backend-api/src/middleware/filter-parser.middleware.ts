import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to parse filter[fieldName] query parameters into a structured filter object
 * and parse the fields parameter into an array of field names.
 * 
 * Express's query parser (qs library) converts filter[name]=value to { filter: { name: value } }
 * This middleware extracts that nested object and makes it available as req.parsedFilter
 * 
 * Example:
 * URL: ?filter[name]=john&filter[email]=gmail&fields=id,name,email
 * Express parses to: { filter: { name: "john", email: "gmail" }, fields: "id,name,email" }
 * Middleware sets: req.parsedFilter = { name: "john", email: "gmail" }
 *                  req.parsedFields = ["id", "name", "email"]
 */

export interface ParsedFilterRequest extends Request {
  parsedFilter?: Record<string, any>;
  parsedFields?: string[];
}

export function parseFilterParameters(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const parsedReq = req as ParsedFilterRequest;

  // Parse filter parameters
  // Express's query parser converts filter[name]=value to { filter: { name: value } }
  if (req.query.filter && typeof req.query.filter === 'object' && !Array.isArray(req.query.filter)) {
    parsedReq.parsedFilter = req.query.filter as Record<string, any>;
  }

  // Parse fields parameter
  if (req.query.fields && typeof req.query.fields === 'string') {
    const fieldsStr = req.query.fields as string;
    parsedReq.parsedFields = fieldsStr
      .split(',')
      .map(f => f.trim())
      .filter(f => f.length > 0);
  }

  next();
}
