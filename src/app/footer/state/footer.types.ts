export interface FooterColumn {
  readonly id: string;
  readonly title: string;
  readonly links: ReadonlyArray<{ readonly id: string; readonly label: string; readonly href: string }>;
}

export interface FooterLegal {
  readonly copyright: string;
  readonly links: ReadonlyArray<{ readonly id: string; readonly label: string; readonly href: string }>;
}

export interface FooterCmsData {
  readonly columns: ReadonlyArray<FooterColumn>;
  readonly legal: FooterLegal;
}

export interface FooterState {
  // FooterStore reads everything from the httpResource; no extra state needed.
}
