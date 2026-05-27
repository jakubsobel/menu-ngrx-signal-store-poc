export interface MenuLink {
  readonly label: string;
  readonly href: string;
  readonly external?: boolean;
}

export interface MenuLogo {
  readonly label: string;
  readonly href: string;
  readonly imageSrc?: string;
}

export interface MenuItem {
  readonly id: string;
  readonly label: string;
  readonly href?: string;
  readonly children?: readonly MenuItem[];
}

export type RightButtonKind = 'link' | 'action';

export interface RightButton {
  readonly id: string;
  readonly label: string;
  readonly icon?: string;
  readonly tooltip?: string;
  readonly kind: RightButtonKind;
  readonly href?: string;
  readonly eventId?: string;
}

export interface CountryOption {
  readonly code: string;
  readonly label: string;
}

export interface ThemeOption {
  readonly id: string;
  readonly label: string;
}

export interface MenuCmsData {
  readonly logo: MenuLogo;
  readonly center: readonly MenuItem[];
  readonly right: readonly RightButton[];
  readonly countries: readonly CountryOption[];
  readonly themes: readonly ThemeOption[];
  readonly defaults: {
    readonly countryCode: string;
    readonly themeId: string;
  };
}

export interface ContextualButton extends RightButton {
  readonly placement?: 'end' | 'start';
}

export interface MenuOverride {
  readonly hideButtons?: readonly string[];
  readonly addButtons?: readonly ContextualButton[];
  readonly theme?: string;
  readonly hideCountryPicker?: boolean;
  readonly dim?: boolean;
}

export interface RegisteredOverride {
  readonly id: string;
  readonly seq: number;
  readonly override: MenuOverride;
}

export interface MenuState {
  readonly overrides: Readonly<Record<string, RegisteredOverride>>;
  readonly nextOverrideSeq: number;
  readonly userCountryCode: string | null;
  readonly userThemeId: string | null;
}
