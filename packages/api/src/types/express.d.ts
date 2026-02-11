// Express 5 types have req.params values as string | string[].
// For named route parameters (e.g. :spaceId), they are always strings.
// This module augmentation fixes the type to reflect that.
import 'express';

declare module 'express' {
  interface Request {
    params: Record<string, string>;
  }
}
