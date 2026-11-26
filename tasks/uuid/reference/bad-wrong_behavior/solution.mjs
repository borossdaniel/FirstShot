import { v4 as uuidv4, v7 as uuidv7, validate, version } from 'uuid';

export const newId = () => uuidv4();

export const newEventId = (timestampMs) => (timestampMs === undefined ? uuidv7() : uuidv7({ msecs: timestampMs }));

export const isValidUuid = (value) => typeof value === 'string' && validate(value);

// Bug: uuid's version() throws on invalid input instead of returning null.
export const uuidVersion = (value) => version(value);
