export const DAILY_PROFIT_RATE = 0.10
export const BUSINESS_TIME_ZONE = 'Africa/Kinshasa'
export const DEFAULT_DURATION_MONTHS = 3

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Converts a date-like value to a valid Date, or null when it cannot be used.
 * @param {Date | string | number | null | undefined} value
 * @returns {Date | null}
 */
export function toValidDate(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime())
  }

  if (typeof value !== 'string' && typeof value !== 'number') return null

  // Une date SQL « YYYY-MM-DD » est une date métier, pas un instant UTC à
  // minuit.  On l'ancre à midi UTC pour éviter qu'elle bascule sur la veille
  // dans Africa/Kinshasa.
  if (typeof value === 'string') {
    const dateOnly = /^(\\d{4})-(\\d{2})-(\\d{2})$/.exec(value)
    if (dateOnly) {
      const year = Number(dateOnly[1])
      const month = Number(dateOnly[2])
      const day = Number(dateOnly[3])
      if (month < 1 || month > 12 || day < 1 || day > getDaysInMonth(year, month - 1)) return null
      return new Date(Date.UTC(year, month - 1, day, 12))
    }
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function isValidDate(value) {
  return toValidDate(value) !== null
}

export function roundToTwoDecimals(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return 0
  return Math.round((amount + Number.EPSILON) * 100) / 100
}

/** The contractual gain is always 10% of invested capital, rounded to cents. */
export function calculateDailyProfit(capital) {
  const amount = Number(capital)
  if (!Number.isFinite(amount) || amount <= 0) return 0
  return roundToTwoDecimals(amount * DAILY_PROFIT_RATE)
}

function getDatePartsInTimeZone(value, timeZone = BUSINESS_TIME_ZONE) {
  const date = toValidDate(value)
  if (!date) return null

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const values = {}
  for (const part of parts) {
    if (part.type === 'year' || part.type === 'month' || part.type === 'day') {
      values[part.type] = Number(part.value)
    }
  }

  if (!Number.isInteger(values.year) || !Number.isInteger(values.month) || !Number.isInteger(values.day)) {
    return null
  }

  return values
}

function getDateTimePartsInTimeZone(value, timeZone = BUSINESS_TIME_ZONE) {
  const date = toValidDate(value)
  if (!date) return null

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)

  const values = {}
  for (const part of parts) {
    if (['year', 'month', 'day', 'hour', 'minute', 'second'].includes(part.type)) {
      values[part.type] = Number(part.value)
    }
  }
  values.millisecond = date.getUTCMilliseconds()

  return values
}

function getTimeZoneOffsetMilliseconds(date, timeZone = BUSINESS_TIME_ZONE) {
  const parts = getDateTimePartsInTimeZone(date, timeZone)
  if (!parts) return 0
  const localAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    parts.millisecond,
  )
  return localAsUtc - date.getTime()
}

function businessDateTimeToDate(dateKey, timeParts, timeZone = BUSINESS_TIME_ZONE) {
  const serial = businessDateKeyToSerial(dateKey)
  if (serial === null || !timeParts) return null
  const [year, month, day] = dateKey.split('-').map(Number)

  const localAsUtc = Date.UTC(
    year,
    month - 1,
    day,
    timeParts.hour,
    timeParts.minute,
    timeParts.second,
    timeParts.millisecond,
  )
  const firstOffset = getTimeZoneOffsetMilliseconds(new Date(localAsUtc), timeZone)
  let result = localAsUtc - firstOffset
  const correctedOffset = getTimeZoneOffsetMilliseconds(new Date(result), timeZone)
  if (correctedOffset !== firstOffset) result = localAsUtc - correctedOffset
  return new Date(result)
}

/**
 * Returns YYYY-MM-DD in the BISO business timezone (Africa/Kinshasa).
 * @param {Date | string | number | null} [value]
 * @returns {string | null}
 */
export function getBusinessDateKey(value = new Date()) {
  const parts = getDatePartsInTimeZone(value)
  if (!parts) return null
  return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`
}

/** Month is zero-based, matching JavaScript Date. Invalid input returns 0. */
export function getDaysInMonth(year, month = 0) {
  if (!Number.isFinite(year) || !Number.isFinite(month)) return 0

  const normalizedYear = Math.trunc(year)
  const normalizedMonth = Math.trunc(month)
  if (normalizedYear < 1 || normalizedYear > 9999) return 0

  const lastDay = new Date(0)
  lastDay.setUTCHours(0, 0, 0, 0)
  lastDay.setUTCFullYear(normalizedYear, normalizedMonth + 1, 0)
  return lastDay.getUTCDate()
}

/** Adds calendar months while clamping to the last valid day of the target month. */
export function addCalendarMonths(value, months) {
  const date = toValidDate(value)
  const amount = Number(months)
  if (!date || !Number.isFinite(amount)) return null

  const result = new Date(date.getTime())
  const targetDay = result.getDate()
  result.setDate(1)
  result.setMonth(result.getMonth() + Math.trunc(amount))
  const targetMonthDays = getDaysInMonth(result.getFullYear(), result.getMonth())
  result.setDate(Math.min(targetDay, targetMonthDays))
  return result
}

function businessDateKeyToSerial(dateKey) {
  if (typeof dateKey !== 'string') return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1 || day > getDaysInMonth(year, month - 1)) return null

  const result = new Date(0)
  result.setUTCHours(0, 0, 0, 0)
  result.setUTCFullYear(year, month - 1, day)
  return result.getTime()
}

/** Adds months to a business-date key without JavaScript month-end overflow. */
export function addBusinessMonths(dateKey, months) {
  const serial = businessDateKeyToSerial(dateKey)
  const amount = Number(months)
  if (serial === null || !Number.isFinite(amount)) return null

  const date = new Date(serial)
  const targetDay = date.getUTCDate()
  date.setUTCDate(1)
  date.setUTCMonth(date.getUTCMonth() + Math.trunc(amount))
  const targetMonthDays = getDaysInMonth(date.getUTCFullYear(), date.getUTCMonth())
  date.setUTCDate(Math.min(targetDay, targetMonthDays))
  return `${String(date.getUTCFullYear()).padStart(4, '0')}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

/** Adds calendar days to a business-date key (YYYY-MM-DD). */
export function addBusinessDays(dateKey, days) {
  const serial = businessDateKeyToSerial(dateKey)
  const amount = Number(days)
  if (serial === null || !Number.isFinite(amount)) return null

  const date = new Date(serial)
  date.setUTCDate(date.getUTCDate() + Math.trunc(amount))
  return `${String(date.getUTCFullYear()).padStart(4, '0')}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

export function getBusinessDayDifference(laterDateKey, earlierDateKey) {
  const later = businessDateKeyToSerial(laterDateKey)
  const earlier = businessDateKeyToSerial(earlierDateKey)
  if (later === null || earlier === null) return 0
  return Math.round((later - earlier) / MILLISECONDS_PER_DAY)
}

function normalizeDurationMonths(value) {
  const months = Number(value)
  if (!Number.isFinite(months) || months <= 0) return DEFAULT_DURATION_MONTHS
  return Math.min(12, Math.max(1, Math.trunc(months)))
}

function getContractStart(contract, fallbackDate) {
  const candidates = [contract?.created_at, contract?.start_date, contract?.startDate, fallbackDate]
  for (const candidate of candidates) {
    const date = toValidDate(candidate)
    if (date) return date
  }
  return null
}

/**
 * Uses the immutable ends_at snapshot when present. Legacy rows fall back to
 * created_at + duration_days (short Agriculture contract) or
 * created_at + duration_months, with the safe legacy default of three months.
 */
export function getContractEndDate(contract, fallbackDate = new Date()) {
  const explicitEnd = toValidDate(contract?.ends_at)
  if (explicitEnd) return explicitEnd

  const start = getContractStart(contract, fallbackDate)
  if (!start) return null

  const startKey = getBusinessDateKey(start)
  const startTimeParts = getDateTimePartsInTimeZone(start)
  if (!startKey || !startTimeParts) return null

  const durationDays = Number(contract?.duration_days)
  if (Number.isInteger(durationDays) && durationDays > 0) {
    const dayEndKey = addBusinessDays(startKey, durationDays)
    if (!dayEndKey) return null
    return businessDateTimeToDate(dayEndKey, startTimeParts)
  }

  const endKey = addBusinessMonths(startKey, normalizeDurationMonths(contract?.duration_months))
  if (!endKey) return null

  return businessDateTimeToDate(endKey, startTimeParts)
}

/** Full number of contract dates in [start date, end date), capped at zero. */
export function getContractDayCount(contract, anchorDate = new Date()) {
  if (contract?.duration_days && Number.isInteger(Number(contract.duration_days)) && Number(contract.duration_days) > 0) {
    return Math.trunc(Number(contract.duration_days))
  }
  const start = getContractStart(contract, anchorDate)
  const end = getContractEndDate(contract, anchorDate)
  if (!start || !end) return 0

  const startKey = getBusinessDateKey(start)
  const endKey = getBusinessDateKey(end)
  if (!startKey || !endKey) return 0
  return Math.max(0, getBusinessDayDifference(endKey, startKey))
}

export const getEligibleContractDays = getContractDayCount
export const countEligibleContractDays = getContractDayCount

/**
 * Libellé d'affichage de la durée d'un pack ou d'un contrat.
 * Un pack Agriculture (duration_days = 15) prime sur le libellé mensuel.
 * @param {number | null | undefined} durationDays
 * @param {number | null | undefined} [durationMonths]
 * @returns {string}
 */
export function formatContractDuration(durationDays, durationMonths = DEFAULT_DURATION_MONTHS) {
  const days = Number(durationDays)
  if (Number.isInteger(days) && days > 0) return `${days} jours`
  return `${Number(durationMonths) || DEFAULT_DURATION_MONTHS} mois`
}

/** Remaining eligible dates include the current business date and exclude ends_at. */
export function getRemainingContractDays(contract, asOf = new Date()) {
  const asOfDate = toValidDate(asOf)
  const end = getContractEndDate(contract, asOfDate ?? new Date())
  if (!asOfDate || !end) return 0

  const asOfKey = getBusinessDateKey(asOfDate)
  const start = getContractStart(contract, asOfDate)
  const startKey = start ? getBusinessDateKey(start) : asOfKey
  const endKey = getBusinessDateKey(end)
  if (!asOfKey || !startKey || !endKey) return 0

  const effectiveStartKey = asOfKey < startKey ? startKey : asOfKey
  if (effectiveStartKey >= endKey) return 0
  return getBusinessDayDifference(endKey, effectiveStartKey)
}

/** Eligible contract dates within a projection horizon, never beyond ends_at. */
export function getContractDaysBetween(contract, fromDate, toDate) {
  const from = toValidDate(fromDate)
  const to = toValidDate(toDate)
  const end = getContractEndDate(contract, from ?? new Date())
  const start = getContractStart(contract, from ?? new Date())
  if (!from || !to || !end || !start) return 0

  const fromKey = getBusinessDateKey(from)
  const startKey = getBusinessDateKey(start)
  const endKey = getBusinessDateKey(end)
  const toKey = getBusinessDateKey(to)
  if (!fromKey || !startKey || !endKey || !toKey) return 0

  const effectiveFromKey = fromKey < startKey ? startKey : fromKey
  const effectiveToKey = toKey < endKey ? toKey : endKey
  if (effectiveFromKey >= effectiveToKey) return 0

  return getBusinessDayDifference(effectiveToKey, effectiveFromKey)
}

export function calculateContractGain(capital, contractDays) {
  const days = Number(contractDays)
  if (!Number.isFinite(days) || days <= 0) return 0
  return roundToTwoDecimals(calculateDailyProfit(capital) * Math.floor(days))
}

export const calculateMaximumGain = calculateContractGain

export function calculateRemainingGain(capital, contract, asOf = new Date()) {
  return calculateContractGain(capital, getRemainingContractDays(contract, asOf))
}

export function calculateProjectedGain(capital, contract, fromDate, toDate) {
  return calculateContractGain(capital, getContractDaysBetween(contract, fromDate, toDate))
}

export function getContractProgress(contract, asOf = new Date()) {
  const totalDays = getContractDayCount(contract, asOf)
  if (totalDays <= 0) return 0
  const remainingDays = getRemainingContractDays(contract, asOf)
  return Math.max(0, Math.min(100, Math.round(((totalDays - remainingDays) / totalDays) * 100)))
}

/**
 * Projects deterministic gains for each calendar horizon in months. Each
 * investment is calculated from real dates and capped by its contract end.
 */
export function projectContractGains(investments, asOf = new Date(), horizons = [3, 6, 12]) {
  const from = toValidDate(asOf) ?? new Date()
  const normalizedHorizons = Array.isArray(horizons) ? horizons : [3, 6, 12]

  return normalizedHorizons.map((months) => {
    const fromKey = getBusinessDateKey(from)
    const horizonKey = fromKey ? addBusinessMonths(fromKey, months) : null
    if (!horizonKey) return { months: Number(months) || 0, estimatedGain: 0 }
    const horizon = new Date(`${horizonKey}T12:00:00Z`)

    const estimatedGain = (investments || []).reduce((total, investment) => {
      if (investment?.status && investment.status !== 'ACTIVE') return total
      return total + calculateProjectedGain(
        Number(investment?.total_amount) || 0,
        investment,
        from,
        horizon,
      )
    }, 0)

    return { months: Number(months) || 0, estimatedGain: roundToTwoDecimals(estimatedGain) }
  })
}

export const projectInvestmentGains = projectContractGains
