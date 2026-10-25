import type { ReactNode } from 'react';

function Svg({ size = 22, stroke = 2, children }: { size?: number; stroke?: number; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

type P = { size?: number };

export const SparkleIcon = ({ size }: P) => (
  <Svg size={size} stroke={1.8}>
    <path d="M12 3l1.8 4.9 4.9 1.8-4.9 1.8L12 16.4l-1.8-4.9-4.9-1.8 4.9-1.8z" />
    <path d="M19 15l.8 2.2 2.2.8-2.2.8L19 21l-.8-2.2-2.2-.8 2.2-.8z" />
  </Svg>
);
export const SpeakerIcon = ({ size }: P) => (
  <Svg size={size} stroke={1.8}>
    <path d="M11 5L6 9H3v6h3l5 4z" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7" />
    <path d="M18.5 5.5a9 9 0 0 1 0 13" />
  </Svg>
);
export const BackIcon = ({ size }: P) => (
  <Svg size={size}>
    <path d="M15 18l-6-6 6-6" />
  </Svg>
);
export const ChevronIcon = ({ size }: P) => (
  <Svg size={size}>
    <path d="M9 6l6 6-6 6" />
  </Svg>
);
export const CloseIcon = ({ size }: P) => (
  <Svg size={size}>
    <path d="M18 6L6 18M6 6l12 12" />
  </Svg>
);
export const PlusIcon = ({ size }: P) => (
  <Svg size={size}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);
export const DeckIcon = ({ size }: P) => (
  <Svg size={size}>
    <rect x="4" y="5" width="16" height="14" rx="3" />
    <path d="M12 9v6M9 12h6" />
  </Svg>
);
export const DotsIcon = ({ size = 22 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="5" cy="12" r="1.8" />
    <circle cx="12" cy="12" r="1.8" />
    <circle cx="19" cy="12" r="1.8" />
  </svg>
);
export const CameraIcon = ({ size }: P) => (
  <Svg size={size} stroke={1.8}>
    <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
    <circle cx="12" cy="13" r="3.5" />
  </Svg>
);
export const KeyIcon = ({ size }: P) => (
  <Svg size={size} stroke={1.8}>
    <circle cx="8" cy="15" r="4" />
    <path d="M11 12l9-9M17 6l3 3" />
  </Svg>
);
export const PaletteIcon = ({ size }: P) => (
  <Svg size={size} stroke={1.8}>
    <circle cx="13.5" cy="6.5" r="1.5" />
    <circle cx="17.5" cy="10.5" r="1.5" />
    <circle cx="8.5" cy="7.5" r="1.5" />
    <path d="M12 2a10 10 0 0 0 0 20c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.4A5.6 5.6 0 0 0 22 9.8C22 5.5 17.5 2 12 2z" />
  </Svg>
);
export const MicIcon = ({ size }: P) => (
  <Svg size={size} stroke={1.8}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </Svg>
);
export const SendIcon = ({ size }: P) => (
  <Svg size={size}>
    <path d="M12 19V5M5 12l7-7 7 7" />
  </Svg>
);
export const CheckIcon = ({ size }: P) => (
  <Svg size={size} stroke={2.2}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Svg>
);
export const RecordIcon = ({ size }: P) => (
  <Svg size={size} stroke={1.8}>
    <circle cx="12" cy="12" r="6" />
  </Svg>
);
export const StopIcon = ({ size }: P) => (
  <Svg size={size} stroke={1.8}>
    <rect x="7" y="7" width="10" height="10" rx="2" />
  </Svg>
);
export const TrashIcon = ({ size }: P) => (
  <Svg size={size} stroke={1.8}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
  </Svg>
);
export const SearchIcon = ({ size }: P) => (
  <Svg size={size} stroke={1.8}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </Svg>
);
