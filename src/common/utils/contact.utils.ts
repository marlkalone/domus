import { ContactDetailDTO } from "../../modules/contact/dto/contact-detail.dto";
import { ContactDetailKey } from "../enums/contact.enums";

export function isContactDetailValid(detail: ContactDetailDTO): boolean {
  const { key, value } = detail;

  switch (key) {
    case ContactDetailKey.BIRTH_DATE:
      return !isNaN(Date.parse(value));

    case ContactDetailKey.LEGAL_NAME:
    case ContactDetailKey.TRADE_NAME:
    case ContactDetailKey.STATE_REGISTRATION:
    case ContactDetailKey.MUNICIPAL_REGISTRATION:
    case ContactDetailKey.ZIP_CODE:
    case ContactDetailKey.STATE:
    case ContactDetailKey.CITY:
    case ContactDetailKey.STREET:
    case ContactDetailKey.COMPLEMENT:
    case ContactDetailKey.TAX_ID:
    case ContactDetailKey.NOTES:
      return value.trim().length > 0;

    default:
      return false;
  }
}
