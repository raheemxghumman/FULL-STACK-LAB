import { UnprocessableEntityException, ValidationError, ValidationPipe } from "@nestjs/common";

const CARD_FIELDS = ["number", "cardNumber", "cvc", "cvv", "expiry"];

/* Turns class-validator's nested errors into a flat list: [{ field: "shipping.postal", message }]. */
function flatten(errors: ValidationError[], prefix = ""): { field: string; message: string }[] {
  return errors.flatMap((e) => {
    const field = prefix + e.property;
    const own = Object.entries(e.constraints || {}).map(([rule, message]) => {
      if (rule === "whitelistValidation") {
        return {
          field,
          message: prefix === "payment." && CARD_FIELDS.includes(e.property)
            ? "Never send full card details to the API. Send only the last 4 digits as payment.last4."
            : `"${e.property}" is not a field the API accepts here.`
        };
      }
      return { field, message };
    });
    return [...own, ...flatten(e.children || [], field + ".")];
  });
}

/**
 * One ValidationPipe for the whole app (registered in main.ts).
 *  - whitelist + forbidNonWhitelisted: unknown fields are refused, not silently dropped
 *  - transform: query strings and bodies become instances of the DTO classes
 *  - errors become 422 Unprocessable Entity with a details list, the same format as the Lab 7 API,
 *    so the store's front end can show each message next to the right field
 */
export const validationPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  exceptionFactory: (errors) => {
    const details = flatten(errors);
    const card = details.find((d) => d.message.startsWith("Never send full card"));
    return new UnprocessableEntityException({
      error: card ? card.message : `${details.length} field${details.length > 1 ? "s are" : " is"} invalid.`,
      details
    });
  }
});
