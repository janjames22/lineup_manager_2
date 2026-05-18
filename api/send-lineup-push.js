// BUG-015: This file is a legacy duplicate of api/push/send-lineup.js.
// Delegate to the canonical handler to keep behaviour in sync while
// preserving any existing callers that still reference this endpoint.
import canonicalHandler from './push/send-lineup.js';

export default canonicalHandler;
