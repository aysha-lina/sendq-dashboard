const { createTransport } = require('./smtp.factory');
const { isApi, sendViaApi } = require('./api.senders');

const sendMail = async ({ provider, message }) => {
  if (isApi(provider)) return sendViaApi(provider, message);
  const transport = createTransport(provider);
  return transport.sendMail(message);
};

module.exports = { sendMail };
