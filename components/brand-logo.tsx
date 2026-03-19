'use client';

import Image from 'next/image';

type BrandLogoProps = {
  size?: number;
  title?: string;
  subtitle?: string;
  align?: 'left' | 'center';
  imageClassName?: string;
  titleClassName?: string;
  subtitleClassName?: string;
  wrapperClassName?: string;
  priority?: boolean;
};

export default function BrandLogo({
  size = 40,
  title = 'Leave Management',
  subtitle,
  align = 'left',
  imageClassName = '',
  titleClassName = '',
  subtitleClassName = '',
  wrapperClassName = '',
  priority = false,
}: BrandLogoProps) {
  const isCenter = align === 'center';

  return (
    <div
      className={`flex items-center gap-3 ${isCenter ? 'justify-center text-center' : ''} ${wrapperClassName}`.trim()}
    >
      <div
        className={`relative shrink-0 overflow-hidden rounded-2xl ${imageClassName}`.trim()}
        style={{ width: size, height: size }}
      >
        <Image
          src="/assets/logo_1.png"
          alt="Leave Management logo"
          fill
          priority={priority}
          sizes={`${size}px`}
          className="object-contain"
        />
      </div>
      <div className={isCenter ? 'text-center' : ''}>
        <div className={`font-bold tracking-tight ${titleClassName}`.trim()}>{title}</div>
        {subtitle ? (
          <div className={`text-xs ${subtitleClassName}`.trim()}>{subtitle}</div>
        ) : null}
      </div>
    </div>
  );
}
