const wrapAsync = (handler) => {
  if (Array.isArray(handler)) return handler.map(wrapAsync);
  if (typeof handler !== 'function') return handler;

  return (req, res, next) => {
    try {
      const result = handler(req, res, next);
      return Promise.resolve(result).catch(next);
    } catch (err) {
      return next(err);
    }
  };
};

const wrapHandlers = (...handlers) => handlers.flatMap((handler) => (
  Array.isArray(handler) ? handler.map(wrapAsync) : [wrapAsync(handler)]
));

module.exports = { wrapAsync, wrapHandlers };
