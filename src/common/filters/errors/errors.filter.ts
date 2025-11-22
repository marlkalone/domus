import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  HttpException,
} from "@nestjs/common";
import { AppError } from "./app-errors";

@Catch(Error)
export class AppExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest<Request>();

    let status: number;
    let payload: any;

    if (exception instanceof AppError) {
      const httpEx = exception.toHTTPResponse();
      status = httpEx.getStatus();
      payload = httpEx.getResponse();
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      payload = exception.getResponse();
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      payload = {
        statusCode: status,
        message: (exception as any)?.message || "Internal server error",
      };
      console.error("Unexpected error", exception);
    }

    const body = {
      statusCode: status,
      message: payload["message"] ?? payload,
      data: payload["data"] ?? null,
    };

    const log = {
      statusCode: status,
      message: payload["message"] ?? payload,
      data: payload["data"] ?? null,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(status).json(body);
  }
}
