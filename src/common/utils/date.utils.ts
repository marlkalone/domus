import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from "class-validator";

@ValidatorConstraint({ name: "isValidDate", async: false })
export class IsValidDateConstraint implements ValidatorConstraintInterface {
  validate(date: any, args: ValidationArguments) {
    if (!date) {
      return false;
    }

    const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
    return dateRegex.test(date);
  }

  defaultMessage(args: ValidationArguments) {
    return "A data de prazo deve estar no formato DD/MM/YYYY";
  }
}
