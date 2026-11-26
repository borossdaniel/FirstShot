import { v4 as uuidv4, v7 as uuidv7, validate as uuidValidate, version as uuidVersionOf } from 'uuid';

export function newId() {
  return uuidv4();
}

export function newEventId(timestampMs) {
  return timestampMs === undefined ? uuidv7() : uuidv7({ msecs: timestampMs });
}

export function isValidUuid(value) {
  return typeof value === 'string' && uuidValidate(value);
}

export function uuidVersion(value) {
  return isValidUuid(value) ? uuidVersionOf(value) : null;
}
