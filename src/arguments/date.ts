import type { ArgumentContext, ArgumentResult } from '@sapphire/framework';
import { Argument } from '@sapphire/framework';

const DATE_REGEX = /^(?<day>\d{1,2})[/-](?<month>\d{1,2})(?:[/-](?<year>\d{1,4}))?$/imu;

export default class DateArgument extends Argument<Date> {
  public run(arg: string, _context: ArgumentContext<Date>): ArgumentResult<Date> {
    if (!DATE_REGEX.test(arg))
      return this.error({ parameter: arg });

    const groups = DATE_REGEX.exec(arg)?.groups;
    const date = new Date();
    // Start by settings the day to 1, so when we set the month we don't have any problem with months
    // that are not 31 days long. (this took me hours of debugging)
    date.setDate(1);
    const month = Number.parseInt(groups?.month, 10) - 1;
    const day = Number.parseInt(groups?.day, 10);
    const year = Number.parseInt(groups?.year, 10);
    date.setMonth(month);
    date.setDate(day);
    date.setHours(0, 0, 0, 0);

    if (groups.year)
      date.setFullYear(year);
    else if (month < new Date().getMonth())
      date.setFullYear(year + 1);

    const time = date.getTime();
    if (Number.isNaN(time))
      return this.error({ parameter: arg });

    return this.ok(date);
  }
}
