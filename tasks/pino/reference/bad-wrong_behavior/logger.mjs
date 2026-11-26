import pino from 'pino';

export function createLogger({ service, destination, level = 'info' }) {
  return pino(
    {
      level,
      base: { service },
      useLevelLabels: true,
      timestamp: pino.stdTimeFunctions.isoTime,
      redact: {
        paths: ['password', '*.password', 'req.headers.authorization'],
        censor: '[REDACTED]',
      },
    },
    destination,
  );
}

export function forRequest(logger, requestId) {
  return logger.child({ requestId });
}
