export const validatePayload = (payload, requiredFields) => {
  requiredFields.forEach((field) => {
    if (!payload[field]) {
      return new Error(`${field} is required`);
    }
  });
};