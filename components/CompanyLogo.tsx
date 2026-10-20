'use client';

import React, { useEffect, useState } from 'react';
import { compactCompanyName, logoDomainFor, logoNameProxyUrl, logoProxyUrl } from '@/lib/logo';
import { cn } from '@/lib/utils';

interface CompanyLogoProps {
  company: string;
  website?: string | null;
  directLogoUrl?: string | null;
  size?: number;
  className?: string;
}

function monogram(name: string): string {
  const match = name.trim().match(/[a-zA-Z0-9]/);
  return match ? match[0].toUpperCase() : '?';
}

function hueFor(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) % 360;
  }
  return hash;
}

export function CompanyLogo({
  company,
  website,
  directLogoUrl,
  size = 32,
  className,
}: CompanyLogoProps) {
  const domain = logoDomainFor(website);
  const direct = directLogoUrl?.trim() || null;
  const cleanName = compactCompanyName(company);
  const candidates = [
    domain ? logoProxyUrl(domain, size * 2) : null,
    direct,
    company.trim().length >= 2 ? logoNameProxyUrl(company, size * 2) : null,
    cleanName && cleanName !== company.trim() ? logoNameProxyUrl(cleanName, size * 2) : null,
  ].filter((src): src is string => Boolean(src));

  const [attempt, setAttempt] = useState(0);
  const candidateKey = candidates.join('|');

  useEffect(() => {
    setAttempt(0);
  }, [candidateKey]);

  const src = candidates[attempt] ?? null;

  if (!src) {
    const hue = hueFor(company);
    return (
      <span
        aria-hidden="true"
        title={company}
        style={{
          width: size,
          height: size,
          fontSize: Math.max(12, Math.round(size * 0.5)),
          backgroundColor: `hsl(${hue} 22% 16%)`,
          color: `hsl(${hue} 30% 94%)`,
        }}
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-[10px] font-heading font-bold leading-none select-none ring-1 ring-black/[0.12]',
          className
        )}
      >
        {monogram(company)}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={`${company} logo`}
      title={company}
      width={size}
      height={size}
      loading="lazy"
      style={{ width: size, height: size }}
      onError={() => setAttempt((current) => current + 1)}
      className={cn('shrink-0 rounded-[10px] bg-white object-contain ring-1 ring-black/[0.06]', className)}
    />
  );
}
