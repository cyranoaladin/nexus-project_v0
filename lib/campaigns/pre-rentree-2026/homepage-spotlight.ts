export interface PreRentreeHomepageSpotlightDTO {
  campaignId: string;
  ariaLabel: string;
  title: string;
  primaryCtaLabel: string;
  publicStatus: string;
  date: {
    days: string;
    month: string;
    year: string;
    accessibleLabel: string;
    chipLabel: string;
  };
  entryClassesLabel: string;
  subjectFamiliesLabel: string;
  capacityLabel: string;
  volumeLabel: string;
  venueLabel: string;
  editorialLine: string;
  campaignPath: string;
  secondaryCtaLabel: string;
  secondaryCtaPath: string;
}
