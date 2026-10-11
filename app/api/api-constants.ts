export const STATUS_CODES = {
  "200_OK": 200,
  "400_BAD_REQUEST": 400,
  "401_UNAUTHORIZED": 401,
  "404_NOT_FOUND": 404,
  "500_INTERNAL_SERVER_ERROR": 500,
} as const;

// used to construct 'validations/api' type
export const NEXT_RESPONSE_MESSAGE_TYPES = {
  // 200
  "success-message": "success-message",
  // 200
  "success-data": "success-data",
  // 400
  "bad-request-message": "bad-request-message",
  // 401
  "invalid-credentials-message": "invalid-credentials-message",
  // 404
  "not-found-message": "not-found-message",
  // 500
  "internal-server-error-message": "internal-server-error-message",
} as const;
