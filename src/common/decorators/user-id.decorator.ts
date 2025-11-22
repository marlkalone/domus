import { ExecutionContext, createParamDecorator } from "@nestjs/common";

//Decorator para injetar o userId em uma rota
export const UserId = createParamDecorator(
  (_: never, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest();
    return request.user?.sub;
  },
);
