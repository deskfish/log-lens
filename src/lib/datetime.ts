import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

/** flybot 日志默认时区（100 环境服务器为北京时间） */
export const LOG_TIMEZONE = "Asia/Shanghai";
const TZ_OFFSET = "+08:00";

const HAS_TZ = /[zZ]|[+-]\d{2}:?\d{2}$/;

/**
 * 解析日志时间字符串。无时区的 datetime 一律按北京时间处理。
 */
export function parseLogTimestamp(raw: string): number | null {
  const text = raw.trim();
  if (!text) return null;

  if (HAS_TZ.test(text)) {
    const ms = Date.parse(text.includes("T") ? text : text.replace(" ", "T"));
    return Number.isNaN(ms) ? null : ms;
  }

  const iso = text.replace(" ", "T");
  const ms = Date.parse(`${iso}${TZ_OFFSET}`);
  return Number.isNaN(ms) ? null : ms;
}

/** 格式化为北京时间 */
export function formatLogTime(
  ms: number,
  pattern = "YYYY-MM-DD HH:mm:ss.SSS",
): string {
  return dayjs(ms).tz(LOG_TIMEZONE).format(pattern);
}

export function formatLogTimeShort(ms: number): string {
  return formatLogTime(ms, "MM-DD HH:mm:ss.SSS");
}

export function formatLogTimeOfDay(ms: number): string {
  return formatLogTime(ms, "HH:mm:ss");
}
