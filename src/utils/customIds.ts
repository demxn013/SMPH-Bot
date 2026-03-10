export const CUSTOM_IDS = {
  ticketEntry: 'ticket-entry-select',
  providerRegistrationModal: 'provider-registration-modal',
  serviceRequestModal: 'service-request-modal',
  partnershipModal: 'partnership-modal',
  rateDealModalPrefix: 'rate-deal-modal:'
};

export const parseRateModalDealId = (customId: string): string | null => {
  if (!customId.startsWith(CUSTOM_IDS.rateDealModalPrefix)) {
    return null;
  }
  return customId.slice(CUSTOM_IDS.rateDealModalPrefix.length);
};
