import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import type { Response } from "express";

/**
 * Every error leaves the API in one shape:
 *   { "statusCode": 422, "error": "2 fields are invalid.", "details": [ { "field", "message" } ] }
 * Services throw Nest's built-in exceptions (NotFoundException, ConflictException ...) with either a
 * message or an object { error, details, ... }; this filter turns both into that shape.
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger("Error");

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      let payload: Record<string, unknown>;
      if (typeof body === "string") payload = { error: body };
      else {
        const { message, error, statusCode, ...rest } = body as Record<string, unknown>;
        // Nest's own errors use { message, error: "Not Found" }; ours use { error: "...", details }
        const text = typeof error === "string" && !message ? error : Array.isArray(message) ? message.join(" ") : (message as string) ?? error;
        payload = { error: text, ...rest };
      }
      if (status === HttpStatus.UNAUTHORIZED) res.setHeader("WWW-Authenticate", "Bearer");
      return res.status(status).json({ statusCode: status, ...payload });
    }

    this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    return res.status(500).json({ statusCode: 500, error: "Something went wrong on the server." });
  }
}
