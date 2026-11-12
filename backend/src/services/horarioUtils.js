function isValidTimeRange(start, end) {
  const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;
  const toSeconds = (value) => {
    const [hours, minutes, seconds = '0'] = String(value).split(':');
    return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
  };
  return timePattern.test(String(start || ''))
    && timePattern.test(String(end || ''))
    && toSeconds(start) < toSeconds(end);
}

function intervalsOverlap(firstStart, firstEnd, secondStart, secondEnd) {
  return firstStart < secondEnd && firstEnd > secondStart;
}

module.exports = { intervalsOverlap, isValidTimeRange };
