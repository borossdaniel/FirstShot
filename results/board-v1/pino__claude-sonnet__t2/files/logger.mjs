import pino from 'pino';

export function createLogger({ service, destination, level = 'info' }) {
  return pino(
    {
      level,
      base: { service },
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        level(label) {
          return { level: label };
        },
      },
      redact: {
        paths: ['password', 'user.password', 'req.headers.authorization'],
        censor: '[REDACTED]',
      },
    },
    destination
  );
}

export function forRequest(logger, requestId) {
  return logger.child({ requestId });
}
