import type React from 'react';

const Logo = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 200 50"
    className={className}
    {...props}
    aria-label="ProcessWise AI Logo"
  >
    <defs>
      <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" style={{ stopColor: 'hsl(var(--primary))', stopOpacity: 1 }} />
        <stop offset="100%" style={{ stopColor: 'hsl(var(--accent))', stopOpacity: 1 }} />
      </linearGradient>
    </defs>
    <style>
      {`
        .logo-text { font-family: 'Space Grotesk', sans-serif; font-size: 28px; fill: url(#logoGradient); font-weight: bold; }
        .logo-highlight { fill: hsl(var(--accent)); }
      `}
    </style>
    <text x="10" y="35" className="logo-text">
      Process
      <tspan className="logo-highlight">Wise</tspan>
      AI
    </text>
  </svg>
);

export default Logo;
