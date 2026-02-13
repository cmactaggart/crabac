import { Router, type Request, type Response, type NextFunction } from 'express';
import { validate } from '../../middleware/validate.js';
import { validation } from '@crabac/shared';
import { strictAuthLimiter } from '../../middleware/rate-limiter.js';
import * as boardAuthService from './board-auth.service.js';

export const boardAuthRoutes = Router();

// Board user registration
boardAuthRoutes.post(
  '/register',
  strictAuthLimiter,
  validate(validation.boardRegisterSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await boardAuthService.registerBoardUser(req.body);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// Board user login
boardAuthRoutes.post(
  '/login',
  strictAuthLimiter,
  validate(validation.boardLoginSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await boardAuthService.loginBoardUser(req.body.login, req.body.password);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);
