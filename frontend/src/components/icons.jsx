import React from 'react';

/*
 * One stroke weight, one grid, currentColor everywhere. Icons are decorative
 * next to a text label (aria-hidden) unless a caller passes a title.
 */
function Svg({ children, size = 18, title, ...rest }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      focusable="false"
      {...rest}
    >
      {title && <title>{title}</title>}
      {children}
    </svg>
  );
}

export const IconUnpack = (p) => (
  <Svg {...p}>
    <path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z" />
    <path d="M3 7.5 12 12l9-4.5M12 12v9" />
    <path d="M16.5 5.2 7.5 9.8" />
  </Svg>
);

export const IconBundle = (p) => (
  <Svg {...p}>
    <rect x="3" y="8" width="18" height="12" rx="2" />
    <path d="M3 12h18" />
    <path d="M9 8V6a3 3 0 0 1 6 0v2" />
  </Svg>
);

export const IconChainLink = (p) => (
  <Svg {...p}>
    <path d="M10 13.5a4 4 0 0 0 5.7.3l2.6-2.6a4 4 0 0 0-5.7-5.7l-1.3 1.3" />
    <path d="M14 10.5a4 4 0 0 0-5.7-.3l-2.6 2.6a4 4 0 0 0 5.7 5.7l1.3-1.3" />
  </Svg>
);

export const IconSwap = (p) => (
  <Svg {...p}>
    <path d="M4 8h13l-3.2-3.2" />
    <path d="M20 16H7l3.2 3.2" />
  </Svg>
);

export const IconShieldCheck = (p) => (
  <Svg {...p}>
    <path d="M12 3 5 6v5.5c0 4.3 2.9 7.7 7 9.5 4.1-1.8 7-5.2 7-9.5V6z" />
    <path d="m9 12 2.2 2.2L15.5 10" />
  </Svg>
);

export const IconGlobe = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3.2 9.5h17.6M3.2 14.5h17.6" />
    <path d="M12 3c2.4 2.5 3.6 5.5 3.6 9s-1.2 6.5-3.6 9c-2.4-2.5-3.6-5.5-3.6-9S9.6 5.5 12 3z" />
  </Svg>
);

export const IconRequest = (p) => (
  <Svg {...p}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
    <path d="M9 13h6M9 17h4" />
  </Svg>
);

export const IconKey = (p) => (
  <Svg {...p}>
    <circle cx="8" cy="8" r="4" />
    <path d="m11 11 8 8M16.5 16.5 15 18M19 14l-1.5 1.5" />
  </Svg>
);

export const IconInspect = (p) => (
  <Svg {...p}>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="m15.5 15.5 4.5 4.5" />
    <path d="M8 10.5h5M8 13h3" />
  </Svg>
);

export const IconDownload = (p) => (
  <Svg {...p}>
    <path d="M12 4v10" />
    <path d="m8 10.5 4 4 4-4" />
    <path d="M5 19h14" />
  </Svg>
);

export const IconCopy = (p) => (
  <Svg {...p}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15H4V4h11v1" />
  </Svg>
);

export const IconCheck = (p) => (
  <Svg {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Svg>
);

export const IconAlert = (p) => (
  <Svg {...p}>
    <path d="M12 4.5 21 19H3z" />
    <path d="M12 10v4.5M12 17.2v.3" />
  </Svg>
);

export const IconCross = (p) => (
  <Svg {...p}>
    <path d="m6 6 12 12M18 6 6 18" />
  </Svg>
);

export const IconFile = (p) => (
  <Svg {...p}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
  </Svg>
);

export const IconPlus = (p) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const IconChevron = (p) => (
  <Svg {...p}>
    <path d="m9 5 7 7-7 7" />
  </Svg>
);

export const IconSun = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
  </Svg>
);

export const IconMoon = (p) => (
  <Svg {...p}>
    <path d="M20 14.2A8.2 8.2 0 0 1 9.8 4 8.2 8.2 0 1 0 20 14.2z" />
  </Svg>
);

export const IconSpinner = ({ size = 16, ...rest }) => (
  <svg
    className="spinner"
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
    aria-hidden="true"
    focusable="false"
    {...rest}
  >
    <circle cx="12" cy="12" r="9" opacity="0.25" />
    <path d="M21 12a9 9 0 0 0-9-9" />
  </svg>
);
