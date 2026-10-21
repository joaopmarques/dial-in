const CFG = {
  bpm: 120,                                   // soft groove, one beat = 0.5 s; 72 beats = 36 s
  colors: { bg: '#F4F4F5', panel: '#FFFFFF', line: '#E4E4E7', ink: '#18181B', dim: '#71717A', grid: '#E4E4E7',
            acc: '#2563EB', accHi: '#93C5FD', alt: '#18181B', bad: '#DC2626' },
  fonts: { sans: '"Inter","Helvetica Neue",Arial,sans-serif',
           display: '"Inter","Helvetica Neue",Arial,sans-serif',
           mono: '"JetBrains Mono",ui-monospace,Menlo,monospace' },
  textSplit: false,                           // clean style: no RGB split
  hudTitle: 'dial-in',
  hudMeta: () => '',
  cta: { href: '', newTab: true },            // shared as a video file
  endCta: null,
  endCtaBeat: 6,
  posterT: 2.2,
  watchKey: 'dial-in-promo-watched',
  music: { groove: 'soft', liteScenes: ['launch'], arpScenes: ['ui', 'threed'], tailBeats: 6 },
};
