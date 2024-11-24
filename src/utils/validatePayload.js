export const validatePayload = (payload, requiredFields) => {
  requiredFields.forEach((field) => {
    if (!payload[field]) {
      throw new Error(400, `${field} is required`);
    }
  });
};