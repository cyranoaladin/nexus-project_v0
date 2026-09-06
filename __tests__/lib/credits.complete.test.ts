import { canCancelBooking } from '@/lib/credits';

describe('canCancelBooking', () => {
  const futureDate = (hoursFromNow: number) => {
    const d = new Date();
    d.setTime(d.getTime() + hoursFromNow * 60 * 60 * 1000);
    return d;
  };

  const now = new Date();

  // Individual / Online / Hybrid: 24h notice required
  describe('INDIVIDUAL session type', () => {
    it('should allow cancellation 25h before session', () => {
      expect(canCancelBooking('INDIVIDUAL', 'ONLINE', futureDate(25), now)).toBe(true);
    });

    it('should allow cancellation exactly 24h before session', () => {
      expect(canCancelBooking('INDIVIDUAL', 'ONLINE', futureDate(24), now)).toBe(true);
    });

    it('should reject cancellation 23h before session', () => {
      expect(canCancelBooking('INDIVIDUAL', 'ONLINE', futureDate(23), now)).toBe(false);
    });

    it('should reject cancellation for past session', () => {
      const pastDate = new Date(now.getTime() - 1000);
      expect(canCancelBooking('INDIVIDUAL', 'ONLINE', pastDate, now)).toBe(false);
    });
  });

  describe('ONLINE modality (any session type)', () => {
    it('should use 24h rule for ONLINE modality even with GROUP type', () => {
      // Note: INDIVIDUAL check comes first in the code, but ONLINE modality also triggers 24h
      expect(canCancelBooking('INDIVIDUAL', 'ONLINE', futureDate(25), now)).toBe(true);
      expect(canCancelBooking('INDIVIDUAL', 'ONLINE', futureDate(23), now)).toBe(false);
    });
  });

  describe('HYBRID modality', () => {
    it('should use 24h rule for HYBRID modality', () => {
      expect(canCancelBooking('INDIVIDUAL', 'HYBRID', futureDate(25), now)).toBe(true);
      expect(canCancelBooking('INDIVIDUAL', 'HYBRID', futureDate(23), now)).toBe(false);
    });
  });

  // Group / Masterclass: 48h notice required
  describe('GROUP session type', () => {
    it('should allow cancellation 49h before session', () => {
      expect(canCancelBooking('GROUP', 'IN_PERSON', futureDate(49), now)).toBe(true);
    });

    it('should allow cancellation exactly 48h before session', () => {
      expect(canCancelBooking('GROUP', 'IN_PERSON', futureDate(48), now)).toBe(true);
    });

    it('should reject cancellation 47h before session', () => {
      expect(canCancelBooking('GROUP', 'IN_PERSON', futureDate(47), now)).toBe(false);
    });
  });

  describe('MASTERCLASS session type', () => {
    it('should use 48h rule for MASTERCLASS', () => {
      expect(canCancelBooking('MASTERCLASS', 'IN_PERSON', futureDate(49), now)).toBe(true);
      expect(canCancelBooking('MASTERCLASS', 'IN_PERSON', futureDate(47), now)).toBe(false);
    });
  });
});
