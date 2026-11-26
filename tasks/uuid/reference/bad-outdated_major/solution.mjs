import { v4 as uuidv4, v7 as uuidv7, validate, version } from 'uuid';

export function newId() {
  return uuidv4();
}

export function newEventId(timestampMs) {
  return timestampMs === undefined ? uuidv7() : uuidv7({ msecs: timestampMs });
}

export function isValidUuid(value) {
  return typeof value === 'string' && validate(value);
}

export function uuidVersion(value) {
  return isValidUuid(value) ? version(value) : null;
}
