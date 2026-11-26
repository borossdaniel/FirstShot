import { v4, v7, validate, version } from 'uuid';

export function newId() {
  return v4();
}

export function newEventId(timestampMs) {
  return timestampMs === undefined ? v7() : v7({ msecs: timestampMs });
}

export function isValidUuid(value) {
  return typeof value === 'string' && validate(value);
}

export function uuidVersion(value) {
  return isValidUuid(value) ? version(value) : null;
}
