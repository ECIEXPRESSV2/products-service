import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { RequestWithUser } from '../guards/remote-auth.guard';

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest<RequestWithUser>();
  return req.user;
});
