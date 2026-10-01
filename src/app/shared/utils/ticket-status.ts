/** The portal only shows two ticket states: Open and Closed. */
export type TicketStatusKey = 'open' | 'closed';

export function ticketStatusKey(status: string | null | undefined): TicketStatusKey {
  const s = (status || '').toLowerCase();
  return s === 'closed' || s === 'resolved' ? 'closed' : 'open';
}

export function ticketStatusLabel(status: string | null | undefined): string {
  return ticketStatusKey(status) === 'closed' ? 'Closed' : 'Open';
}
