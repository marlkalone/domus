import { Injectable } from "@nestjs/common";
import { eachMonthOfInterval, differenceInDays, Interval } from "date-fns";
import { PeriodicityType } from "../../../common/enums/transaction.enum";

@Injectable()
export class RecurrenceSplitter {
  split(
    start: Date,
    end: Date,
    recurrence: PeriodicityType,
  ): Array<{ start: Date; end: Date }> {
    if (recurrence !== PeriodicityType.RECURRING) {
      return [{ start, end }];
    }
    const dayOfMonth = start.getUTCDate();

    const utcStart = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()),
    );
    const utcEnd = new Date(
      Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()),
    );

    const months = eachMonthOfInterval({
      start: utcStart,
      end: utcEnd,
    } as Interval);
    const segments: Array<{ start: Date; end: Date }> = [];

    months.forEach((monthStart, idx) => {
      const s = new Date(
        Date.UTC(
          monthStart.getUTCFullYear(),
          monthStart.getUTCMonth(),
          dayOfMonth,
        ),
      );

      const isLastSegment = idx === months.length - 1;

      const e = isLastSegment
        ? end
        : new Date(
            Date.UTC(
              months[idx + 1].getUTCFullYear(),
              months[idx + 1].getUTCMonth(),
              dayOfMonth,
            ),
          );

      if (differenceInDays(e, s) >= 28 || (isLastSegment && e >= s)) {
        segments.push({ start: s, end: e });
      }
    });

    return segments;
  }
}
