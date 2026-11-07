// F-02 domain rules — stub committed with the failing tests (TDD red).
// Implementation follows in the next commit.
const notImplemented = () => {
  throw new Error('Not implemented yet (F-02 TDD red)');
};

export const ACTIVE_STATUSES = [];
export const isActiveStatus = notImplemented;
export const canTransition = notImplemented;
export const isBeforeDeadline = notImplemented;
export const validateProposalInput = notImplemented;
export const validateRejectReason = notImplemented;
export const parseStatusFilter = notImplemented;
