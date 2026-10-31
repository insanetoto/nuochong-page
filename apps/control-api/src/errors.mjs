export class ApiError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}
export const requireThat = (value, status = 403, code = 'FORBIDDEN') => { if (!value) throw new ApiError(status, code); };
